"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.読み込み = exports.遅延実行 = exports.返す = exports.試行 = exports.変数ファクトリ = exports.定数ファクトリ = exports.関数ヘルパー = exports.コンソール = void 0;
exports.配列作成 = 配列作成;
exports.配列各要素 = 配列各要素;
exports.配列絞込 = 配列絞込;
exports.配列変換 = 配列変換;
exports.配列検索 = 配列検索;
exports.配列長さ = 配列長さ;
exports.配列含む = 配列含む;
exports.新しい約束 = 新しい約束;
exports.約束成功時 = 約束成功時;
exports.約束失敗時 = 約束失敗時;
exports.約束完了時 = 約束完了時;
exports.全約束待機 = 全約束待機;
exports.文字列含む = 文字列含む;
exports.文字列置換 = 文字列置換;
exports.文字列分割 = 文字列分割;
exports.文字列結合 = 文字列結合;
exports.文字列長さ = 文字列長さ;
exports.ファイル読込 = ファイル読込;
exports.ファイル書込 = ファイル書込;
exports.存在確認 = 存在確認;
exports.フォルダ作成 = フォルダ作成;
exports.ファイル削除 = ファイル削除;
exports.JSON解析 = JSON解析;
exports.JSON文字列化 = JSON文字列化;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// 日本語でnode.jsの一部のコードを使用する為のライブラリさん
exports.コンソール = {
    ログ: (...args) => { console.log(...args); },
    情報: (...args) => { console.info(...args); },
    警告: (...args) => { console.warn(...args); },
    エラー: (...args) => { console.error(...args); },
    デバッグ: (...args) => { console.debug(...args); },
};
/**
 * @deprecated JS の `function` キーワードの代わりにはなりません。
 *             通常の関数定義 ( `function name() {}` や `const name = () => {}` ) を推奨します。
 *             お遊びとして、関数実装を受け取りそのまま返すヘルパーです。
 * @param 実装 関数の本体
 * @returns 与えられた関数実装
 */
const 関数ヘルパー = (実装) => {
    if (typeof 実装 !== 'function') {
        exports.コンソール.エラー("関数ヘルパーの引数は関数である必要があります。");
        return (() => { });
    }
    return 実装;
};
exports.関数ヘルパー = 関数ヘルパー;
/**
 *             値の再代入を防ぎたい場合は、通常の `const` を使用してください。
 *             これは値への読み取り専用アクセスを提供するシンプルなオブジェクトを返します。
 * @param 値 定数として保持したい値
 * @returns 値プロパティを持つ読み取り専用風オブジェクト `{ readonly 値: T }`
 */
const 定数ファクトリ = (値) => {
    return { 値: 値 };
};
exports.定数ファクトリ = 定数ファクトリ;
/**
 *             再代入可能な変数が必要な場合は、通常の `let` を使用してください。
 *             これは値の読み書きが可能なプロパティを持つシンプルなオブジェクトを返します。
 * @param 初期値 変数の初期値
 * @returns 値プロパティを持つオブジェクト `{ 値: T }`
 */
const 変数ファクトリ = (初期値) => {
    return { 値: 初期値 };
};
exports.変数ファクトリ = 変数ファクトリ;
/**
 * try...catch ブロックの構文を模倣した関数。
 * 処理を実行し、エラーが発生した場合は捕獲ブロックを実行します。
 * @param 試行ブロック エラーが発生する可能性のある処理を含む関数
 * @param 捕獲ブロック エラーが発生した場合に呼び出される関数 (エラーオブジェクトを引数として受け取る)
 */
const 試行 = (試行ブロック, 捕獲ブロック) => {
    if (typeof 試行ブロック !== 'function' || typeof 捕獲ブロック !== 'function') {
        exports.コンソール.エラー("試行の使い方が正しくありません。例: 試行(() => { ... }, (エラー) => { ... });");
        return;
    }
    try {
        試行ブロック();
    }
    catch (error) {
        捕獲ブロック(error);
    }
};
exports.試行 = 試行;
/**
 * @deprecated JS の `return` キーワードの代わりにはなりません。
 *             関数の実行を終了して値を返すには、必ず `return` を使用してください。
 *             この関数は渡された値をそのまま返すだけで、関数の実行フローには影響しません。
 * @param 値 返したい値 (のつもり)
 * @returns 与えられた値
 */
