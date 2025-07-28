import * as http from 'node:http';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as url from 'node:url';
import * as os from 'node:os';

const DEFAULT_PORT = 80;
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

async function requestHandler(req: http.IncomingMessage, res: http.ServerResponse) {
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
        const stats = await fs.stat(filePath);

        if (stats.isDirectory()) {
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
            'Cache-Control': 'no-cache'
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
