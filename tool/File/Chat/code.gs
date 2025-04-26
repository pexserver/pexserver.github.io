
const LOG_SHEET_NAME = "ログ";
const ADMIN_SHEET_NAME = "スレッド管理";
const MAX_PRIVATE_THREADS = 10;
const FILTER_SHEET_NAME = "フィルタリングルール";

const PRIVATE_THREAD_LIFETIME_HOURS = 6;

const defaultThreads = [
    { id: "public_main", name: "総合メイン", type: "Public", status: "Active" },
    {
        id: "public_main2",
        name: "総合メイン２",
        type: "Public",
        status: "Active",
    },
    { id: "public_main3", name: "野獣の部屋", type: "Public", status: "Active" },
];



const ss = SpreadsheetApp.getActiveSpreadsheet();
const logSheet = ss.getSheetByName(LOG_SHEET_NAME);
const adminSheet = ss.getSheetByName(ADMIN_SHEET_NAME);


const COL_ADMIN = {
    THREAD_ID: 1,
    THREAD_NAME: 2,
    TYPE: 3,
    CREATED_AT: 4,
    EXPIRES_AT: 5,
    PASSWORD_HASH: 6,
    STATUS: 7,
};
const COL_LOG = { THREAD_ID: 1, TIMESTAMP: 2, NAME: 3, MESSAGE: 4 };


function doGet(e) {
    const template = HtmlService.createTemplateFromFile("index");
    template.requestedPageId = e.parameter.page || "";

    const htmlOutput = template
        .evaluate()
        .setTitle("マルチスレッドチャット v2.4")
        .addMetaTag("viewport", "width=device-width, initial-scale=1");

    htmlOutput.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

    return htmlOutput;
}




function getActiveThreadsApi() {
    try {
        cleanupExpiredThreads();
        const threads = fetchActiveThreads();
        return JSON.stringify({ status: "success", data: { threads: threads } });
    } catch (error) {
        Logger.log(`getActiveThreadsApi Error: ${error}`);
        return JSON.stringify({
            status: "error",
            message: `スレッドリスト取得エラー: ${error.message}`,
        });
    }
}


function createPrivateThreadApi(threadName, password) {
    try {
        if (
            !threadName ||
            threadName.trim() === "" ||
            !password ||
            password.trim() === ""
        ) {
            throw new Error("スレッド名と合言葉を入力してください。");
        }

        const activeThreads = fetchActiveThreads();
        const activePrivateCount = activeThreads.filter(
            (t) => t.type === "Private"
        ).length;

        if (activePrivateCount >= MAX_PRIVATE_THREADS) {
            throw new Error(
                `作成できるプライベートスレッドは最大${MAX_PRIVATE_THREADS}個までです。`
            );
        }

        const threadId = `private_${new Date().getTime()}`;
        const now = new Date();
        const expiresAt = new Date(
            now.getTime() + PRIVATE_THREAD_LIFETIME_HOURS * 60 * 60 * 1000
        );
        const passwordHash = computeSha256Hash(password);

        adminSheet.appendRow([
            threadId,
            threadName.trim(),
            "Private",
            now,
            expiresAt,
            passwordHash,
            "Active",
        ]);

        const newThread = {
            id: threadId,
            name: threadName.trim(),
            type: "Private",
        };
        return JSON.stringify({
            status: "success",
            data: { thread: newThread },
            message: "プライベートスレッドを作成しました。",
        });
    } catch (error) {
        Logger.log(`createPrivateThreadApi Error: ${error}`);
        return JSON.stringify({
            status: "error",
            message: `作成失敗: ${error.message}`,
        });
    }
}


function checkPrivateThreadAccessApi(threadId, password) {
    try {
        const threadInfo = findThreadInfo(threadId);

        if (!threadInfo) {
            return JSON.stringify({
                status: "error",
                data: { accessible: false },
                message: "スレッドが見つかりません。",
            });
        }
        if (threadInfo.type !== "Private") {
            return JSON.stringify({
                status: "error",
                data: { accessible: false },
                message: "これはプライベートスレッドではありません。",
            });
        }
        if (threadInfo.status !== "Active") {

            if (threadInfo.expiresAt && new Date(threadInfo.expiresAt) < new Date()) {
                updateThreadStatus(threadId, "Expired");
                return JSON.stringify({
                    status: "error",
                    data: { accessible: false },
                    message: "このスレッドは有効期限切れです。",
                });
            }
            return JSON.stringify({
                status: "error",
                data: { accessible: false },
                message: "このスレッドは現在アクティブではありません。",
            });
        }


        const inputHash = computeSha256Hash(password);
        if (inputHash !== threadInfo.passwordHash) {
            return JSON.stringify({
                status: "error",
                data: { accessible: false },
                message: "合言葉が違います。",
            });
        }


        return JSON.stringify({
            status: "success",
            data: {
                accessible: true,
                thread: {
                    id: threadInfo.id,
                    name: threadInfo.name,
                    type: threadInfo.type,
                },
            },
        });
    } catch (error) {
        Logger.log(`checkPrivateThreadAccessApi Error (ID: ${threadId}): ${error}`);
        return JSON.stringify({
            status: "error",
            data: { accessible: false },
            message: `アクセスチェックエラー: ${error.message}`,
        });
    }
}


