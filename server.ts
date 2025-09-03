import * as http from 'node:http';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as url from 'node:url';
import * as os from 'node:os';

const DEFAULT_PORT = 25565;
const DEFAULT_ROOT_DIR = path.resolve('');
const INDEX_FILE = 'index.html';

const mimeTypes: Record<string, string> = {
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

// --- 追加: Proxy Protocol 用の定数/シンボル ---
const PROXY_INFO = Symbol('proxyInfo');
const PPv2_SIG = Buffer.from([0x0d,0x0a,0x0d,0x0a,0x00,0x0d,0x0a,0x51,0x55,0x49,0x54,0x0a]);

async function requestHandler(req: http.IncomingMessage, res: http.ServerResponse) {
    if (!req.url) {
        sendError(res, 400, 'Bad Request: URL is missing');
        return;
    }

    // クライアントの IP/ポートを取得・正規化
    const socket = req.socket as any;

    // 優先順位:
    //  1) X-Real-IP ヘッダ
    //  2) X-Forwarded-For ヘッダ (カンマ区切りの場合は最初の値を使う)
    //  3) Proxy Protocol 情報 (socket[PROXY_INFO])
    //  4) socket.remoteAddress
    let clientIp = '';
    let clientPort: number | string = '';

    const headerXReal = typeof req.headers['x-real-ip'] === 'string' ? (req.headers['x-real-ip'] as string) : '';
    const headerXFwd = typeof req.headers['x-forwarded-for'] === 'string' ? (req.headers['x-forwarded-for'] as string) : '';

    const sanitizeIp = (ip: string) => {
        if (!ip) return '';
        let v = ip.trim();
        // X-Forwarded-For は "client, proxy1, proxy2" の形式になり得る -> 最初のエントリを採用
        if (v.includes(',')) v = v.split(',')[0].trim();
        // IPv4-mapped IPv6 を変換
        if (v.startsWith('::ffff:')) v = v.replace('::ffff:', '');
        if (v === '::1') v = '127.0.0.1';
        return v;
    };

    if (headerXReal) {
        clientIp = sanitizeIp(headerXReal);
        clientPort = socket.remotePort ?? '';
    } else if (headerXFwd) {
        clientIp = sanitizeIp(headerXFwd);
        clientPort = socket.remotePort ?? '';
    } else if (socket[PROXY_INFO]) {
        clientIp = socket[PROXY_INFO].srcAddr || '';
        clientPort = socket[PROXY_INFO].srcPort ?? '';
    } else {
        clientIp = socket.remoteAddress ?? '';
        if (clientIp) {
            if (clientIp.startsWith('::ffff:')) clientIp = clientIp.replace('::ffff:', '');
            if (clientIp === '::1') clientIp = '127.0.0.1';
        }
        clientPort = socket.remotePort ?? '';
    }

    const parsedUrl = url.parse(req.url);
    const decodedPathname = decodeURIComponent(parsedUrl.pathname || '/');
    const requestedPath = path.normalize(decodedPathname).replace(/^(\.\.(\/|\\|$))+/, '');
    let filePath = path.join(DEFAULT_ROOT_DIR, requestedPath);

    if (!filePath.startsWith(DEFAULT_ROOT_DIR)) {
        sendError(res, 403, 'Forbidden: Access denied');
        return;
    }

    console.log(`Client: ${clientIp}:${clientPort}  Request: ${req.method} ${req.url} -> ${filePath}`);

    try {
        const stats = await fs.stat(filePath);

        if (stats.isDirectory()) {
            // ディレクトリアクセス時にトレーリングスラッシュがない場合はリダイレクト
            if (!decodedPathname.endsWith('/')) {
                const redirectUrl = decodedPathname + '/';
                res.writeHead(301, {
                    'Location': redirectUrl,
                    'Content-Type': 'text/plain'
                });
                res.end(`Redirecting to ${redirectUrl}`);
                return;
            }

            const indexPath = path.join(filePath, INDEX_FILE);
            try {
                const indexStats = await fs.stat(indexPath);
                if (indexStats.isFile()) {
                    filePath = indexPath;
                } else {
                    sendError(res, 403, `Forbidden: Cannot serve directory index and ${INDEX_FILE} is not a file`);
                    return;
                }
            } catch (indexErr: any) {
                sendError(res, 403, 'Forbidden: Directory listing is not allowed');
                return;
            }
        } else if (!stats.isFile()) {
            sendError(res, 404, 'Not Found: The requested resource is not a file');
            return;
        }

        let fileContent = await fs.readFile(filePath);
        const ext = path.extname(filePath).toLowerCase();
        let contentType = mimeTypes[ext] || 'application/octet-stream';

        // index.htmlの場合は<base>タグを<head>内に自動挿入
        if (ext === '.html' && path.basename(filePath).toLowerCase() === 'index.html') {
            let html = fileContent.toString('utf8');
            // <head>直後に<base href="...">を挿入
            const dirPath = path.dirname(path.relative(DEFAULT_ROOT_DIR, filePath)).replace(/\\/g, '/');
            let baseHref = '/';
            if (dirPath && dirPath !== '.') baseHref = '/' + dirPath + '/';
            if (!/<base\s/i.test(html)) {
                html = html.replace(/<head(\s*[^>]*)>/i, `<head$1>\n    <base href=\"${baseHref}\">`);
            }
            fileContent = Buffer.from(html, 'utf8');
        }

        res.writeHead(200, {
            'Content-Type': contentType,
            'Content-Length': fileContent.length,
            'Cache-Control': 'no-cache',
            // デバッグ用にクライアント IP を返す（任意）
            'X-Client-IP': clientIp
        });
        res.end(fileContent);

    } catch (error: any) {
        if (error.code === 'ENOENT') {
            sendError(res, 404, 'Not Found');
        } else if (error.code === 'EACCES') {
            sendError(res, 403, 'Forbidden: Permission denied');
        } else {
            console.error('Server Error:', error);
            sendError(res, 500, 'Internal Server Error');
        }
    }
}

function sendError(res: http.ServerResponse, statusCode: number, message: string) {
    res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`${statusCode} ${message}`);
}

