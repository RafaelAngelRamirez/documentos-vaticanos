#!/usr/bin/env node
/**
 * Zero-dep SPA static server (index.html fallback).
 * Usage: node spa-static.js <rootDir> [port]
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(process.argv[2] || '.');
const port = Number(process.argv[3] || 4173);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

function send(res, code, body, type) {
  res.writeHead(code, {
    'Content-Type': type || 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const rel = urlPath === '/' ? '/index.html' : urlPath;
  const file = path.normalize(path.join(root, rel));
  if (!file.startsWith(root)) {
    send(res, 403, 'forbidden');
    return;
  }
  fs.readFile(file, (err, data) => {
    if (!err) {
      send(res, 200, data, TYPES[path.extname(file)] || 'application/octet-stream');
      return;
    }
    fs.readFile(path.join(root, 'index.html'), (err2, html) => {
      if (err2) {
        send(res, 404, 'not found');
        return;
      }
      send(res, 200, html, TYPES['.html']);
    });
  });
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`spa-static ${root} http://127.0.0.1:${port}\n`);
});
