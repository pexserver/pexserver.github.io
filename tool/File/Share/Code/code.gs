const MAX_FILE_SIZE_MB = 100;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const EXPIRATION_MINUTES = 30;
const UPLOAD_FOLDER_NAME = "Blob";
const TRIGGER_FUNCTION_NAME = "deleteOldFilesPostBodyEncoded";
const TRIGGER_INTERVAL_MINUTES = 5;
const MAX_FOLDER_SIZE_GB = 1;
const MAX_FOLDER_SIZE_BYTES = MAX_FOLDER_SIZE_GB * 1024 * 1024 * 1024;
const RATE_LIMIT_THRESHOLD = 15;
const RATE_LIMIT_WINDOW_SECONDS = 60;
const BLOCK_DURATION_MINUTES = 3;
const SCRIPT_LOCK_TIMEOUT_MS = 10000;

const RATE_LIMIT_PROPERTY_KEY_COUNT = "rateLimit_count";
const RATE_LIMIT_PROPERTY_KEY_TIMESTAMP = "rateLimit_timestamp";
const BLOCK_PROPERTY_KEY_BLOCKED = "block_isBlocked";
const BLOCK_PROPERTY_KEY_RELEASE_TIME = "block_releaseTime";

function parseUrlEncoded_(encodedString) {
  const params = {};
  if (!encodedString) {
    return params;
  }
  try {
    const pairs = encodedString.split("&");
    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i].split("=");
      if (pair.length >= 1) {
        const key = decodeURIComponent(pair[0].replace(/\+/g, " "));
        const value =
          pair.length === 2
            ? decodeURIComponent(pair[1].replace(/\+/g, " "))
            : "";
        params[key] = value;
      }
    }
  } catch (e) {
    Logger.log(`[ERROR] Failed to parse url encoded string: ${e.message}`);
    throw new Error(
      `URLエンコードされたデータの解析に失敗しました: ${e.message} (Error Code: PARSE-FAIL)`
    );
  }
  return params;
}

