// ---- シート設定 ----
const LOG_SHEET_NAME = 'ログ';
const ADMIN_SHEET_NAME = 'スレッド管理';
const MAX_PRIVATE_THREADS = 10;
const PRIVATE_THREAD_LIFETIME_HOURS = 6;

const defaultThreads = [
    { id: 'public_main', name: '総合メイン', type: 'Public', status: 'Active' },
    { id: 'public_main2', name: '総合メイン２', type: 'Public', status: 'Active' },
    { id: 'public_main3', name: '野獣の部屋', type: 'Public', status: 'Active' }
];

// ---- 設定ここまで ----

const ss = SpreadsheetApp.getActiveSpreadsheet();
const logSheet = ss.getSheetByName(LOG_SHEET_NAME);
const adminSheet = ss.getSheetByName(ADMIN_SHEET_NAME);

// 列インデックス定数 (1始まり)
const COL_ADMIN = { THREAD_ID: 1, THREAD_NAME: 2, TYPE: 3, CREATED_AT: 4, EXPIRES_AT: 5, PASSWORD_HASH: 6, STATUS: 7 };
const COL_LOG = { THREAD_ID: 1, TIMESTAMP: 2, NAME: 3, MESSAGE: 4 };

// === Web App Entry Point ===
function doGet(e) {
    const template = HtmlService.createTemplateFromFile('index');
    template.requestedPageId = e.parameter.page || ''; 

    const htmlOutput = template.evaluate()
        .setTitle('マルチスレッドチャット v2.3 (スマホ最適化)')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1'); 

    htmlOutput.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    

    return htmlOutput;
}

// === API Functions (Called from JavaScript) ===

/**
 * アクティブなスレッドリストを取得
 * @returns {string} JSON文字列 { status: 'success'/'error', data?: { threads: Array<object> }, message?: string }
 */
function getActiveThreadsApi() {
    try {
        cleanupExpiredThreads(); // 取得前に期限切れチェック&更新
        const threads = fetchActiveThreads();
        return JSON.stringify({ status: 'success', data: { threads: threads } });
    } catch (error) {
        Logger.log(`getActiveThreadsApi Error: ${error}`);
        return JSON.stringify({ status: 'error', message: `スレッドリスト取得エラー: ${error.message}` });
    }
}

/**
 * 新しいプライベートスレッドを作成
 * @param {string} threadName
 * @param {string} password
 * @returns {string} JSON文字列 { status: 'success'/'error', data?: { thread: object }, message?: string }
 */
function createPrivateThreadApi(threadName, password) {
    try {
        if (!threadName || threadName.trim() === '' || !password || password.trim() === '') {
            throw new Error('スレッド名と合言葉を入力してください。');
        }

        const activeThreads = fetchActiveThreads(); // cleanupExpiredThreadsは中で呼ばれる
        const activePrivateCount = activeThreads.filter(t => t.type === 'Private').length;

        if (activePrivateCount >= MAX_PRIVATE_THREADS) {
            throw new Error(`作成できるプライベートスレッドは最大${MAX_PRIVATE_THREADS}個までです。`);
        }

        const threadId = `private_${new Date().getTime()}`;
        const now = new Date();
        const expiresAt = new Date(now.getTime() + PRIVATE_THREAD_LIFETIME_HOURS * 60 * 60 * 1000);
        const passwordHash = computeSha256Hash(password);

        adminSheet.appendRow([
            threadId, threadName.trim(), 'Private', now, expiresAt, passwordHash, 'Active'
        ]);

        const newThread = { id: threadId, name: threadName.trim(), type: 'Private' };
        return JSON.stringify({ status: 'success', data: { thread: newThread }, message: 'プライベートスレッドを作成しました。' });

    } catch (error) {
        Logger.log(`createPrivateThreadApi Error: ${error}`);
        return JSON.stringify({ status: 'error', message: `作成失敗: ${error.message}` });
    }
}

