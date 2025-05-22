import * as http from 'node:http';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as url from 'node:url';

const DEFAULT_PORT = 8080;
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

        const fileContent = await fs.readFile(filePath);
        const ext = path.extname(filePath).toLowerCase();
        const contentType = mimeTypes[ext] || 'application/octet-stream';

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
        server.listen(port, () => {
            console.log(`\nServing directory "${rootDir}"`);
            console.log(`Server listening on http://localhost:${port}`);
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