const 返す = (値) => {
    exports.コンソール.警告("!!! 「返す(値)」は `return` 文の代わりにはなりません！ 必ず `return` を使用してください !!!");
    return 値;
};
exports.返す = 返す;
/**
 * 指定されたミリ秒後にコールバック関数を実行します (setTimeoutのラッパー)。
 * @param ミリ秒 遅延時間 (ミリ秒)
 * @param コールバック 遅延後に実行する関数
 */
const 遅延実行 = (ミリ秒, コールバック) => {
    if (typeof ミリ秒 !== 'number' || typeof コールバック !== 'function') {
        exports.コンソール.エラー("遅延実行の使い方が正しくありません。例: 遅延実行(1000, () => { ... });");
        return;
    }
    setTimeout(コールバック, ミリ秒);
};
exports.遅延実行 = 遅延実行;
/**
 * CommonJS の `require` 関数のエイリアス。
 * ES Modules 環境では動作しない可能性があります。`import` の使用を推奨します。
 * @param モジュールパス 読み込むモジュールのパス
 * @returns 読み込まれたモジュール、またはエラー時に undefined
 */
const 読み込み = (モジュールパス) => {
    if (typeof require === 'undefined') {
        exports.コンソール.警告("`読み込み` 関数は CommonJS 環境 (require が利用可能) でのみ正しく動作します。ES Module 環境では `import` を使用してください。");
        return undefined;
    }
    try {
        return require(モジュールパス);
    }
    catch (e) {
        exports.コンソール.エラー(`モジュール "${モジュールパス}" の読み込みに失敗しました:`, e.message);
        return undefined;
    }
};
exports.読み込み = 読み込み;
/**
 * 配列を作成します。
 * @param 要素 配列に含める要素
 * @returns 新しい配列
 */
function 配列作成(...要素) {
    return 要素;
}
/**
 * 配列の各要素に対して処理を実行します (forEachのラッパー)。
 * @param 配列 対象の配列
 * @param 処理 各要素に対して実行する関数 (要素, インデックス, 元配列)
 */
function 配列各要素(配列, 処理) {
    配列.forEach(処理);
}
/**
 * 配列を条件で絞り込み、新しい配列を返します (filterのラッパー)。
 * @param 配列 対象の配列
 * @param 条件 絞り込み条件となる関数 (要素, インデックス, 元配列) => boolean
 * @returns 条件に一致した要素からなる新しい配列
 */
function 配列絞込(配列, 条件) {
    return 配列.filter(条件);
}
/**
 * 配列の各要素を変換し、新しい配列を返します (mapのラッパー)。
 * @param 配列 対象の配列
 * @param 処理 各要素を変換する関数 (要素, インデックス, 元配列) => 新しい値
 * @returns 変換された要素からなる新しい配列
 */
function 配列変換(配列, 処理) {
    return 配列.map(処理);
}
/**
 * 配列内で最初に条件に一致する要素を返します (findのラッパー)。
 * @param 配列 対象の配列
 * @param 条件 検索条件となる関数 (要素, インデックス, 元配列) => boolean
 * @returns 条件に一致した最初の要素、または見つからない場合は undefined
 */
function 配列検索(配列, 条件) {
    return 配列.find(条件);
}
/**
 * 配列の要素数を返します。
 * @param 配列 対象の配列
 * @returns 要素数
 */
function 配列長さ(配列) {
    return 配列.length;
}
/**
 * 配列に要素が含まれているか確認します (includesのラッパー)。
 * @param 配列 対象の配列
 * @param 要素 検索する要素
 * @returns 含まれていれば true、そうでなければ false
 */