/**
 * 指定されたプライベートスレッドへのアクセス権を確認
 * @param {string} threadId
 * @param {string} password
 * @returns {string} JSON文字列 { status: 'success'/'error', data?: { accessible: boolean, thread: object }, message?: string }
 */
function checkPrivateThreadAccessApi(threadId, password) {
    try {
        const threadInfo = findThreadInfo(threadId);

        if (!threadInfo) {
            return JSON.stringify({ status: 'error', data: { accessible: false }, message: 'スレッドが見つかりません。' });
        }
        if (threadInfo.type !== 'Private') {
            return JSON.stringify({ status: 'error', data: { accessible: false }, message: 'これはプライベートスレッドではありません。' });
        }
        if (threadInfo.status !== 'Active') {
            // 期限切れチェック
            if (threadInfo.expiresAt && new Date(threadInfo.expiresAt) < new Date()) {
                updateThreadStatus(threadId, 'Expired'); // ステータス更新
                return JSON.stringify({ status: 'error', data: { accessible: false }, message: 'このスレッドは有効期限切れです。' });
            }
            return JSON.stringify({ status: 'error', data: { accessible: false }, message: 'このスレッドは現在アクティブではありません。' });
        }

        // 合言葉チェック
        const inputHash = computeSha256Hash(password);
        if (inputHash !== threadInfo.passwordHash) {
            return JSON.stringify({ status: 'error', data: { accessible: false }, message: '合言葉が違います。' });
        }

        // アクセス可能
        return JSON.stringify({ status: 'success', data: { accessible: true, thread: { id: threadInfo.id, name: threadInfo.name, type: threadInfo.type } } });

    } catch (error) {
        Logger.log(`checkPrivateThreadAccessApi Error (ID: ${threadId}): ${error}`);
        return JSON.stringify({ status: 'error', data: { accessible: false }, message: `アクセスチェックエラー: ${error.message}` });
    }
}


/**
 * 指定されたスレッドのメッセージを取得
 * @param {string} threadId
 * @param {string} [password] Privateスレッドの場合の合言葉
 * @returns {string} JSON文字列 { status: 'success'/'error', data?: { messages: Array<object> }, message?: string }
 */
function getMessagesApi(threadId, password) {
    try {
        if (!threadId) throw new Error("スレッドIDが必要です。");

        const threadInfo = findThreadInfo(threadId);
        if (!threadInfo) throw new Error("スレッドが見つかりません。");

        // アクセス権チェック
        if (threadInfo.type === 'Private') {
            if (!verifyPrivateAccess(threadInfo, password)) { // verify内で期限チェック＆更新も行う
                throw new Error("合言葉が違うか、スレッドが無効です。");
            }
        } else if (threadInfo.status !== 'Active') {
            throw new Error("このスレッドは現在利用できません。");
        }

        // メッセージ取得
        const messages = fetchMessagesForThread(threadId);
        return JSON.stringify({ status: 'success', data: { messages: messages } });

    } catch (error) {
        Logger.log(`getMessagesApi Error (ID: ${threadId}): ${error}`);
        return JSON.stringify({ status: 'error', message: `メッセージ取得エラー: ${error.message}` });
    }
}

/**
 * 指定されたスレッドにメッセージを追加
 * @param {string} threadId
 * @param {string} name
 * @param {string} message
 * @param {string} [password] Privateスレッドの場合の合言葉
 * @returns {string} JSON文字列 { status: 'success'/'error', message?: string }
 */
