#!/usr/bin/env node
// Tiny zero-dependency static server for the poetry diary. Local only (127.0.0.1).
// It only serves files: it never generates poems or calls any API. Stop it with Ctrl+C.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { config, DATA_FILE, PUBLIC_DIR } from './lib/config.mjs';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  // Inline CSS/JS live in index.html; nothing is loaded from other sites.
  'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:",
};

function send(res, status, body, type = 'text/plain; charset=utf-8', extra = {}) {
  res.writeHead(status, { 'Content-Type': type, ...SECURITY_HEADERS, ...extra });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed', undefined, { Allow: 'GET, HEAD' });

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    return send(res, 400, 'Bad request');
  }

  try {
    // The poem data lives outside public/ and is always served fresh.
    if (pathname === '/poems.json') {
      return send(res, 200, await readFile(DATA_FILE), TYPES['.json'], { 'Cache-Control': 'no-store' });
    }

    const file = path.resolve(PUBLIC_DIR, '.' + (pathname === '/' ? '/index.html' : pathname));
    // Block path traversal (e.g. /../config.json): only files inside public/ are served.
    if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 403, 'Forbidden');

    const body = await readFile(file);
    return send(res, 200, req.method === 'HEAD' ? '' : body, TYPES[path.extname(file)] ?? 'application/octet-stream');
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'EISDIR') return send(res, 404, 'Not found');
    console.error(err);
    return send(res, 500, 'Server error');
  }
});

const { host, port } = config.server;
server.on('error', (err) => {
  console.error(err.code === 'EADDRINUSE' ? `✖ Port ${port} is already in use. Change "server.port" in config.json.` : `✖ ${err.message}`);
  process.exitCode = 1;
});
server.listen(port, host, () => {
  console.log(`🌤️  Poetry diary: http://${host}:${port}  (local only, Ctrl+C to stop)`);
});