function getMessagesApi(threadId, password) {
    try {
        if (!threadId) throw new Error("スレッドIDが必要です。");

        const threadInfo = findThreadInfo(threadId);
        if (!threadInfo) throw new Error("スレッドが見つかりません。");


        if (threadInfo.type === "Private") {
            if (!verifyPrivateAccess(threadInfo, password)) {

                throw new Error("合言葉が違うか、スレッドが無効です。");
            }
        } else if (threadInfo.status !== "Active") {
            throw new Error("このスレッドは現在利用できません。");
        }


        const messages = fetchMessagesForThread(threadId);
        return JSON.stringify({ status: "success", data: { messages: messages } });
    } catch (error) {
        Logger.log(`getMessagesApi Error (ID: ${threadId}): ${error}`);
        return JSON.stringify({
            status: "error",
            message: `メッセージ取得エラー: ${error.message}`,
        });
    }
}


function addMessageApi(threadId, name, message, password) {
    try {
        if (!threadId || !message || message.trim() === "") {
            throw new Error("スレッドIDとメッセージは必須です。");
        }

        const threadInfo = findThreadInfo(threadId);
        if (!threadInfo) throw new Error("スレッドが見つかりません。");


        if (threadInfo.type === "Private") {
            if (!verifyPrivateAccess(threadInfo, password)) {
                throw new Error("合言葉が違うか、スレッドが無効なため書き込めません。");
            }
        } else if (threadInfo.status !== "Active") {
            throw new Error("このスレッドには現在書き込みできません。");
        }


        const MAX_NAME_LENGTH = 20;
        let sanitizedName = name ? name.replace(/<.*?>/g, "").trim() : "名無しさん";
        if (sanitizedName.length > MAX_NAME_LENGTH) {
            sanitizedName = sanitizedName.substring(0, MAX_NAME_LENGTH);
        }
        if (sanitizedName === "") {

            sanitizedName = "名無しさん";
        }

        const sanitizedMessage = message.replace(/<.*?>/g, "");

        const filterRules = getFilterRules(); // フィルタリングルールを取得
        if (filterRules.length > 0) {
            const messageLowerCase = sanitizedMessage.toLowerCase(); 
            for (const rule of filterRules) {
                const ruleLowerCase = rule.toLowerCase(); 
                if (messageLowerCase.includes(ruleLowerCase)) {
                    Logger.log(`フィルタリングによりメッセージをブロック (Thread: ${threadId}, Rule: ${rule}, Message: ${message})`);
                    throw new Error("メッセージに不適切な単語が含まれているため、書き込みできません。");
                }
            }
        }

        logSheet.appendRow([threadId, new Date(), sanitizedName, sanitizedMessage]);

        return JSON.stringify({ status: "success", message: "書き込みました。" });
    } catch (error) {
        Logger.log(`addMessageApi Error (ID: ${threadId}): ${error}`);
        return JSON.stringify({
            status: "error",
            message: `書き込みエラー: ${error.message}`,
        });
    }
}



function cleanupExpiredThreads() {
    const now = new Date();
    const data = adminSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {

        const type = data[i][COL_ADMIN.TYPE - 1];
        const expiresAt = data[i][COL_ADMIN.EXPIRES_AT - 1];
        const status = data[i][COL_ADMIN.STATUS - 1];
        const threadId = data[i][COL_ADMIN.THREAD_ID - 1];

        if (
            type === "Private" &&
            status === "Active" &&
            expiresAt &&
            new Date(expiresAt) < now
        ) {
            updateThreadStatus(threadId, "Expired", i + 1);
        }
    }
}


function fetchActiveThreads() {
    cleanupExpiredThreads();
    const threads = [];
    const data = adminSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
        if (data[i][COL_ADMIN.STATUS - 1] === "Active") {
            threads.push({
                id: data[i][COL_ADMIN.THREAD_ID - 1],
                name: data[i][COL_ADMIN.THREAD_NAME - 1],
                type: data[i][COL_ADMIN.TYPE - 1],
            });
        }
    }
    return threads;
}


function fetchMessagesForThread(threadId) {
    const logData = logSheet.getDataRange().getValues();
    const messages = [];
    let messageCounter = 0;

    for (let i = 1; i < logData.length; i++) {

        if (logData[i][COL_LOG.THREAD_ID - 1] === threadId) {
            messageCounter++;
            const timestamp = logData[i][COL_LOG.TIMESTAMP - 1];
            const name = logData[i][COL_LOG.NAME - 1];
            const message = logData[i][COL_LOG.MESSAGE - 1];

            let dateObj = timestamp instanceof Date ? timestamp : new Date(timestamp);
            const formattedTimestamp = !isNaN(dateObj.getTime())
                ? Utilities.formatDate(
                    dateObj,
                    Session.getScriptTimeZone(),
                    "yyyy/MM/dd(E) HH:mm:ss"
                )
                : timestamp.toString();

            messages.push({
                number: messageCounter,
                name: name || "名無しさん",
                timestamp: formattedTimestamp,
                message: message ? message.toString() : "",
            });
        }
    }
    return messages;
}


