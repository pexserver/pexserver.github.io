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
const http = __importStar(require("node:http"));
const fs = __importStar(require("node:fs/promises"));
const path = __importStar(require("node:path"));
const url = __importStar(require("node:url"));
const os = __importStar(require("node:os"));
const DEFAULT_PORT = 8080;
const DEFAULT_ROOT_DIR = path.resolve('');
const INDEX_FILE = 'index.html';
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
function requestHandler(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!req.url) {
            sendError(res, 400, 'Bad Request: URL is missing');
            return;
        }
        const parsedUrl = url.parse(req.url);
        const decodedPathname = decodeURIComponent(parsedUrl.pathname || '/');
        const requestedPath = path.normalize(decodedPathname).replace(/^(\.\.(\/|\\|$))+/, '');
        let filePath = path.join(DEFAULT_ROOT_DIR, requestedPath);
        if (!filePath.startsWith(DEFAULT_ROOT_DIR)) {
            sendError(res, 403, 'Forbidden: Access denied');
            return;
        }
        console.log(`Request: ${req.method} ${req.url} -> ${filePath}`);
        try {
            const stats = yield fs.stat(filePath);
            if (stats.isDirectory()) {
                const indexPath = path.join(filePath, INDEX_FILE);
                try {
                    const indexStats = yield fs.stat(indexPath);
                    if (indexStats.isFile()) {
                        filePath = indexPath;
                    }
                    else {
                        sendError(res, 403, `Forbidden: Cannot serve directory index and ${INDEX_FILE} is not a file`);
                        return;
                    }
                }
                catch (indexErr) {
                    sendError(res, 403, 'Forbidden: Directory listing is not allowed');
                    return;
                }
            }
            else if (!stats.isFile()) {
                sendError(res, 404, 'Not Found: The requested resource is not a file');
                return;
            }
            const fileContent = yield fs.readFile(filePath);
            const ext = path.extname(filePath).toLowerCase();
            const contentType = mimeTypes[ext] || 'application/octet-stream';
            res.writeHead(200, {
                'Content-Type': contentType,
                'Content-Length': fileContent.length,
                'Cache-Control': 'no-cache'
            });
            res.end(fileContent);
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                sendError(res, 404, 'Not Found');
            }
            else if (error.code === 'EACCES') {
                sendError(res, 403, 'Forbidden: Permission denied');
            }
            else {
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
const server = http.createServer(requestHandler);
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : DEFAULT_PORT;
const rootDir = process.env.ROOT_DIR ? path.resolve(process.env.ROOT_DIR) : DEFAULT_ROOT_DIR;
fs.access(rootDir, fs.constants.R_OK)
    .then(() => {
    server.listen(port, '0.0.0.0', () => {
        console.log(`\nServing directory "${rootDir}"`);
        console.log(`Server listening on:`);
        console.log(`  http://localhost:${port}`);
        // ローカルIPアドレスも案内
        const interfaces = os.networkInterfaces();
        Object.values(interfaces).forEach(ifaces => {
            ifaces === null || ifaces === void 0 ? void 0 : ifaces.forEach(iface => {
                if (iface.family === 'IPv4' && !iface.internal) {
                    console.log(`  http://${iface.address}:${port}`);
                }
            });
        });
        console.log('Press Ctrl+C to stop the server.');
    });
})
    .catch((err) => {
    console.error(`Error: Cannot access root directory "${rootDir}"`);
    console.error(err.message);
    process.exit(1);
});
process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    server.close(() => {
        console.log('Server closed.');
        process.exit(0);
    });
});