function 配列含む(配列, 要素) {
    return 配列.includes(要素);
}
/**
 * Promiseを作成します (new Promiseのラッパー)。
 * @param 実行関数 プロミスの実行関数 (解決コールバック, 拒否コールバック)
 * @returns 新しい Promise インスタンス
 */
function 新しい約束(実行関数) {
    return new Promise(実行関数);
}
/**
 * Promise が成功した場合の処理を登録します (thenの第一引数のラッパー)。
 * @param 約束 対象の Promise
 * @param 処理 成功時に実行する関数 (解決された値) => 新しい値 or 新しいPromise
 * @returns 新しい Promise
 */
function 約束成功時(約束, 処理) {
    return __awaiter(this, void 0, void 0, function* () {
        return 約束.then(処理);
    });
}
/**
 * Promise が失敗した場合の処理を登録します (catchのラッパー)。
 * @param 約束 対象の Promise
 * @param 処理 失敗時に実行する関数 (エラー理由) => 新しい値 or 新しいPromise
 * @returns 新しい Promise
 */
function 約束失敗時(約束, 処理) {
    return __awaiter(this, void 0, void 0, function* () {
        return 約束.catch(処理);
    });
}
/**
 * Promise の成功/失敗に関わらず最後に実行される処理を登録します (finallyのラッパー)。
 * @param 約束 対象の Promise
 * @param 処理 最後に実行する関数
 * @returns 新しい Promise
 */
function 約束完了時(約束, 処理) {
    return __awaiter(this, void 0, void 0, function* () {
        return 約束.finally(処理);
    });
}
/**
 * 複数の Promise がすべて成功するのを待ちます (Promise.allのラッパー)。
 * @param 約束配列 Promise の配列
 * @returns すべての Promise の結果を格納した配列で解決される新しい Promise
 */
function 全約束待機(約束配列) {
    return Promise.all(約束配列);
}
/**
 * 文字列が指定した部分文字列を含むか確認します (String.includesのラッパー)。
 * @param 対象文字列 検索対象の文字列
 * @param 検索文字列 探す部分文字列
 * @returns 含まれていれば true、そうでなければ false
 */
function 文字列含む(対象文字列, 検索文字列) {
    return 対象文字列.includes(検索文字列);
}
/**
 * 文字列の一部を置換します (String.replaceのラッパー)。
 * @param 対象文字列 置換対象の文字列
 * @param 検索 検索する文字列または正規表現
 * @param 置換 置換後の文字列
 * @returns 置換された新しい文字列
 */
function 文字列置換(対象文字列, 検索, 置換) {
    return 対象文字列.replace(検索, 置換);
}
/**
 * 文字列を指定した区切り文字で分割します (String.splitのラッパー)。
 * @param 対象文字列 分割対象の文字列
 * @param 区切り文字 分割の基準となる文字列または正規表現
 * @param 上限 分割数の上限 (オプション)
 * @returns 分割された文字列の配列
 */
function 文字列分割(対象文字列, 区切り文字, 上限) {
    return 対象文字列.split(区切り文字, 上限);
}
/**
 * 文字列配列を指定した区切り文字で結合します (Array.joinのラッパー)。
 * @param 文字列配列 結合する文字列の配列
 * @param 区切り文字 結合時に使用する区切り文字 (デフォルトはカンマ)
 * @returns 結合された新しい文字列
 */
function 文字列結合(文字列配列, 区切り文字 = ',') {
    return 文字列配列.join(区切り文字);
}
/**
 * 文字列の長さを取得します (String.lengthのラッパー)。
 * @param 対象文字列 対象の文字列
 * @returns 文字列の長さ
 */
function 文字列長さ(対象文字列) {
    return 対象文字列.length;
}
const isNode = typeof process !== 'undefined' && process.versions != null && process.versions.node != null;
if (!isNode) {
    exports.コンソール.情報("ファイル操作機能は Node.js 環境外のため、利用できません。");
}
/**
 * [Node.js] ファイルを非同期で読み込み、内容を文字列として返します。
 * @param ファイルパス 読み込むファイルのパス
 * @param エンコーディング 文字エンコーディング (デフォルトは 'utf8')
 * @returns ファイル内容で解決される Promise
 * @throws ファイルが存在しない場合や読み込み権限がない場合にエラー
 */