function addMessageApi(threadId, name, message, password) {
    try {
        if (!threadId || !message || message.trim() === '') {
            throw new Error('スレッドIDとメッセージは必須です。');
        }

        const threadInfo = findThreadInfo(threadId);
        if (!threadInfo) throw new Error("スレッドが見つかりません。");

        // アクセス権チェック
        if (threadInfo.type === 'Private') {
            if (!verifyPrivateAccess(threadInfo, password)) {
                throw new Error("合言葉が違うか、スレッドが無効なため書き込めません。");
            }
        } else if (threadInfo.status !== 'Active') {
            throw new Error("このスレッドには現在書き込みできません。");
        }

        // サニタイズ & 書き込み
        const MAX_NAME_LENGTH = 20; // 名前の最大文字数を10に変更
        let sanitizedName = name ? name.replace(/<.*?>/g, '').trim() : '名無しさん';
        if (sanitizedName.length > MAX_NAME_LENGTH) {
            sanitizedName = sanitizedName.substring(0, MAX_NAME_LENGTH); // 最大文字数で切り捨てる
        }
        if (sanitizedName === '') { // 空になった場合はデフォルト名にする
            sanitizedName = '名無しさん';
        }

        const sanitizedMessage = message.replace(/<.*?>/g, ''); // メッセージのサニタイズは維持
        logSheet.appendRow([threadId, new Date(), sanitizedName, sanitizedMessage]);

        return JSON.stringify({ status: 'success', message: '書き込みました。' });

    } catch (error) {
        Logger.log(`addMessageApi Error (ID: ${threadId}): ${error}`);
        return JSON.stringify({ status: 'error', message: `書き込みエラー: ${error.message}` });
    }
}
// === Internal Helper Functions ===

/**
 * 期限切れのプライベートスレッドをチェックし、ステータスを 'Expired' に更新する
 */
function cleanupExpiredThreads() {
    const now = new Date();
    const data = adminSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) { // ヘッダー除く
        const type = data[i][COL_ADMIN.TYPE - 1];
        const expiresAt = data[i][COL_ADMIN.EXPIRES_AT - 1];
        const status = data[i][COL_ADMIN.STATUS - 1];
        const threadId = data[i][COL_ADMIN.THREAD_ID - 1];

        if (type === 'Private' && status === 'Active' && expiresAt && new Date(expiresAt) < now) {
            updateThreadStatus(threadId, 'Expired', i + 1); // 行番号を渡して効率化
        }
    }
}

/**
 * アクティブなスレッド情報をスプレッドシートから取得
 * @returns {Array<object>} {id, name, type} の配列
 */
function fetchActiveThreads() {
    cleanupExpiredThreads(); // 最新の状態にする
    const threads = [];
    const data = adminSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
        if (data[i][COL_ADMIN.STATUS - 1] === 'Active') {
            threads.push({
                id: data[i][COL_ADMIN.THREAD_ID - 1],
                name: data[i][COL_ADMIN.THREAD_NAME - 1],
                type: data[i][COL_ADMIN.TYPE - 1]
            });
        }
    }
    return threads;
}

/**
 * 指定スレッドIDのメッセージを取得
 * @param {string} threadId
 * @returns {Array<object>} {number, name, timestamp, message} の配列
 */
function fetchMessagesForThread(threadId) {
    const logData = logSheet.getDataRange().getValues();
    const messages = [];
    let messageCounter = 0;

    for (let i = 1; i < logData.length; i++) { // ヘッダー除く
        if (logData[i][COL_LOG.THREAD_ID - 1] === threadId) {
            messageCounter++;
            const timestamp = logData[i][COL_LOG.TIMESTAMP - 1];
            const name = logData[i][COL_LOG.NAME - 1];
            const message = logData[i][COL_LOG.MESSAGE - 1];

            let dateObj = timestamp instanceof Date ? timestamp : new Date(timestamp);
            const formattedTimestamp = !isNaN(dateObj.getTime())
                ? Utilities.formatDate(dateObj, Session.getScriptTimeZone(), 'yyyy/MM/dd(E) HH:mm:ss')
                : timestamp.toString();

            messages.push({
                number: messageCounter,
                name: name || '名無しさん',
                timestamp: formattedTimestamp,
                message: message ? message.toString() : ''
            });
        }
    }
    return messages;
}


/**
 * スレッドIDからスレッド情報を取得
 * @param {string} threadId
 * @returns {object|null} スレッド情報オブジェクト or null {id, name, type, ..., rowIndex}
 */