function findThreadInfo(threadId) {
    const data = adminSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {

        if (data[i][COL_ADMIN.THREAD_ID - 1] === threadId) {
            return {
                id: data[i][COL_ADMIN.THREAD_ID - 1],
                name: data[i][COL_ADMIN.THREAD_NAME - 1],
                type: data[i][COL_ADMIN.TYPE - 1],
                createdAt: data[i][COL_ADMIN.CREATED_AT - 1],
                expiresAt: data[i][COL_ADMIN.EXPIRES_AT - 1],
                passwordHash: data[i][COL_ADMIN.PASSWORD_HASH - 1],
                status: data[i][COL_ADMIN.STATUS - 1],
                rowIndex: i + 1,
            };
        }
    }
    return null;
}


function updateThreadStatus(threadId, newStatus, rowIndex = null) {
    let targetRowIndex = rowIndex;
    if (!targetRowIndex) {
        const threadInfo = findThreadInfo(threadId);
        if (threadInfo) targetRowIndex = threadInfo.rowIndex;
    }

    if (targetRowIndex) {
        adminSheet.getRange(targetRowIndex, COL_ADMIN.STATUS).setValue(newStatus);
        Logger.log(`Thread ${threadId} status updated to ${newStatus}`);
    } else {
        Logger.log(`Failed to update status for thread ${threadId}: Not found.`);
    }
}


function verifyPrivateAccess(threadInfo, password) {
    if (!threadInfo || threadInfo.type !== "Private") return false;


    const now = new Date();
    if (threadInfo.status !== "Active") {
        if (threadInfo.expiresAt && new Date(threadInfo.expiresAt) < now) {
            if (threadInfo.status === "Active")
                updateThreadStatus(threadInfo.id, "Expired", threadInfo.rowIndex);
            return false;
        }

        return false;
    }


    const inputHash = computeSha256Hash(password);
    return inputHash === threadInfo.passwordHash;
}


function computeSha256Hash(input) {
    if (!input) return "";
    const rawHash = Utilities.computeDigest(
        Utilities.DigestAlgorithm.SHA_256,
        input,
        Utilities.Charset.UTF_8
    );
    let hash = "";
    for (let i = 0; i < rawHash.length; i++) {
        let byte = rawHash[i];
        if (byte < 0) byte += 256;
        const hex = byte.toString(16);
        hash += (hex.length === 1 ? "0" : "") + hex;
    }
    return hash;
}


function include(filename) {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
}


function getFilterRules() {
    const filterSheet = ss.getSheetByName(FILTER_SHEET_NAME);
    if (!filterSheet) {
        return [];
    }
    const data = filterSheet.getDataRange().getValues();
    const rules = [];


    for (let i = 0; i < data.length; i++) {
        const rule = data[i][0];
        if (typeof rule === "string" && rule.trim() !== "") {
            rules.push(rule.trim());
        }
    }
    return rules;
}