function checkRateLimit_() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(SCRIPT_LOCK_TIMEOUT_MS)) {
    Logger.log(
      "[WARN] Could not acquire script lock for rate limit check. Potentially high load."
    );

    const scriptPropertiesCheck = PropertiesService.getScriptProperties();
    const isBlockedCheck =
      scriptPropertiesCheck.getProperty(BLOCK_PROPERTY_KEY_BLOCKED) === "true";
    if (isBlockedCheck) {
      const releaseTimeCheck = parseInt(
        scriptPropertiesCheck.getProperty(BLOCK_PROPERTY_KEY_RELEASE_TIME) ||
          "0",
        10
      );
      if (Date.now() < releaseTimeCheck) {
        Logger.log("[INFO] Access blocked (checked without lock).");
        throw new Error(
          `アクセスが一時的にブロックされています。約${Math.ceil(
            BLOCK_DURATION_MINUTES
          )}分後に再試行してください。(Error Code: RL-BLOCKED-NOLOCK)`
        );
      }
    }
    throw new Error(
      "サーバーが混み合っています。しばらくしてから再試行してください。(Error Code: RL-LOCK)"
    );
  }

  try {
    const scriptProperties = PropertiesService.getScriptProperties();
    const isBlocked =
      scriptProperties.getProperty(BLOCK_PROPERTY_KEY_BLOCKED) === "true";
    const now = Date.now();

    if (isBlocked) {
      const releaseTime = parseInt(
        scriptProperties.getProperty(BLOCK_PROPERTY_KEY_RELEASE_TIME) || "0",
        10
      );
      if (now < releaseTime) {
        const remainingSeconds = Math.ceil((releaseTime - now) / 1000);
        Logger.log(
          `[INFO] Access blocked. Release in ${remainingSeconds} seconds. Release time: ${new Date(
            releaseTime
          ).toLocaleString()}`
        );
        throw new Error(
          `アクセスが一時的にブロックされています。約${Math.ceil(
            BLOCK_DURATION_MINUTES
          )}分後に再試行してください。(解除予定: ${new Date(
            releaseTime
          ).toLocaleTimeString()}) (Error Code: RL-BLOCKED)`
        );
      } else {
        Logger.log("[INFO] Block duration expired. Unblocking access.");
        scriptProperties.deleteProperty(BLOCK_PROPERTY_KEY_BLOCKED);
        scriptProperties.deleteProperty(BLOCK_PROPERTY_KEY_RELEASE_TIME);
        scriptProperties.deleteProperty(RATE_LIMIT_PROPERTY_KEY_COUNT);
        scriptProperties.deleteProperty(RATE_LIMIT_PROPERTY_KEY_TIMESTAMP);
      }
    }

    const lastTimestampStr = scriptProperties.getProperty(
      RATE_LIMIT_PROPERTY_KEY_TIMESTAMP
    );
    const currentCountStr = scriptProperties.getProperty(
      RATE_LIMIT_PROPERTY_KEY_COUNT
    );
    let currentCount = 0;
    const windowStartTime = now - RATE_LIMIT_WINDOW_SECONDS * 1000;

    if (lastTimestampStr && currentCountStr) {
      const lastTimestamp = parseInt(lastTimestampStr, 10);

      if (lastTimestamp > windowStartTime) {
        currentCount = parseInt(currentCountStr, 10);
      } else {
        currentCount = 0;
      }
    }

    currentCount++;

    scriptProperties.setProperty(
      RATE_LIMIT_PROPERTY_KEY_COUNT,
      currentCount.toString()
    );
    scriptProperties.setProperty(
      RATE_LIMIT_PROPERTY_KEY_TIMESTAMP,
      now.toString()
    );
    Logger.log(
      `Rate limit count: ${currentCount}/${RATE_LIMIT_THRESHOLD} within the last ${RATE_LIMIT_WINDOW_SECONDS}s`
    );

    if (currentCount > RATE_LIMIT_THRESHOLD) {
      const blockReleaseTime = now + BLOCK_DURATION_MINUTES * 60 * 1000;
      scriptProperties.setProperty(BLOCK_PROPERTY_KEY_BLOCKED, "true");
      scriptProperties.setProperty(
        BLOCK_PROPERTY_KEY_RELEASE_TIME,
        blockReleaseTime.toString()
      );
      Logger.log(
        `[WARN] Rate limit exceeded (${currentCount}/${RATE_LIMIT_THRESHOLD}). Blocking access until ${new Date(
          blockReleaseTime
        ).toLocaleString()}`
      );

      throw new Error(
        `リクエストが多すぎます。約${BLOCK_DURATION_MINUTES}分間アクセスがブロックされました。(Error Code: RL-EXCEEDED)`
      );
    }
  } finally {
    lock.releaseLock();
  }
}