const server = http.createServer(requestHandler);

// --- 追加: connection 時に最初のデータを先読みして Proxy Protocol を解析 ---
server.on('connection', (socket) => {
    let buffer = Buffer.alloc(0);
    const onData = (chunk: Buffer) => {
        buffer = Buffer.concat([buffer, chunk]);

        // Proxy Protocol v1 (テキスト "PROXY ...\r\n")
        if (buffer.length >= 6 && buffer.slice(0,6).toString('ascii') === 'PROXY ') {
            const idx = buffer.indexOf('\r\n');
            if (idx !== -1) {
                const header = buffer.slice(0, idx).toString('utf8');
                const headerTrim = header.trim();
                const parts = headerTrim.split(/\s+/);
                // Valid forms:
                //  - PROXY UNKNOWN\r\n
                //  - PROXY TCP4 src dst srcport dstport\r\n
                //  - PROXY TCP6 src dst srcport dstport\r\n
                if (parts.length >= 2) {
                    const proto = parts[1].toUpperCase();
                    if (proto === 'UNKNOWN') {
                        // クライアント情報は利用不可と明示
                        (socket as any)[PROXY_INFO] = { proto: 'UNKNOWN' };
                    } else if (parts.length >= 6) {
                        const srcAddr = parts[2];
                        const srcPort = parseInt(parts[4], 10);
                        if (!Number.isNaN(srcPort)) {
                            (socket as any)[PROXY_INFO] = { proto, srcAddr, srcPort };
                            // 他のコードが socket.remoteAddress/remotePort を見ている可能性があるため
                            // 上書きしておく（注意: セキュリティ的に信頼できる環境でのみ行うこと）
                            try {
                                (socket as any).remoteAddress = srcAddr;
                                (socket as any).remotePort = srcPort;
                            } catch (e) {
                                // ignore if platform prevents override
                            }
                        } else {
                            // 無効なポート -> ヘッダ無視
                        }
                    } else {
                        // トークン不足 -> ヘッダ無視
                    }
                }

                const remaining = buffer.slice(idx + 2);
                if (remaining.length) socket.unshift(remaining);
                socket.removeListener('data', onData);
            } else if (buffer.length > 108) {
                // 長すぎて改行が来ない -> プロキシヘッダなしとして戻す
                socket.unshift(buffer);
                socket.removeListener('data', onData);
            }
            return;
        }

        // Proxy Protocol v2 (バイナリ)
        if (buffer.length >= 12 && buffer.slice(0,12).equals(PPv2_SIG)) {
            if (buffer.length >= 16) {
                const len = buffer.readUInt16BE(14);
                const total = 16 + len;
                if (buffer.length >= total) {
                    const famProto = buffer[13];
                    const fam = famProto & 0xf0;
                    // AF_INET
                    if (fam === 0x10 && len >= 12) {
                        const srcAddrBuf = buffer.slice(16, 20);
                        const srcPort = buffer.readUInt16BE(24);
                        const srcAddr = Array.from(srcAddrBuf).join('.');
                        (socket as any)[PROXY_INFO] = { proto: 'TCP4', srcAddr, srcPort };
                    }
                    // AF_INET6 (簡易処理)
                    else if (fam === 0x20 && len >= 36) {
                        const srcAddrBuf = buffer.slice(16, 32);
                        const srcPort = buffer.readUInt16BE(48);
                        const srcAddr = srcAddrBuf.toString('hex').match(/.{1,4}/g)?.join(':') || '';
                        (socket as any)[PROXY_INFO] = { proto: 'TCP6', srcAddr, srcPort };
                    }
                    const remaining = buffer.slice(total);
                    if (remaining.length) socket.unshift(remaining);
                    socket.removeListener('data', onData);
                    return;
                }
                // まだ全体が来ていない -> 続けて待つ
                return;
            }
            // header がまだ全部来ていない -> 続けて待つ
            return;
        }

        // どちらのプロキシヘッダでもない -> 読み込んだデータを戻して処理を続行
        socket.unshift(buffer);
        socket.removeListener('data', onData);
    };

    socket.on('data', onData);

    // タイムアウト: 一定時間で先読みを止める（既に読み込んだデータは戻す）
    const t = setTimeout(() => {
        socket.removeListener('data', onData);
        if (buffer.length) socket.unshift(buffer);
    }, 1000);

    socket.once('close', () => clearTimeout(t));
});

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : DEFAULT_PORT;
const rootDir = process.env.ROOT_DIR ? path.resolve(process.env.ROOT_DIR) : DEFAULT_ROOT_DIR;

fs.access(rootDir, fs.constants.R_OK)
    .then(() => {
        // IPv4, IPv6両方でリッスン
        server.listen(port, '0.0.0.0', () => {
            console.log(`\nServing directory "${rootDir}"`);
            console.log(`Server listening on:`);
            console.log(`  http://localhost:${port}`);
            // ローカルIPv4アドレスも案内
            const interfaces = os.networkInterfaces();
            Object.values(interfaces).forEach(ifaces => {
                ifaces?.forEach(iface => {
                    if (iface.family === 'IPv4' && !iface.internal) {
                        console.log(`  http://${iface.address}:${port}`);
                    }
                    if (iface.family === 'IPv6' && !iface.internal) {
                        // IPv6アドレスは[]で囲む
                        console.log(`  http://[${iface.address}]:${port}`);
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