function setupSpreadsheet() {
    const ui = SpreadsheetApp.getUi();
    let messageLog = "スプレッドシート初期設定結果:\n\n";
    let sheetsCreated = [];
    let headersSet = [];
    let defaultThreadsAdded = [];

    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();


        const logSheetName = "ログ";
        let logSheet = ss.getSheetByName(logSheetName);
        if (!logSheet) {
            logSheet = ss.insertSheet(logSheetName);
            messageLog += `✅ 「${logSheetName}」シートを作成しました。\n`;
            sheetsCreated.push(logSheetName);
        } else {
            messageLog += `ℹ️ 「${logSheetName}」シートは既に存在します。\n`;
        }
        const logHeaders = [["ThreadID", "Timestamp", "Name", "Message"]];
        if (logSheet.getRange("A1").getValue() === "") {
            logSheet
                .getRange(1, 1, 1, logHeaders[0].length)
                .setValues(logHeaders)
                .setFontWeight("bold");
            logSheet.setColumnWidth(1, 150);
            logSheet.setColumnWidth(2, 180);
            logSheet.setColumnWidth(3, 120);
            logSheet.setColumnWidth(4, 400);
            logSheet.setFrozenRows(1);
            messageLog += `✅ 「${logSheetName}」シートにヘッダー行を設定しました。\n`;
            headersSet.push(logSheetName);
        } else {
            messageLog += `ℹ️ 「${logSheetName}」シートには既にヘッダーが存在するようです。\n`;
        }


        const adminSheetName = "スレッド管理";
        let adminSheet = ss.getSheetByName(adminSheetName);
        if (!adminSheet) {
            adminSheet = ss.insertSheet(adminSheetName);
            messageLog += `✅ 「${adminSheetName}」シートを作成しました。\n`;
            sheetsCreated.push(adminSheetName);
        } else {
            messageLog += `ℹ️ 「${adminSheetName}」シートは既に存在します。\n`;
        }
        const adminHeaders = [
            [
                "ThreadID",
                "ThreadName",
                "Type",
                "CreatedAt",
                "ExpiresAt",
                "PasswordHash",
                "Status",
            ],
        ];
        if (adminSheet.getRange("A1").getValue() === "") {
            adminSheet
                .getRange(1, 1, 1, adminHeaders[0].length)
                .setValues(adminHeaders)
                .setFontWeight("bold");
            adminSheet.setColumnWidth(1, 150);
            adminSheet.setColumnWidth(2, 200);
            adminSheet.setColumnWidth(3, 80);
            adminSheet.setColumnWidth(4, 180);
            adminSheet.setColumnWidth(5, 180);
            adminSheet.setColumnWidth(6, 150);
            adminSheet.setColumnWidth(7, 80);
            adminSheet.setFrozenRows(1);
            messageLog += `✅ 「${adminSheetName}」シートにヘッダー行を設定しました。\n`;
            headersSet.push(adminSheetName);
        } else {
            messageLog += `ℹ️ 「${adminSheetName}」シートには既にヘッダーが存在するようです。\n`;
        }


        const existingThreadIds = adminSheet
            .getDataRange()
            .getValues()
            .slice(1)
            .map((row) => row[COL_ADMIN.THREAD_ID - 1]);
        defaultThreads.forEach((thread) => {
            if (!existingThreadIds.includes(thread.id)) {
                adminSheet.appendRow([
                    thread.id,
                    thread.name,
                    thread.type,
                    "",
                    "",
                    "",
                    thread.status,
                ]);
                messageLog += `✅ デフォルトスレッド「${thread.name}」(${thread.id}) を追加しました。\n`;
                defaultThreadsAdded.push(thread.name);
            } else {
                messageLog += `ℹ️ デフォルトスレッド「${thread.name}」(${thread.id}) は既に存在します。\n`;
            }
        });


        const filterSheetNameConst = FILTER_SHEET_NAME;
        let filterSheet = ss.getSheetByName(filterSheetNameConst);
        if (!filterSheet) {
            filterSheet = ss.insertSheet(filterSheetNameConst);
            messageLog += `✅ 「${filterSheetNameConst}」シートを作成しました。\n`;
            sheetsCreated.push(filterSheetNameConst);

            filterSheet
                .getRange("A1")
                .setValue("禁止ワード/パターン")
                .setFontWeight("bold");
            filterSheet.setColumnWidth(1, 300);
            messageLog += `✅ 「${filterSheetNameConst}」シートにヘッダーを設定しました。\n`;
        } else {
            messageLog += `ℹ️ 「${filterSheetNameConst}」シートは既に存在します。\n`;
        }



        ui.alert("スプレッドシート初期設定完了", messageLog, ui.ButtonSet.OK);
    } catch (error) {
        Logger.log(`スプレッドシート設定エラー: ${error}`);
        ui.alert(
            "エラー",
            `スプレッドシートの初期設定中にエラーが発生しました。\n詳細: ${error.message}`,
            ui.ButtonSet.OK
        );
    }
}


function manageChatLogs() {
    const ui = SpreadsheetApp.getUi();


    const response = ui.prompt(
        'チャット/スレッド管理',
        '実行したい操作を選択してください:\n' +
        '--- ログ管理 ---\n' +
        '1: 古いログを削除 (日付指定)\n' +
        '2: 特定スレッドのログを全削除\n' +
        '3: 特定ユーザーのログを削除\n' +
        '4: 古いログを削除 (件数指定、スレッドごと)\n' +
        '5: フィルタリングに基づいてログを削除\n' +
        '--- スレッド管理 ---\n' +
        '6: 期限切れ(Expired)スレッドを全て削除\n' +
        '7: デフォルトを除く期限切れ(Expired)スレッドを削除\n' +
        'キャンセルするには空欄のままOKか、キャンセルボタンを押してください。',
        ui.ButtonSet.OK_CANCEL
    );

    const selectedOption = response.getResponseText();
    const button = response.getSelectedButton();

    if (button === ui.Button.CANCEL || button === ui.Button.CLOSE || selectedOption === '') {
        ui.alert('操作はキャンセルされました。');
        return;
    }

    try {
        switch (selectedOption) {

            case '1':
                deleteOldLogs();
                break;
            case '2':
                deleteThreadLogs();
                break;
            case '3':
                deleteUserLogs();
                break;
            case '4':
                deleteOldLogsByCount();
                break;
            case '5':
                deleteFilteredLogs();
                break;

            case '6':
                deleteExpiredThreads(true);
                break;
            case '7':
                deleteExpiredThreads(false);
                break;
            default:
                ui.alert('無効な選択です。「1」～「7」のいずれかを入力してください。');
                break;
        }
    } catch (error) {
        Logger.log(`管理エラー: ${error}`);
        ui.alert('エラー', `管理中にエラーが発生しました。\n詳細: ${error.message}`, ui.ButtonSet.OK);
    }
}