function doPost(e) {
  Logger.log("------- doPost Start (Compress & Return) -------");
  let result;
  let responseMimeType = ContentService.MimeType.JSON;

  try {
    checkRateLimit_();

    if (!e || !e.postData || !e.postData.contents) {
      Logger.log("[ERROR] Request body (e.postData.contents) is empty.");
      throw new Error("リクエストボディが空です。(Error Code: REQ-EMPTY)");
    }
    const requestBody = e.postData.contents;
    Logger.log(`Received request body length: ${requestBody.length}`);

    if (requestBody.length > 45 * 1024 * 1024) {
      Logger.log(
        `[WARN] Request body size (${requestBody.length} bytes) is potentially close to or exceeding GAS payload limit (~50MB). Base64 encoded data for large files can exceed this.`
      );
    }

    const parsedData = parseUrlEncoded_(requestBody);

    const fileName = parsedData.fileName;
    const mimeType = parsedData.mimeType;
    const base64DataUrl = parsedData.data;

    Logger.log(
      `Parsed: fileName=${fileName}, mimeType=${mimeType}, data received=${!!base64DataUrl}`
    );

    if (!fileName || !mimeType) {
      Logger.log("[ERROR] Missing fileName or mimeType after parsing.");
      throw new Error(
        "リクエストデータに fileName または mimeType が含まれていません。(Error Code: REQ-PARSE-PARAM)"
      );
    }
    if (!base64DataUrl) {
      Logger.log("[ERROR] Parsed data 'data' is null or undefined.");
      throw new Error(
        "ファイルデータ(data)が見つかりません。(Error Code: REQ-PARSE-DATA)"
      );
    }

    const estimatedBytes = base64DataUrl.length * 0.75;
    Logger.log(
      `Estimated decoded data size (bytes, approx): ${estimatedBytes}`
    );
    if (estimatedBytes > MAX_FILE_SIZE_BYTES * 1.1) {
      Logger.log(
        `[ERROR] Estimated data size (${(estimatedBytes / 1024 / 1024).toFixed(
          2
        )} MB) likely exceeds single file limit (${MAX_FILE_SIZE_MB}MB).`
      );
      throw new Error(
        `ファイルサイズが大きすぎる可能性があります (上限 ${MAX_FILE_SIZE_MB}MB)。(Error Code: FILE-SIZE-EST)`
      );
    }

    result = compressAndReturnFile_(fileName, mimeType, base64DataUrl);
    Logger.log(
      `compressAndReturnFile_ result: Success=${result.success}, Message=${
        result.message
      }, FileName=${result.fileName || "N/A"}`
    );

    if (!result.success) {
      throw new Error(result.message);
    }

    const jsonResponse = JSON.stringify(result);

    if (jsonResponse.length > 45 * 1024 * 1024) {
      Logger.log(
        `[WARN] JSON Response size (${jsonResponse.length} bytes) is large and may approach GAS limits. Consider alternative methods for very large compressed files.`
      );
    }
    Logger.log(
      `Returning success response (JSON). Contains compressed file data (base64).`
    );
    Logger.log("------- doPost End (Success) -------");
    return ContentService.createTextOutput(jsonResponse).setMimeType(
      responseMimeType
    );
  } catch (error) {
    Logger.log(
      `[ERROR] doPost Catch Block: ${error.message}\nStack: ${
        error.stack || "No stack trace available"
      }`
    );

    result = {
      success: false,
      message: `サーバー処理中にエラーが発生しました: ${error.message}`,
    };
    const jsonResponse = JSON.stringify(result);
    Logger.log(`Returning error response (JSON): ${jsonResponse}`);
    Logger.log("------- doPost End (Error) -------");

    return ContentService.createTextOutput(jsonResponse).setMimeType(
      responseMimeType
    );
  }
}

