/**
 * Minimal HTTP static server for the production Angular tree.
 * Serves with base href "/" so PathLocationStrategy works offline in Electron.
 */
const http = require('http');
const fs = require('fs');
const { mimeFor, resolveStaticFile } = require('./paths');

/**
 * @param {string} webDist Absolute path to dist/documentos-vaticanos
 * @param {{ host?: string, port?: number }} [opts]
 * @returns {Promise<{ server: import('http').Server, url: string, port: number, close: () => Promise<void> }>}
 */
function startStaticServer(webDist, opts = {}) {
  const host = opts.host || '127.0.0.1';
  const preferredPort = opts.port || 0;

  const server = http.createServer((req, res) => {
    try {
      const url = new URL(req.url || '/', `http://${host}`);
      const filePath = resolveStaticFile(webDist, url.pathname);
      const body = fs.readFileSync(filePath);
      res.writeHead(200, {
        'Content-Type': mimeFor(filePath),
        'Content-Length': body.length,
        'Cache-Control': 'no-cache',
      });
      res.end(body);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(String(err && err.message ? err.message : err));
    }
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(preferredPort, host, () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : preferredPort;
      const url = `http://${host}:${port}/`;
      resolve({
        server,
        url,
        port,
        close: () =>
          new Promise((resClose, rejClose) => {
            server.close((e) => (e ? rejClose(e) : resClose()));
          }),
      });
    });
  });
}

module.exports = { startStaticServer };