function deleteOldLogsByCount() {
    const ui = SpreadsheetApp.getUi();


    const threadResponse = ui.prompt(
        "古いログ削除 (件数指定)",
        "対象のスレッドIDを入力してください:",
        ui.ButtonSet.OK_CANCEL
    );
    const targetThreadId = threadResponse.getResponseText().trim();
    const threadButton = threadResponse.getSelectedButton();
    if (
        threadButton === ui.Button.CANCEL ||
        threadButton === ui.Button.CLOSE ||
        targetThreadId === ""
    ) {
        ui.alert("件数指定削除はキャンセルされました。");
        return;
    }


    const countResponse = ui.prompt(
        "古いログ削除 (件数指定)",
        `スレッド「${targetThreadId}」で、最新何件のログを残しますか？ (数字で入力)`,
        ui.ButtonSet.OK_CANCEL
    );
    const countText = countResponse.getResponseText();
    const countButton = countResponse.getSelectedButton();
    if (
        countButton === ui.Button.CANCEL ||
        countButton === ui.Button.CLOSE ||
        countText === ""
    ) {
        ui.alert("件数指定削除はキャンセルされました。");
        return;
    }
    const keepCount = parseInt(countText, 10);
    if (isNaN(keepCount) || keepCount < 0) {

        ui.alert(
            "エラー",
            "有効な0以上の整数を入力してください。",
            ui.ButtonSet.OK
        );
        return;
    }

    const confirmation = ui.alert(
        "確認",
        `スレッドID「${targetThreadId}」のログのうち、最新 ${keepCount} 件"以外" を完全に削除します。よろしいですか？\nこの操作は元に戻せません。`,
        ui.ButtonSet.YES_NO
    );

    if (confirmation !== ui.Button.YES) {
        ui.alert("件数指定削除はキャンセルされました。");
        return;
    }

    ui.showSidebar(
        HtmlService.createHtmlOutput(
            `<p>スレッド「${targetThreadId}」の古いログ（最新${keepCount}件を除く）を削除中です...</p>`
        ).setTitle("処理中")
    );

    const logSheet = ss.getSheetByName(LOG_SHEET_NAME);
    if (!logSheet) {
        SpreadsheetApp.getUi().alert(
            "エラー",
            `「${LOG_SHEET_NAME}」シートが見つかりません。`
        );
        return;
    }
    const data = logSheet.getDataRange().getValues();
    let deletedRowCount = 0;
    const threadLogs = [];


    for (let i = 1; i < data.length; i++) {
        if (data[i][COL_LOG.THREAD_ID - 1] === targetThreadId) {
            let timestamp = data[i][COL_LOG.TIMESTAMP - 1];
            let logDate;
            if (timestamp instanceof Date) {
                logDate = timestamp;
            } else if (
                typeof timestamp === "string" ||
                typeof timestamp === "number"
            ) {
                logDate = new Date(timestamp);
            } else {
                logDate = new Date(0);
            }
            if (isNaN(logDate.getTime())) logDate = new Date(0);

            threadLogs.push({ rowIndex: i + 1, timestamp: logDate });
        }
    }

    if (threadLogs.length <= keepCount) {

        SpreadsheetApp.getUi().showSidebar(
            HtmlService.createHtmlOutput("<p>処理が完了しました。</p>").setTitle(
                "完了"
            )
        );
        Utilities.sleep(2000);
        SpreadsheetApp.getUi().showSidebar(
            HtmlService.createHtmlOutput("").setTitle("")
        );
        ui.alert(
            "件数指定削除完了",
            `スレッド「${targetThreadId}」のログは ${threadLogs.length} 件で、指定された ${keepCount} 件以下だったため、削除は行われませんでした。`,
            ui.ButtonSet.OK
        );
        return;
    }


    threadLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());


    const rowsToDelete = threadLogs.slice(keepCount).map((log) => log.rowIndex);


    rowsToDelete.sort((a, b) => b - a);
    rowsToDelete.forEach((rowIndex) => {
        logSheet.deleteRow(rowIndex);
        deletedRowCount++;


    });

    SpreadsheetApp.getUi().showSidebar(
        HtmlService.createHtmlOutput("<p>処理が完了しました。</p>").setTitle("完了")
    );
    Utilities.sleep(2000);
    SpreadsheetApp.getUi().showSidebar(
        HtmlService.createHtmlOutput("").setTitle("")
    );

    ui.alert(
        "件数指定削除完了",
        `スレッドID「${targetThreadId}」のログ ${deletedRowCount}件を削除しました (最新${keepCount}件を除く)。`,
        ui.ButtonSet.OK
    );
    Logger.log(
        `スレッドID「${targetThreadId}」のログ ${deletedRowCount}件を削除しました (最新${keepCount}件を除く)。`
    );
}