function compressAndReturnFile_(fileName, mimeType, base64DataUrl) {
  Logger.log("--- compressAndReturnFile_ Start ---");
  let fileSize = 0;
  try {
    Logger.log(
      `Decoding base64 data for ${fileName} (received length: ${base64DataUrl.length})`
    );

    const base64Data = base64DataUrl.substring(base64DataUrl.indexOf(",") + 1);
    if (!base64Data) {
      throw new Error(
        "Base64データ部分が見つかりません。(Error Code: UP-B64-NODATA)"
      );
    }

    let decodedData;
    try {
      decodedData = Utilities.base64Decode(base64Data, Utilities.Charset.UTF_8);
    } catch (e) {
      Logger.log(`[ERROR] Base64 decode failed: ${e.message}`);

      throw new Error(
        `Base64データのデコードに失敗しました。データ形式を確認してください。(Error Code: UP-B64-DECFAIL)`
      );
    }
    fileSize = decodedData.length;
    Logger.log(`Decoded data length (bytes): ${fileSize}`);

    if (fileSize === 0) {
      Logger.log("[ERROR] Decoded file size is 0.");
      throw new Error(
        "ファイルが空、またはデコードに失敗しました。(Error Code: UP-EMPTY)"
      );
    }
    if (fileSize > MAX_FILE_SIZE_BYTES) {
      Logger.log(
        `[ERROR] Actual file size (${fileSize} bytes / ${(
          fileSize /
          1024 /
          1024
        ).toFixed(
          2
        )} MB) exceeds single file limit (${MAX_FILE_SIZE_BYTES} bytes / ${MAX_FILE_SIZE_MB} MB).`
      );
      throw new Error(
        `ファイルサイズが個別の上限 (${MAX_FILE_SIZE_MB}MB) を超えています (${(
          fileSize /
          1024 /
          1024
        ).toFixed(2)}MB)。(Error Code: UP-FILE-LIMIT)`
      );
    }

    let blob;
    try {
      blob = Utilities.newBlob(decodedData, mimeType, fileName);
      decodedData = null;
    } catch (e) {
      Logger.log(`[ERROR] Failed to create blob: ${e.message}`);
      throw new Error(
        `ファイルデータのBlobオブジェクト作成に失敗しました。(Error Code: UP-BLOB-FAIL)`
      );
    }
    const blobSize = blob.getBytes().length;
    Logger.log(
      `Created blob: Name=${blob.getName()}, Type=${blob.getContentType()}, Size=${blobSize} bytes`
    );

    if (blobSize !== fileSize) {
      Logger.log(
        `[WARN] Decoded size (${fileSize}) and blob size (${blobSize}) differ. Using blob size for checks.`
      );
    }

    Logger.log(`Compressing file "${fileName}"...`);
    const zippedFileName = fileName + ".zip";
    let zippedBlob;
    try {
      zippedBlob = Utilities.zip([blob], zippedFileName);
      blob = null;
    } catch (e) {
      Logger.log(`[ERROR] Failed to zip blob: ${e.message}`);
      throw new Error(
        `ファイルの圧縮処理に失敗しました。(Error Code: UP-ZIP-FAIL)`
      );
    }
    const zippedFileSize = zippedBlob.getBytes().length;
    Logger.log(
      `File compressed: New Name=${zippedBlob.getName()}, Type=${zippedBlob.getContentType()}, Compressed Size=${zippedFileSize} bytes`
    );
    Logger.log(
      `Compression ratio: ${((zippedFileSize / fileSize) * 100).toFixed(1)}%`
    );

    Logger.log(`Encoding compressed data to Base64...`);
    let zippedBase64Data;
    try {
      zippedBase64Data = Utilities.base64Encode(zippedBlob.getBytes());
    } catch (e) {
      Logger.log(
        `[ERROR] Failed to encode zipped blob to Base64: ${e.message}`
      );
      throw new Error(
        `圧縮データのエンコードに失敗しました。(Error Code: UP-B64-ENCFAIL)`
      );
    }
    const encodedLength = zippedBase64Data.length;
    Logger.log(`Encoded compressed data to Base64 (length: ${encodedLength})`);

    if (encodedLength > 48 * 1024 * 1024) {
      Logger.log(
        `[WARN] Encoded compressed data size (${encodedLength} chars) is very large and might exceed response limits.`
      );
    }

    Logger.log("--- compressAndReturnFile_ End (Success) ---");

    return {
      success: true,
      message:
        "ファイルの圧縮に成功しました。レスポンスの fileData をデコードしてzipファイルとして保存してください。",
      fileName: zippedFileName,
      mimeType: zippedBlob.getContentType(),
      fileData: zippedBase64Data,
    };
  } catch (error) {
    Logger.log(
      `[ERROR] compressAndReturnFile_ Catch Block: ${error.message}\nStack: ${
        error.stack || "No stack trace"
      }`
    );
    Logger.log("--- compressAndReturnFile_ End (Error) ---");

    return {
      success: false,
      message: `ファイル圧縮処理中にエラーが発生しました: ${error.message}`,
    };
  }
}

