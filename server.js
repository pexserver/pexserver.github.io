"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var http = require("node:http");
var fs = require("node:fs/promises");
var path = require("node:path");
var url = require("node:url");
var DEFAULT_PORT = 8080;
var DEFAULT_ROOT_DIR = path.resolve('');
var INDEX_FILE = 'index.html';
var mimeTypes = {
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
    return __awaiter(this, void 0, void 0, function () {
        var parsedUrl, decodedPathname, requestedPath, filePath, stats, indexPath, indexStats, indexErr_1, fileContent, ext, contentType, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!req.url) {
                        sendError(res, 400, 'Bad Request: URL is missing');
                        return [2 /*return*/];
                    }
                    parsedUrl = url.parse(req.url);
                    decodedPathname = decodeURIComponent(parsedUrl.pathname || '/');
                    requestedPath = path.normalize(decodedPathname).replace(/^(\.\.(\/|\\|$))+/, '');
                    filePath = path.join(DEFAULT_ROOT_DIR, requestedPath);
                    if (!filePath.startsWith(DEFAULT_ROOT_DIR)) {
                        sendError(res, 403, 'Forbidden: Access denied');
                        return [2 /*return*/];
                    }
                    console.log("Request: ".concat(req.method, " ").concat(req.url, " -> ").concat(filePath));
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 10, , 11]);
                    return [4 /*yield*/, fs.stat(filePath)];
                case 2:
                    stats = _a.sent();
                    if (!stats.isDirectory()) return [3 /*break*/, 7];
                    indexPath = path.join(filePath, INDEX_FILE);
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, 5, , 6]);
                    return [4 /*yield*/, fs.stat(indexPath)];
                case 4:
                    indexStats = _a.sent();
                    if (indexStats.isFile()) {
                        filePath = indexPath;
                    }
                    else {
                        sendError(res, 403, "Forbidden: Cannot serve directory index and ".concat(INDEX_FILE, " is not a file"));
                        return [2 /*return*/];
                    }
                    return [3 /*break*/, 6];
                case 5:
                    indexErr_1 = _a.sent();
                    sendError(res, 403, 'Forbidden: Directory listing is not allowed');
                    return [2 /*return*/];
                case 6: return [3 /*break*/, 8];
                case 7:
                    if (!stats.isFile()) {
                        sendError(res, 404, 'Not Found: The requested resource is not a file');
                        return [2 /*return*/];
                    }
                    _a.label = 8;
                case 8: return [4 /*yield*/, fs.readFile(filePath)];
                case 9:
                    fileContent = _a.sent();
                    ext = path.extname(filePath).toLowerCase();
                    contentType = mimeTypes[ext] || 'application/octet-stream';
                    res.writeHead(200, {
                        'Content-Type': contentType,
                        'Content-Length': fileContent.length,
                        'Cache-Control': 'no-cache'
                    });
                    res.end(fileContent);
                    return [3 /*break*/, 11];
                case 10:
                    error_1 = _a.sent();
                    if (error_1.code === 'ENOENT') {
                        sendError(res, 404, 'Not Found');
                    }
                    else if (error_1.code === 'EACCES') {
                        sendError(res, 403, 'Forbidden: Permission denied');
                    }
                    else {
                        console.error('Server Error:', error_1);
                        sendError(res, 500, 'Internal Server Error');
                    }
                    return [3 /*break*/, 11];
                case 11: return [2 /*return*/];
            }
        });
    });
}
function sendError(res, statusCode, message) {
    res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end("".concat(statusCode, " ").concat(message));
}
var server = http.createServer(requestHandler);
var port = process.env.PORT ? parseInt(process.env.PORT, 10) : DEFAULT_PORT;
var rootDir = process.env.ROOT_DIR ? path.resolve(process.env.ROOT_DIR) : DEFAULT_ROOT_DIR;
fs.access(rootDir, fs.constants.R_OK)
    .then(function () {
    server.listen(port, function () {
        console.log("\nServing directory \"".concat(rootDir, "\""));
        console.log("Server listening on http://localhost:".concat(port));
        console.log('Press Ctrl+C to stop the server.');
    });
})
    .catch(function (err) {
    console.error("Error: Cannot access root directory \"".concat(rootDir, "\""));
    console.error(err.message);
    process.exit(1);
});
process.on('SIGINT', function () {
    console.log('\nShutting down server...');
    server.close(function () {
        console.log('Server closed.');
        process.exit(0);
    });
});