function deleteUserLogs() {
    const ui = SpreadsheetApp.getUi();
    const response = ui.prompt(
        "特定ユーザーのログ削除",
        '削除したいユーザーのIDを入力してください (例: ID:abcd の "abcd" 部分)。\n大文字小文字は区別されます。',
        ui.ButtonSet.OK_CANCEL
    );

    const userIdPrefix = response.getResponseText().trim();
    const button = response.getSelectedButton();

    if (
        button === ui.Button.CANCEL ||
        button === ui.Button.CLOSE ||
        userIdPrefix === ""
    ) {
        ui.alert("ユーザーログの削除はキャンセルされました。");
        return;
    }


    const targetNamePrefix = `ID:${userIdPrefix} `;

    const confirmation = ui.alert(
        "確認",
        `名前が「${targetNamePrefix}...」で始まるユーザーのすべてのログを完全に削除します。よろしいですか？\nこの操作は元に戻せません。`,
        ui.ButtonSet.YES_NO
    );

    if (confirmation !== ui.Button.YES) {
        ui.alert("ユーザーログの削除はキャンセルされました。");
        return;
    }

    ui.showSidebar(
        HtmlService.createHtmlOutput(
            `<p>ユーザー「${targetNamePrefix}...」のログを削除中です... 少々お待ちください。</p>`
        ).setTitle("処理中")
    );

    const logSheet = ss.getSheetByName(LOG_SHEET_NAME);
    if (!logSheet) {
        SpreadsheetApp.getUi().alert(
            "エラー",
            `「${LOG_SHEET_NAME}」シートが見つかりません。`
        );
        return;
    }
    const data = logSheet.getDataRange().getValues();
    let deletedRowCount = 0;
    const rowsToDelete = [];


    for (let i = data.length - 1; i >= 1; i--) {

        const name = data[i][COL_LOG.NAME - 1];
        if (typeof name === "string" && name.startsWith(targetNamePrefix)) {
            rowsToDelete.push(i + 1);
        }
    }


    rowsToDelete.forEach((rowIndex) => {
        logSheet.deleteRow(rowIndex);
        deletedRowCount++;


    });

    SpreadsheetApp.getUi().showSidebar(
        HtmlService.createHtmlOutput("<p>処理が完了しました。</p>").setTitle("完了")
    );
    Utilities.sleep(2000);
    SpreadsheetApp.getUi().showSidebar(
        HtmlService.createHtmlOutput("").setTitle("")
    );

    if (deletedRowCount > 0) {
        ui.alert(
            "ユーザーログ削除完了",
            `ユーザー名が「${targetNamePrefix}...」で始まるログ ${deletedRowCount}件を削除しました。`,
            ui.ButtonSet.OK
        );
        Logger.log(
            `ユーザー名が「${targetNamePrefix}...」で始まるログ ${deletedRowCount}件を削除しました。`
        );
    } else {
        ui.alert(
            "ユーザーログ削除完了",
            `ユーザー名が「${targetNamePrefix}...」で始まるログは見つかりませんでした。`,
            ui.ButtonSet.OK
        );
        Logger.log(
            `ユーザー名が「${targetNamePrefix}...」で始まるログ削除を実行しましたが、対象ログはありませんでした。`
        );
    }
}


function deleteOldLogs() {
    const ui = SpreadsheetApp.getUi();
    const response = ui.prompt(
        "古いログの削除",
        "何日以上経過したログを削除しますか？ (数字で入力)",
        ui.ButtonSet.OK_CANCEL
    );

    const daysText = response.getResponseText();
    const button = response.getSelectedButton();

    if (
        button === ui.Button.CANCEL ||
        button === ui.Button.CLOSE ||
        daysText === ""
    ) {
        ui.alert("古いログの削除はキャンセルされました。");
        return;
    }

    const days = parseInt(daysText, 10);
    if (isNaN(days) || days <= 0) {
        ui.alert("エラー", "有効な正の整数を入力してください。", ui.ButtonSet.OK);
        return;
    }

    const confirmation = ui.alert(
        "確認",
        `${days}日以上経過したすべてのログを完全に削除します。よろしいですか？\nこの操作は元に戻せません。`,
        ui.ButtonSet.YES_NO
    );

    if (confirmation !== ui.Button.YES) {
        ui.alert("古いログの削除はキャンセルされました。");
        return;
    }

    ui.showSidebar(
        HtmlService.createHtmlOutput(
            "<p>古いログを削除中です... 少々お待ちください。</p>"
        ).setTitle("処理中")
    );

    const logSheet = ss.getSheetByName(LOG_SHEET_NAME);
    if (!logSheet) {
        SpreadsheetApp.getUi().alert(
            "エラー",
            `「${LOG_SHEET_NAME}」シートが見つかりません。`
        );
        return;
    }
    const data = logSheet.getDataRange().getValues();
    const now = new Date();
    const thresholdDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    let deletedRowCount = 0;
    const rowsToDelete = [];


    for (let i = data.length - 1; i >= 1; i--) {

        const timestamp = data[i][COL_LOG.TIMESTAMP - 1];
        let logDate;
        if (timestamp instanceof Date) {
            logDate = timestamp;
        } else if (typeof timestamp === "string" || typeof timestamp === "number") {
            logDate = new Date(timestamp);
        } else {
            continue;
        }

        if (!isNaN(logDate.getTime()) && logDate < thresholdDate) {
            rowsToDelete.push(i + 1);
        }
    }



    rowsToDelete.forEach((rowIndex) => {
        logSheet.deleteRow(rowIndex);
        deletedRowCount++;



    });

    SpreadsheetApp.getUi().showSidebar(
        HtmlService.createHtmlOutput("<p>処理が完了しました。</p>").setTitle("完了")
    );
    Utilities.sleep(2000);
    SpreadsheetApp.getUi().showSidebar(
        HtmlService.createHtmlOutput("").setTitle("")
    );

    ui.alert(
        "古いログ削除完了",
        `${deletedRowCount}件の古いログを削除しました。`,
        ui.ButtonSet.OK
    );
    Logger.log(
        `${deletedRowCount}件の古いログを削除しました (${days}日以上経過)。`
    );
}