function doOptions(e) {
  Logger.log("------- doOptions Start -------");

  Logger.log("Returning CORS headers for OPTIONS request.");
  Logger.log("------- doOptions End -------");
  return ContentService.createTextOutput()
    .setHeader("Access-Control-Allow-Origin", "*")
    .setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
    .setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function getFolderSize_(folder) {
  let totalSize = 0;
  const files = folder.getFiles();
  let fileCount = 0;
  const MAX_FILES_TO_CHECK_SIZE = 2000;
  const startTime = Date.now();
  const TIME_LIMIT_MS = 30000;

  Logger.log(
    `Calculating folder size for "${folder.getName()}" (ID: ${folder.getId()}). Limit: ${MAX_FILES_TO_CHECK_SIZE} files or ${TIME_LIMIT_MS} ms.`
  );

  while (files.hasNext()) {
    if (Date.now() - startTime > TIME_LIMIT_MS) {
      Logger.log(
        `[WARN] Folder size calculation timed out after ${TIME_LIMIT_MS} ms. Checked ${fileCount} files. Size calculated so far: ${totalSize} bytes.`
      );
      break;
    }

    if (fileCount >= MAX_FILES_TO_CHECK_SIZE) {
      Logger.log(
        `[WARN] Folder size calculation reached file limit (${MAX_FILES_TO_CHECK_SIZE}). Total size might be underestimated. Size calculated so far: ${totalSize} bytes.`
      );
      break;
    }

    try {
      const file = files.next();

      if (!file.isTrashed()) {
        totalSize += file.getSize();
      }
      fileCount++;

      if (fileCount % 200 === 0) {
        Utilities.sleep(100);
        Logger.log(
          `...calculating size, checked ${fileCount} files, current total: ${(
            totalSize /
            1024 /
            1024
          ).toFixed(2)} MB`
        );
      }
    } catch (e) {
      Logger.log(
        `[WARN] Could not get size for a file during folder size calculation: ${e.message}`
      );
    }
  }
  Logger.log(
    `Finished folder size calculation for "${folder.getName()}". Checked ${fileCount} files. Total size: ${totalSize} bytes (${(
      totalSize /
      1024 /
      1024 /
      1024
    ).toFixed(3)} GB)`
  );
  return totalSize;
}

function getOrCreateFolder_(folderName) {
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    const folder = folders.next();

    if (folder.isTrashed()) {
      Logger.log(
        `[WARN] Folder "${folderName}" found but is in trash. Creating a new one.`
      );

      return DriveApp.createFolder(folderName);
    }

    Logger.log(
      `Using existing folder: ${folder.getName()} (ID: ${folder.getId()})`
    );
    return folder;
  } else {
    Logger.log(`フォルダ "${folderName}" が見つからなかったため、作成します。`);
    const folder = DriveApp.createFolder(folderName);
    Logger.log(`Created folder: ${folder.getName()} (ID: ${folder.getId()})`);

    return folder;
  }
}

function setupTriggerIfNotExists_() {
  const currentTriggers = ScriptApp.getProjectTriggers();
  const triggerExists = currentTriggers.some(
    (trigger) => trigger.getHandlerFunction() === TRIGGER_FUNCTION_NAME
  );

  if (!triggerExists) {
    try {
      Logger.log(
        `Setting up time-based trigger for ${TRIGGER_FUNCTION_NAME} (every ~${TRIGGER_INTERVAL_MINUTES} minutes).`
      );
      ScriptApp.newTrigger(TRIGGER_FUNCTION_NAME)
        .timeBased()
        .everyMinutes(TRIGGER_INTERVAL_MINUTES)
        .create();
      Logger.log(`Successfully created trigger for ${TRIGGER_FUNCTION_NAME}.`);
    } catch (error) {
      Logger.log(
        `[ERROR] Failed to create trigger for ${TRIGGER_FUNCTION_NAME}: ${error.message}. Manual setup might be required in the Apps Script editor.`
      );
    }
  } else {
    Logger.log(`Trigger for ${TRIGGER_FUNCTION_NAME} already exists.`);
  }
}

