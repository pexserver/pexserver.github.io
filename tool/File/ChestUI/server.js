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
const http = __importStar(require("http"));
const url = __importStar(require("url"));
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
// --- 設定 ---
const DEFAULT_PORT = 8080;
// 提供するファイルのルートディレクトリ (プロジェクトルートからの相対パス)
const DEFAULT_ROOT_DIR = path.resolve('');
const INDEX_FILE = 'index.html';
// 簡単な MIME タイプマッピング
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain',
    '.ico': 'image/x-icon',
};
// --- サーバーロジック ---
function requestHandler(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!req.url) {
            sendError(res, 400, 'Bad Request: URL is missing');
            return;
        }
        // URLをパースし、デコードする (例: %20 -> ' ')
        const parsedUrl = url.parse(req.url);
        const decodedPathname = decodeURIComponent(parsedUrl.pathname || '/');
        // セキュリティ: ディレクトリトラバーサル攻撃を防ぐ
        // パスを正規化し、ルートディレクトリ外へのアクセスを防ぐ
        const requestedPath = path.normalize(decodedPathname).replace(/^(\.\.(\/|\\|$))+/, '');
        let filePath = path.join(DEFAULT_ROOT_DIR, requestedPath);
        // ルートディレクトリの外を指していないか最終確認
        if (!filePath.startsWith(DEFAULT_ROOT_DIR)) {
            sendError(res, 403, 'Forbidden: Access denied');
            return;
        }
        console.log(`Request: ${req.method} ${req.url} -> ${filePath}`);
        try {
            const stats = yield fs.stat(filePath);
            if (stats.isDirectory()) {
                // リクエストがディレクトリの場合、index.html を試す
                const indexPath = path.join(filePath, INDEX_FILE);
                try {
                    const indexStats = yield fs.stat(indexPath);
                    if (indexStats.isFile()) {
                        filePath = indexPath; // index.html を提供パスとする
                    }
                    else {
                        // index.html がファイルでない場合 (通常ありえないが念のため)
                        sendError(res, 403, `Forbidden: Cannot serve directory index and ${INDEX_FILE} is not a file`);
                        return;
                    }
                }
                catch (indexErr) {
                    // index.html が存在しない場合、ディレクトリリスティングは提供せず 403 Forbidden
                    sendError(res, 403, 'Forbidden: Directory listing is not allowed');
                    return;
                }
            }
            else if (!stats.isFile()) {
                // ディレクトリでもファイルでもない場合（シンボリックリンクなど）
                sendError(res, 404, 'Not Found: The requested resource is not a file');
                return;
            }
            // ファイルの読み込みと提供
            const fileContent = yield fs.readFile(filePath);
            const ext = path.extname(filePath).toLowerCase();
            const contentType = mimeTypes[ext] || 'application/octet-stream';
            res.writeHead(200, {
                'Content-Type': contentType,
                'Content-Length': fileContent.length,
                'Cache-Control': 'no-cache' // 開発用。キャッシュさせない
            });
            res.end(fileContent);
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                // ファイルが存在しない (ENOENT: Error NO ENTity)
                sendError(res, 404, 'Not Found');
            }
            else if (error.code === 'EACCES') {
                // パーミッションエラー (EACCES: Error ACCESs)
                sendError(res, 403, 'Forbidden: Permission denied');
            }
            else {
                // その他のエラー
                console.error('Server Error:', error);
                sendError(res, 500, 'Internal Server Error');
            }
        }
    });
}
function sendError(res, statusCode, message) {
    res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`${statusCode} ${message}`);
}
// --- サーバー起動 --- 
const server = http.createServer(requestHandler);
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : DEFAULT_PORT;
const rootDir = process.env.ROOT_DIR ? path.resolve(process.env.ROOT_DIR) : DEFAULT_ROOT_DIR;
// 指定ディレクトリが存在するか確認
fs.access(rootDir, fs.constants.R_OK)
    .then(() => {
    server.listen(port, () => {
        console.log(`\nServing directory "${rootDir}"`);
        console.log(`Server listening on http://localhost:${port}`);
        console.log('Press Ctrl+C to stop the server.');
    });
})
    .catch((err) => {
    console.error(`Error: Cannot access root directory "${rootDir}"`);
    console.error(err.message);
    process.exit(1); // ディレクトリにアクセスできない場合は終了
});
// --- Graceful Shutdown (おまけ) ---
process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    server.close(() => {
        console.log('Server closed.');
        process.exit(0);
    });
});