function deleteThreadLogs() {
    const ui = SpreadsheetApp.getUi();
    const response = ui.prompt(
        "特定スレッドのログ削除",
        "ログを削除したいスレッドのIDを入力してください:",
        ui.ButtonSet.OK_CANCEL
    );

    const threadIdToDelete = response.getResponseText().trim();
    const button = response.getSelectedButton();

    if (
        button === ui.Button.CANCEL ||
        button === ui.Button.CLOSE ||
        threadIdToDelete === ""
    ) {
        ui.alert("特定スレッドのログ削除はキャンセルされました。");
        return;
    }

    const confirmation = ui.alert(
        "確認",
        `スレッドID「${threadIdToDelete}」のすべてのログを完全に削除します。よろしいですか？\nこの操作は元に戻せません。`,
        ui.ButtonSet.YES_NO
    );

    if (confirmation !== ui.Button.YES) {
        ui.alert("特定スレッドのログ削除はキャンセルされました。");
        return;
    }

    ui.showSidebar(
        HtmlService.createHtmlOutput(
            "<p>スレッドログを削除中です... 少々お待ちください。</p>"
        ).setTitle("処理中")
    );

    const logSheet = ss.getSheetByName(LOG_SHEET_NAME);
    if (!logSheet) {
        SpreadsheetApp.getUi().alert(
            "エラー",
            `「${LOG_SHEET_NAME}」シートが見つかりません。`
        );
        return;
    }
    const data = logSheet.getDataRange().getValues();
    let deletedRowCount = 0;
    const rowsToDelete = [];


    for (let i = data.length - 1; i >= 1; i--) {

        if (data[i][COL_LOG.THREAD_ID - 1] === threadIdToDelete) {
            rowsToDelete.push(i + 1);
        }
    }


    rowsToDelete.forEach((rowIndex) => {
        logSheet.deleteRow(rowIndex);
        deletedRowCount++;


    });

    SpreadsheetApp.getUi().showSidebar(
        HtmlService.createHtmlOutput("<p>処理が完了しました。</p>").setTitle("完了")
    );
    Utilities.sleep(2000);
    SpreadsheetApp.getUi().showSidebar(
        HtmlService.createHtmlOutput("").setTitle("")
    );

    if (deletedRowCount > 0) {
        ui.alert(
            "スレッドログ削除完了",
            `スレッドID「${threadIdToDelete}」のログ ${deletedRowCount}件を削除しました。`,
            ui.ButtonSet.OK
        );
        Logger.log(
            `スレッドID「${threadIdToDelete}」のログ ${deletedRowCount}件を削除しました。`
        );
    } else {
        ui.alert(
            "スレッドログ削除完了",
            `スレッドID「${threadIdToDelete}」のログは見つかりませんでした。`,
            ui.ButtonSet.OK
        );
        Logger.log(
            `スレッドID「${threadIdToDelete}」のログ削除を実行しましたが、対象ログはありませんでした。`
        );
    }
}


function deleteFilteredLogs() {
    const ui = SpreadsheetApp.getUi();


    const filterRules = getFilterRules();
    if (filterRules.length === 0) {
        ui.alert(
            "フィルタリングルールが見つかりません。",
            `「${FILTER_SHEET_NAME}」シートが存在しないか、ルールが入力されていません。`,
            ui.ButtonSet.OK
        );
        return;
    }

    const confirmation = ui.alert(
        "確認",
        `${filterRules.length}件のフィルタリングルールが見つかりました。\n` +
        `これらのルールに一致するメッセージを含むログをすべて完全に削除します。\n` +
        `（処理には時間がかかる場合があります）\n\nよろしいですか？\nこの操作は元に戻せません。`,
        ui.ButtonSet.YES_NO
    );

    if (confirmation !== ui.Button.YES) {
        ui.alert("フィルタリングによるログ削除はキャンセルされました。");
        return;
    }

    ui.showSidebar(
        HtmlService.createHtmlOutput(
            "<p>フィルタリングルールに基づいてログを検索・削除中です... 少々お待ちください。</p>"
        ).setTitle("処理中")
    );

    const logSheet = ss.getSheetByName(LOG_SHEET_NAME);
    if (!logSheet) {
        SpreadsheetApp.getUi().alert(
            "エラー",
            `「${LOG_SHEET_NAME}」シートが見つかりません。`
        );

        SpreadsheetApp.getUi().showSidebar(
            HtmlService.createHtmlOutput("").setTitle("")
        );
        return;
    }
    const data = logSheet.getDataRange().getValues();
    let deletedRowCount = 0;
    const rowsToDelete = [];


    for (let i = data.length - 1; i >= 1; i--) {

        const message = data[i][COL_LOG.MESSAGE - 1];
        if (typeof message === "string" && message !== "") {
            const messageLowerCase = message.toLowerCase();


            for (const rule of filterRules) {
                if (messageLowerCase.includes(rule.toLowerCase())) {
                    rowsToDelete.push(i + 1);
                    break;
                }
            }
        }
    }


    if (rowsToDelete.length > 0) {
        rowsToDelete.sort((a, b) => b - a);
        rowsToDelete.forEach((rowIndex) => {
            logSheet.deleteRow(rowIndex);
            deletedRowCount++;


        });
        SpreadsheetApp.getUi().showSidebar(
            HtmlService.createHtmlOutput("<p>処理が完了しました。</p>").setTitle(
                "完了"
            )
        );
    } else {
        SpreadsheetApp.getUi().showSidebar(
            HtmlService.createHtmlOutput(
                "<p>該当するログはありませんでした。</p>"
            ).setTitle("完了")
        );
    }

    Utilities.sleep(2000);
    SpreadsheetApp.getUi().showSidebar(
        HtmlService.createHtmlOutput("").setTitle("")
    );

    ui.alert(
        "フィルタリングによるログ削除完了",
        `フィルタリングルールに一致した ${deletedRowCount}件のログを削除しました。`,
        ui.ButtonSet.OK
    );
    Logger.log(
        `フィルタリングルールに基づいて ${deletedRowCount}件のログを削除しました。`
    );
}