function deleteOldFilesPostBodyEncoded() {
  Logger.log(`------- ${TRIGGER_FUNCTION_NAME} Start -------`);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    Logger.log(
      `[WARN] Could not acquire lock for ${TRIGGER_FUNCTION_NAME}. Another instance might be running.`
    );
    return;
  }

  try {
    const folder = getOrCreateFolder_(UPLOAD_FOLDER_NAME);
    Logger.log(
      `Checking expired files in folder: ${folder.getName()} (ID: ${folder.getId()})`
    );
    const files = folder.getFiles();
    const now = Date.now();
    let deletedCount = 0;
    const MAX_DELETE_PER_RUN = 50;
    const fileCheckLimit = MAX_DELETE_PER_RUN * 5;
    let checkedCount = 0;
    const runStartTime = Date.now();
    const RUN_TIME_LIMIT_MS = 280 * 1000;

    while (
      files.hasNext() &&
      deletedCount < MAX_DELETE_PER_RUN &&
      checkedCount < fileCheckLimit
    ) {
      if (Date.now() - runStartTime > RUN_TIME_LIMIT_MS) {
        Logger.log(
          `[WARN] ${TRIGGER_FUNCTION_NAME} time limit reached near ${
            RUN_TIME_LIMIT_MS / 1000
          } seconds. Processed ${checkedCount} files, deleted ${deletedCount}.`
        );
        break;
      }
      checkedCount++;
      const file = files.next();
      try {
        if (file.isTrashed()) {
          continue;
        }
        const description = file.getDescription();
        if (description) {
          let metadata;
          try {
            metadata = JSON.parse(description);
          } catch (e) {
            Logger.log(
              `[WARN] Failed to parse description for file ${file.getName()} (ID: ${file.getId()}). Description: "${description}". Skipping.`
            );
            continue;
          }

          if (metadata && typeof metadata.deleteAt === "number") {
            if (now > metadata.deleteAt) {
              Logger.log(
                `Trashing expired file: ${file.getName()} (ID: ${file.getId()}), Expires: ${new Date(
                  metadata.deleteAt
                ).toLocaleString()}, Size: ${(
                  file.getSize() /
                  1024 /
                  1024
                ).toFixed(2)} MB`
              );
              file.setTrashed(true);
              deletedCount++;

              if (deletedCount % 10 === 0) {
                Utilities.sleep(1000);
              }
            } else {
            }
          } else {
            Logger.log(
              `[INFO] File ${file.getName()} (ID: ${file.getId()}) has missing or invalid 'deleteAt' metadata. Skipping deletion check.`
            );
          }
        } else {
          Logger.log(
            `[INFO] File ${file.getName()} (ID: ${file.getId()}) has no description. Skipping deletion check.`
          );
        }
      } catch (e) {
        Logger.log(
          `[ERROR] Error processing file ${file.getName()} (ID: ${file.getId()}) for deletion: ${
            e.message
          }`
        );
      }
    }

    if (deletedCount > 0) {
      Logger.log(
        `Successfully trashed ${deletedCount} expired files in this run.`
      );
    } else {
      Logger.log(
        `No expired files found to trash in this run (checked ${checkedCount} files).`
      );
    }

    if (
      files.hasNext() &&
      checkedCount >= fileCheckLimit &&
      deletedCount < MAX_DELETE_PER_RUN
    ) {
      Logger.log(
        `[INFO] Stopped checking files due to check limit (${fileCheckLimit}). More files might exist.`
      );
    }
    if (files.hasNext() && deletedCount >= MAX_DELETE_PER_RUN) {
      Logger.log(
        `[INFO] Reached deletion limit (${MAX_DELETE_PER_RUN}) for this run. More files might need deletion in the next run.`
      );
    }
  } catch (error) {
    Logger.log(
      `[ERROR] ${TRIGGER_FUNCTION_NAME} encountered a critical error: ${error.message}\nStack: ${error.stack}`
    );
  } finally {
    lock.releaseLock();
    Logger.log(`------- ${TRIGGER_FUNCTION_NAME} End -------`);
  }
}

function setupApi() {
  Logger.log("------- setupApi Start -------");
  try {
    getOrCreateFolder_(UPLOAD_FOLDER_NAME);
    Logger.log(`Folder "${UPLOAD_FOLDER_NAME}" is ready or created.`);

    setupTriggerIfNotExists_();
    const triggers = ScriptApp.getProjectTriggers();
    if (
      triggers.some((t) => t.getHandlerFunction() === TRIGGER_FUNCTION_NAME)
    ) {
      Logger.log(`Trigger for ${TRIGGER_FUNCTION_NAME} is configured.`);
      Logger.log(`✅ ${TRIGGER_FUNCTION_NAME} のトリガー設定を確認しました。`);
    } else {
      Logger.log(
        `[WARN] Trigger for ${TRIGGER_FUNCTION_NAME} could not be confirmed after setup attempt. Please check script permissions and triggers manually in the editor.`
      );
      Logger.log(
        `⚠️ ${TRIGGER_FUNCTION_NAME} のトリガー設定を確認できませんでした。エディタの「トリガー」メニューで手動での承認や設定が必要な場合があります。`
      );
    }

    const lock = LockService.getScriptLock();
    if (lock.tryLock(SCRIPT_LOCK_TIMEOUT_MS)) {
      try {
        const scriptProperties = PropertiesService.getScriptProperties();
        scriptProperties.deleteProperty(RATE_LIMIT_PROPERTY_KEY_COUNT);
        scriptProperties.deleteProperty(RATE_LIMIT_PROPERTY_KEY_TIMESTAMP);
        scriptProperties.deleteProperty(BLOCK_PROPERTY_KEY_BLOCKED);
        scriptProperties.deleteProperty(BLOCK_PROPERTY_KEY_RELEASE_TIME);
        Logger.log("Cleared rate limit and block status properties.");
      } catch (e) {
        Logger.log(
          `[ERROR] Failed to clear properties during setup: ${e.message}`
        );
      } finally {
        lock.releaseLock();
      }
    } else {
      Logger.log(
        "[WARN] Could not acquire lock to clear rate limit properties during setup. If issues persist, clear them manually via File > Project properties > Script properties."
      );
    }

    Logger.log("------- setupApi End (Success) -------");
    Logger.log("APIバックエンドのセットアップ処理が完了しました。");
    Logger.log(
      `次の手順: 1. [デプロイ] > [新しいデプロイ] を選択。 2. 種類を「ウェブアプリ」に設定。 3. アクセスできるユーザーを適切に設定（例: 全員）。 4. [デプロイ] ボタンをクリックし、承認プロセスを完了させ、表示されるウェブアプリURLを使用します。`
    );
  } catch (error) {
    Logger.log(
      `[ERROR] Failed during setupApi: ${error.message}\nStack: ${error.stack}`
    );
    Logger.log(`❌ セットアップ中にエラーが発生しました: ${error.message}`);
    Logger.log("------- setupApi End (Error) -------");
  }
}

