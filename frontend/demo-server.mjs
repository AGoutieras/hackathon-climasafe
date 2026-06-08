import { createServer } from 'http';
import { readFile, stat } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, 'dist');
const backendBase = process.env.BACKEND_URL || 'http://127.0.0.1:8000';
const port = Number(process.env.PORT || 4175);

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Cache-Control': 'no-cache',
    ...headers,
  });
  res.end(body);
}

async function proxyApi(req, res) {
  const targetUrl = new URL(req.url, backendBase);
  const headers = { ...req.headers };
  delete headers.host;

  const upstream = await fetch(targetUrl, {
    method: req.method,
    headers,
    body: ['GET', 'HEAD'].includes(req.method || 'GET') ? undefined : req,
    redirect: 'manual',
  });

  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete('content-encoding');
  responseHeaders.delete('transfer-encoding');
  responseHeaders.delete('content-length');

  res.writeHead(upstream.status, Object.fromEntries(responseHeaders.entries()));
  if (upstream.body) {
    for await (const chunk of upstream.body) {
      res.write(chunk);
    }
  }
  res.end();
}

async function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const data = await readFile(filePath);
  send(res, 200, data, {
    'Content-Type': contentTypes[ext] || 'application/octet-stream',
  });
}

const indexHtml = async () => serveFile({ writeHead: send, end: () => {} }, path.join(distDir, 'index.html'));

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');

    if (url.pathname.startsWith('/api/')) {
      await proxyApi(req, res);
      return;
    }

    const pathname = decodeURIComponent(url.pathname);
    const filePath = path.join(distDir, pathname);

    try {
      const fileStat = await stat(filePath);
      if (fileStat.isFile()) {
        await serveFile(res, filePath);
        return;
      }
      if (fileStat.isDirectory()) {
        await serveFile(res, path.join(filePath, 'index.html'));
        return;
      }
    } catch {
      // Fall through to SPA shell.
    }

    await serveFile(res, path.join(distDir, 'index.html'));
  } catch (error) {
    console.error(error);
    send(res, 500, 'Internal Server Error');
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Demo server running on http://0.0.0.0:${port}`);
  console.log(`Proxying API to ${backendBase}`);
});