function deleteExpiredThreads(deleteAll = false) {
    const ui = SpreadsheetApp.getUi();
    const adminSheet = ss.getSheetByName(ADMIN_SHEET_NAME);
    const logSheet = ss.getSheetByName(LOG_SHEET_NAME);

    if (!adminSheet || !logSheet) {
        ui.alert('エラー', `「${ADMIN_SHEET_NAME}」または「${LOG_SHEET_NAME}」シートが見つかりません。`);
        return;
    }


    const excludedThreadIds = deleteAll ? [] : defaultThreads.map(t => t.id);
    const operationDescription = deleteAll
        ? "全ての期限切れ(Expired)スレッド"
        : `デフォルトスレッド (${excludedThreadIds.join(', ')}) を除く期限切れ(Expired)スレッド`;

    const confirmation = ui.alert(
        '確認',
        `${operationDescription}とその関連ログを完全に削除します。\n\nこの操作は元に戻せません。\nよろしいですか？`,
        ui.ButtonSet.YES_NO
    );

    if (confirmation !== ui.Button.YES) {
        ui.alert('期限切れスレッドの削除はキャンセルされました。');
        return;
    }

    ui.showSidebar(HtmlService.createHtmlOutput(`<p>${operationDescription}を削除中です... (ログが多いと時間がかかります)</p>`).setTitle('処理中'));

    const adminData = adminSheet.getDataRange().getValues();
    const logData = logSheet.getDataRange().getValues();

    const expiredThreadsToDelete = [];
    const logsToDeleteIndexes = [];
    let deletedThreadCount = 0;
    let deletedLogCount = 0;


    const threadIdsToDelete = new Set();
    for (let i = adminData.length - 1; i >= 1; i--) {
        const threadId = adminData[i][COL_ADMIN.THREAD_ID - 1];
        const status = adminData[i][COL_ADMIN.STATUS - 1];

        if (status === 'Expired') {

            if (deleteAll || !excludedThreadIds.includes(threadId)) {
                expiredThreadsToDelete.push({ threadId: threadId, rowIndex: i + 1 });
                threadIdsToDelete.add(threadId);
            }
        }
    }

    if (expiredThreadsToDelete.length === 0) {
        SpreadsheetApp.getUi().showSidebar(HtmlService.createHtmlOutput('<p>対象のスレッドはありませんでした。</p>').setTitle('完了'));
        Utilities.sleep(2000);
        SpreadsheetApp.getUi().showSidebar(HtmlService.createHtmlOutput('').setTitle(''));
        ui.alert('完了', '削除対象の期限切れスレッドは見つかりませんでした。', ui.ButtonSet.OK);
        return;
    }


    for (let i = logData.length - 1; i >= 1; i--) {
        const logThreadId = logData[i][COL_LOG.THREAD_ID - 1];
        if (threadIdsToDelete.has(logThreadId)) {
            logsToDeleteIndexes.push(i + 1);
        }
    }



    logsToDeleteIndexes.sort((a, b) => b - a);
    logsToDeleteIndexes.forEach(rowIndex => {
        try {
            logSheet.deleteRow(rowIndex);
            deletedLogCount++;
        } catch (e) {
            Logger.log(`ログ行 ${rowIndex} の削除中にエラー: ${e}`);
        }


    });



    expiredThreadsToDelete.sort((a, b) => b.rowIndex - a.rowIndex);
    expiredThreadsToDelete.forEach(threadInfo => {
        try {
            adminSheet.deleteRow(threadInfo.rowIndex);
            deletedThreadCount++;
        } catch (e) {
            Logger.log(`スレッド行 ${threadInfo.rowIndex} (${threadInfo.threadId}) の削除中にエラー: ${e}`);
        }


    });

    SpreadsheetApp.getUi().showSidebar(HtmlService.createHtmlOutput('<p>処理が完了しました。</p>').setTitle('完了'));
    Utilities.sleep(2000);
    SpreadsheetApp.getUi().showSidebar(HtmlService.createHtmlOutput('').setTitle(''));

    ui.alert('期限切れスレッド削除完了',
        `${deletedThreadCount}件の期限切れスレッドと、関連する${deletedLogCount}件のログを削除しました。`,
        ui.ButtonSet.OK);
    Logger.log(`${deletedThreadCount}件の期限切れスレッド (モード: ${deleteAll ? 'all' : 'exclude default'}) と ${deletedLogCount}件の関連ログを削除しました。`);
}


function onOpen() {
    SpreadsheetApp.getUi()
        .createMenu("チャット管理")
        .addItem("シート初期設定", "setupSpreadsheet")
        .addItem("チャットログ管理", "manageChatLogs")
        .addToUi();
}