function deleteAllApiTriggers() {
  Logger.log("------- deleteAllApiTriggers Start -------");
  let deletedCount = 0;
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(SCRIPT_LOCK_TIMEOUT_MS)) {
    Logger.log("[WARN] Could not acquire lock for trigger deletion. Aborting.");
    return;
  }

  try {
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach((trigger) => {
      if (trigger.getHandlerFunction() === TRIGGER_FUNCTION_NAME) {
        const triggerId = trigger.getUniqueId();
        Logger.log(
          `Deleting trigger ID: ${triggerId} (Handler: ${TRIGGER_FUNCTION_NAME})`
        );
        try {
          ScriptApp.deleteTrigger(trigger);
          Logger.log(`Successfully deleted trigger ID: ${triggerId}.`);
          deletedCount++;
        } catch (e) {
          Logger.log(
            `[ERROR] Failed to delete trigger ID ${triggerId}: ${e.message}`
          );
        }
      }
    });

    if (deletedCount > 0) {
      Logger.log(
        `Deleted ${deletedCount} triggers associated with ${TRIGGER_FUNCTION_NAME}.`
      );
      Logger.log(`✅ ${deletedCount} 個のトリガーを削除しました。`);
    } else {
      Logger.log(
        `No triggers found for handler function ${TRIGGER_FUNCTION_NAME} to delete.`
      );
      Logger.log(
        `ℹ️ 削除対象のトリガー (ハンドラ: ${TRIGGER_FUNCTION_NAME}) は見つかりませんでした。`
      );
    }

    try {
      const scriptProperties = PropertiesService.getScriptProperties();
      scriptProperties.deleteProperty(RATE_LIMIT_PROPERTY_KEY_COUNT);
      scriptProperties.deleteProperty(RATE_LIMIT_PROPERTY_KEY_TIMESTAMP);
      scriptProperties.deleteProperty(BLOCK_PROPERTY_KEY_BLOCKED);
      scriptProperties.deleteProperty(BLOCK_PROPERTY_KEY_RELEASE_TIME);
      Logger.log(
        "Cleared rate limit and block status properties during trigger deletion."
      );
    } catch (e) {
      Logger.log(
        `[ERROR] Failed to clear properties during trigger deletion: ${e.message}`
      );
    }
  } catch (error) {
    Logger.log(
      `[ERROR] Error during deleteAllApiTriggers: ${error.message}\nStack: ${error.stack}`
    );
    Logger.log(`❌ トリガー削除処理中にエラーが発生しました。`);
  } finally {
    lock.releaseLock();
    Logger.log("------- deleteAllApiTriggers End -------");
  }
}