function findThreadInfo(threadId) {
    const data = adminSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) { // ヘッダー除く
        if (data[i][COL_ADMIN.THREAD_ID - 1] === threadId) {
            return {
                id: data[i][COL_ADMIN.THREAD_ID - 1],
                name: data[i][COL_ADMIN.THREAD_NAME - 1],
                type: data[i][COL_ADMIN.TYPE - 1],
                createdAt: data[i][COL_ADMIN.CREATED_AT - 1],
                expiresAt: data[i][COL_ADMIN.EXPIRES_AT - 1],
                passwordHash: data[i][COL_ADMIN.PASSWORD_HASH - 1],
                status: data[i][COL_ADMIN.STATUS - 1],
                rowIndex: i + 1 // 行番号
            };
        }
    }
    return null;
}

/**
 * スレッドのステータスを更新
 * @param {string} threadId 更新するスレッドID
 * @param {string} newStatus 新しいステータス ('Active' or 'Expired')
 * @param {number} [rowIndex] 行番号 (分かっていれば指定、なければfindThreadInfoで検索)
 */
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

/**
 * Privateスレッドの合言葉と有効期限を検証
 * @param {object} threadInfo findThreadInfoで取得したスレッド情報
 * @param {string} password 入力された合言葉
 * @returns {boolean} 検証OKならtrue
 */
function verifyPrivateAccess(threadInfo, password) {
    if (!threadInfo || threadInfo.type !== 'Private') return false;

    // ステータスと期限チェック (期限切れなら更新)
    const now = new Date();
    if (threadInfo.status !== 'Active') {
        if (threadInfo.expiresAt && new Date(threadInfo.expiresAt) < now) {
            if (threadInfo.status === 'Active') updateThreadStatus(threadInfo.id, 'Expired', threadInfo.rowIndex);
            return false; // 期限切れ or 元々Inactive
        }
        // Activeでないが、期限はまだ先の場合もfalse (手動でInactiveにされた可能性)
        return false;
    }

    // 合言葉チェック
    const inputHash = computeSha256Hash(password);
    return inputHash === threadInfo.passwordHash;
}

/**
 * 文字列のSHA-256ハッシュを計算 (前回と同じ)
 * @param {string} input
 * @returns {string}
 */
function computeSha256Hash(input) {
    if (!input) return '';
    const rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, input, Utilities.Charset.UTF_8);
    let hash = '';
    for (let i = 0; i < rawHash.length; i++) {
        let byte = rawHash[i];
        if (byte < 0) byte += 256;
        const hex = byte.toString(16);
        hash += (hex.length === 1 ? '0' : '') + hex;
    }
    return hash;
}

// include関数は doGet でテンプレートを使う場合に必要
function include(filename) {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
}


/**
 * チャットシステムに必要なスプレッドシートのシートと初期設定を自動生成します。
 * GASエディタから直接実行するか、メニューから実行します。
 */