function ファイル読込(ファイルパス_1) {
    return __awaiter(this, arguments, void 0, function* (ファイルパス, エンコーディング = 'utf8') {
        if (!isNode)
            throw new Error("ファイル読込は Node.js 環境でのみ利用可能です。");
        return fs.promises.readFile(ファイルパス, エンコーディング);
    });
}
/**
 * [Node.js] ファイルに非同期で内容を書き込みます。ファイルが存在しない場合は作成されます。
 * @param ファイルパス 書き込むファイルのパス
 * @param 内容 書き込む文字列またはバッファ
 * @param エンコーディング 文字エンコーディング (デフォルトは 'utf8')
 * @returns 書き込み完了で解決される Promise
 */
function ファイル書込(ファイルパス_1, 内容_1) {
    return __awaiter(this, arguments, void 0, function* (ファイルパス, 内容, エンコーディング = 'utf8') {
        if (!isNode)
            throw new Error("ファイル書込は Node.js 環境でのみ利用可能です。");
        yield fs.promises.mkdir(path.dirname(ファイルパス), { recursive: true });
        return fs.promises.writeFile(ファイルパス, 内容, エンコーディング);
    });
}
/**
 * [Node.js] ファイルまたはディレクトリが存在するか非同期で確認します。
 * @param パス 確認するファイルまたはディレクトリのパス
 * @returns 存在すれば true、存在しなければ false で解決される Promise
 */
function 存在確認(パス) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!isNode)
            throw new Error("存在確認は Node.js 環境でのみ利用可能です。");
        try {
            yield fs.promises.access(パス, fs.constants.F_OK);
            return true;
        }
        catch (_a) {
            return false;
        }
    });
}
/**
 * [Node.js] ディレクトリを非同期で作成します。必要に応じて親ディレクトリも作成します。
 * @param パス 作成するディレクトリのパス
 * @param オプション fs.mkdirのオプション (recursive: true はデフォルト)
 * @returns 作成された最初のディレクトリのパス（すでに存在する場合は undefined）で解決される Promise
 */
function フォルダ作成(パス_1) {
    return __awaiter(this, arguments, void 0, function* (パス, オプション = {}) {
        if (!isNode)
            throw new Error("フォルダ作成は Node.js 環境でのみ利用可能です。");
        return fs.promises.mkdir(パス, Object.assign({ recursive: true }, オプション));
    });
}
/**
 * [Node.js] ファイルを非同期で削除します。
 * @param ファイルパス 削除するファイルのパス
 * @returns 削除完了で解決される Promise
 */
function ファイル削除(ファイルパス) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!isNode)
            throw new Error("ファイル削除は Node.js 環境でのみ利用可能です。");
        return fs.promises.unlink(ファイルパス);
    });
}
/**
 * JSON 文字列を解析して JavaScript オブジェクトに変換します (JSON.parseのラッパー)。
 * @param json文字列 解析する JSON 文字列
 * @returns 解析された JavaScript オブジェクト
 * @throws JSON 文字列の形式が不正な場合にエラー
 */
function JSON解析(json文字列) {
    try {
        return JSON.parse(json文字列);
    }
    catch (e) {
        exports.コンソール.エラー("JSON解析に失敗しました:", e.message);
        throw new Error(`JSON解析エラー: ${e.message}`);
    }
}
/**
 * JavaScript オブジェクトを JSON 文字列に変換します (JSON.stringifyのラッパー)。
 * @param オブジェクト 文字列化するオブジェクト
 * @param スペース 整形用のスペース数または文字列 (オプション)
 * @returns 生成された JSON 文字列
 */
function JSON文字列化(オブジェクト, スペース) {
    try {
        return JSON.stringify(オブジェクト, null, スペース);
    }
    catch (e) {
        exports.コンソール.エラー("JSON文字列化に失敗しました:", e.message);
        throw new Error(`JSON文字列化エラー: ${e.message}`);
    }
}