function clearUploadFolder() {
  const folderNameToClear = UPLOAD_FOLDER_NAME;
  const BATCH_SIZE = 50;
  const SLEEP_MS = 1000;

  Logger.log(`------- clearUploadFolder Start -------`);
  Logger.log(
    `Attempting to clear folder: "${folderNameToClear}" by moving contents to trash.`
  );
  const ui = SpreadsheetApp.getUi();
  try {
    const folders = DriveApp.getFoldersByName(folderNameToClear);
    if (!folders.hasNext()) {
      Logger.log(
        `[INFO] Folder "${folderNameToClear}" not found. Nothing to clear.`
      );
      Logger.log(`------- clearUploadFolder End (Folder Not Found) -------`);
      return;
    }
    const folder = folders.next();

    if (folders.hasNext()) {
      Logger.log(
        `[WARN] Multiple folders found with the name "${folderNameToClear}". Processing only the first one found (ID: ${folder.getId()}). Please ensure this is the correct folder.`
      );
    }

    Logger.log(`Found folder: "${folder.getName()}" (ID: ${folder.getId()})`);

    let trashedFilesCount = 0;
    let trashedFoldersCount = 0;
    let processedItems = 0;
    const startTime = Date.now();
    const TIME_LIMIT_CLEAR_MS = 280 * 1000;

    Logger.log("Moving files to trash...");
    let files = folder.getFiles();
    while (files.hasNext()) {
      if (Date.now() - startTime > TIME_LIMIT_CLEAR_MS) {
        Logger.log(
          `[WARN] Time limit reached during file trashing. ${trashedFilesCount} files moved.`
        );
        break;
      }
      const file = files.next();
      try {
        if (!file.isTrashed()) {
          const fileName = file.getName();
          const fileId = file.getId();
          file.setTrashed(true);
          trashedFilesCount++;
          processedItems++;

          if (processedItems % BATCH_SIZE === 0) {
            Logger.log(
              `Processed ${processedItems} items, sleeping for ${SLEEP_MS} ms...`
            );
            Utilities.sleep(SLEEP_MS);
          }
        }
      } catch (e) {
        Logger.log(
          `[ERROR] Failed to trash file "${file.getName()}" (ID: ${file.getId()}): ${
            e.message
          }`
        );
        Utilities.sleep(500);
      }
    }
    Logger.log(
      `Finished moving files. Total files trashed in this run: ${trashedFilesCount}`
    );

    Logger.log("Moving subfolders to trash...");
    let subFolders = folder.getFolders();
    while (subFolders.hasNext()) {
      if (Date.now() - startTime > TIME_LIMIT_CLEAR_MS) {
        Logger.log(
          `[WARN] Time limit reached during subfolder trashing. ${trashedFoldersCount} subfolders moved.`
        );
        break;
      }
      const subFolder = subFolders.next();
      try {
        if (!subFolder.isTrashed()) {
          const subFolderName = subFolder.getName();
          const subFolderId = subFolder.getId();
          subFolder.setTrashed(true);
          trashedFoldersCount++;
          processedItems++;

          if (processedItems % BATCH_SIZE === 0) {
            Logger.log(
              `Processed ${processedItems} items, sleeping for ${SLEEP_MS} ms...`
            );
            Utilities.sleep(SLEEP_MS);
          }
        }
      } catch (e) {
        Logger.log(
          `[ERROR] Failed to trash subfolder "${subFolder.getName()}" (ID: ${subFolder.getId()}): ${
            e.message
          }`
        );
        Utilities.sleep(500);
      }
    }
    Logger.log(
      `Finished moving subfolders. Total subfolders trashed in this run: ${trashedFoldersCount}`
    );

    Logger.log(`--- Summary ---`);
    Logger.log(
      `Folder clear attempted for: "${folder.getName()}" (ID: ${folder.getId()})`
    );
    Logger.log(`Total files moved to trash in this run: ${trashedFilesCount}`);
    Logger.log(
      `Total subfolders moved to trash in this run: ${trashedFoldersCount}`
    );
    Logger.log(`Total items processed: ${processedItems}`);
    if (Date.now() - startTime > TIME_LIMIT_CLEAR_MS) {
      Logger.log(
        `[WARN] Process may have been interrupted due to time limits. Re-run if necessary.`
      );
    }
    Logger.log(`✅ Folder clearing process completed for this run.`);
  } catch (error) {
    Logger.log(
      `[ERROR] An error occurred during the folder clearing process: ${error.message}\nStack: ${error.stack}`
    );
    Logger.log(`❌ Folder clearing process failed.`);
  } finally {
    Logger.log(`------- clearUploadFolder End -------`);
  }
}