function setupSpreadsheet() {
    const ui = SpreadsheetApp.getUi();
    let messageLog = "スプレッドシート初期設定結果:\n\n";
    let sheetsCreated = [];
    let headersSet = [];
    let defaultThreadsAdded = [];

    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();

        // --- 1. 「ログ」シートの設定 ---
        const logSheetName = 'ログ'; // コード内のLOG_SHEET_NAMEと合わせる
        let logSheet = ss.getSheetByName(logSheetName);
        if (!logSheet) {
            logSheet = ss.insertSheet(logSheetName);
            messageLog += `✅ 「${logSheetName}」シートを作成しました。\n`;
            sheetsCreated.push(logSheetName);
        } else {
            messageLog += `ℹ️ 「${logSheetName}」シートは既に存在します。\n`;
        }

        // 「ログ」シートのヘッダー設定 (1行目が空の場合のみ)
        const logHeaders = [['ThreadID', 'Timestamp', 'Name', 'Message']]; // COL_LOGに対応
        if (logSheet.getRange('A1').getValue() === '') {
            logSheet.getRange(1, 1, 1, logHeaders[0].length).setValues(logHeaders).setFontWeight('bold');
            // 列幅の調整（任意）
            logSheet.setColumnWidth(1, 150); // ThreadID
            logSheet.setColumnWidth(2, 180); // Timestamp
            logSheet.setColumnWidth(3, 120); // Name
            logSheet.setColumnWidth(4, 400); // Message
            logSheet.setFrozenRows(1); // ヘッダー行を固定
            messageLog += `✅ 「${logSheetName}」シートにヘッダー行を設定しました。\n`;
            headersSet.push(logSheetName);
        } else {
            messageLog += `ℹ️ 「${logSheetName}」シートには既にヘッダーが存在するようです。\n`;
        }

        // --- 2. 「スレッド管理」シートの設定 ---
        const adminSheetName = 'スレッド管理'; // コード内のADMIN_SHEET_NAMEと合わせる
        let adminSheet = ss.getSheetByName(adminSheetName);
        if (!adminSheet) {
            adminSheet = ss.insertSheet(adminSheetName);
            messageLog += `✅ 「${adminSheetName}」シートを作成しました。\n`;
            sheetsCreated.push(adminSheetName);
        } else {
            messageLog += `ℹ️ 「${adminSheetName}」シートは既に存在します。\n`;
        }

        // 「スレッド管理」シートのヘッダー設定 (1行目が空の場合のみ)
        const adminHeaders = [['ThreadID', 'ThreadName', 'Type', 'CreatedAt', 'ExpiresAt', 'PasswordHash', 'Status']]; // COL_ADMINに対応
        if (adminSheet.getRange('A1').getValue() === '') {
            adminSheet.getRange(1, 1, 1, adminHeaders[0].length).setValues(adminHeaders).setFontWeight('bold');
            // 列幅の調整（任意）
            adminSheet.setColumnWidth(1, 150); // ThreadID
            adminSheet.setColumnWidth(2, 200); // ThreadName
            adminSheet.setColumnWidth(3, 80);  // Type
            adminSheet.setColumnWidth(4, 180); // CreatedAt
            adminSheet.setColumnWidth(5, 180); // ExpiresAt
            adminSheet.setColumnWidth(6, 150); // PasswordHash
            adminSheet.setColumnWidth(7, 80);  // Status
            adminSheet.setFrozenRows(1); // ヘッダー行を固定
            messageLog += `✅ 「${adminSheetName}」シートにヘッダー行を設定しました。\n`;
            headersSet.push(adminSheetName);
        } else {
            messageLog += `ℹ️ 「${adminSheetName}」シートには既にヘッダーが存在するようです。\n`;
        }


        const existingThreadIds = adminSheet.getDataRange().getValues().slice(1).map(row => row[COL_ADMIN.THREAD_ID - 1]); // 既存のThreadIDリストを取得 (ヘッダー除く)

        defaultThreads.forEach(thread => {
            if (!existingThreadIds.includes(thread.id)) {
                adminSheet.appendRow([
                    thread.id,
                    thread.name,
                    thread.type,
                    '', // CreatedAt は今は空 or new Date()
                    '', // ExpiresAt
                    '', // PasswordHash
                    thread.status
                ]);
                messageLog += `✅ デフォルトスレッド「${thread.name}」(${thread.id}) を追加しました。\n`;
                defaultThreadsAdded.push(thread.name);
            } else {
                messageLog += `ℹ️ デフォルトスレッド「${thread.name}」(${thread.id}) は既に存在します。\n`;
            }
        });

        // 最後にユーザーへ完了メッセージを表示
        ui.alert('スプレッドシート初期設定完了', messageLog, ui.ButtonSet.OK);

    } catch (error) {
        Logger.log(`スプレッドシート設定エラー: ${error}`);
        ui.alert('エラー', `スプレッドシートの初期設定中にエラーが発生しました。\n詳細: ${error.message}`, ui.ButtonSet.OK);
    }
}

/**
 * スプレッドシートを開いた時にカスタムメニューを追加します。
 */
function onOpen() {
    SpreadsheetApp.getUi()
        .createMenu('チャット管理')
        .addItem('シート初期設定', 'setupSpreadsheet')
        .addToUi();
}