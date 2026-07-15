/**
 * Path helpers for the Electron shell.
 * Pure Node — no Electron import — so unit tests can assert production asset paths.
 */
const fs = require('fs');
const path = require('path');

/** @returns {string} Absolute path to the frontend package root (parent of electron/). */
function getFrontendRoot() {
  return path.resolve(__dirname, '..');
}

/**
 * Resolve the Angular production web dist directory.
 * @param {string} [frontendRoot]
 * @returns {string}
 */
function resolveWebDist(frontendRoot = getFrontendRoot()) {
  return path.join(path.resolve(frontendRoot), 'dist', 'documentos-vaticanos');
}

/**
 * Resolve production index.html inside the web dist.
 * @param {string} [frontendRoot]
 * @returns {string}
 */
function resolveIndexHtml(frontendRoot = getFrontendRoot()) {
  return path.join(resolveWebDist(frontendRoot), 'index.html');
}

/**
 * Resolve offline corpus manifest under packaged assets.
 * @param {string} [frontendRoot]
 * @returns {string}
 */
function resolveCorpusManifest(frontendRoot = getFrontendRoot()) {
  return path.join(
    resolveWebDist(frontendRoot),
    'assets',
    'corpus',
    'manifest.json'
  );
}

/**
 * Assert the production web tree is ready for Electron / packaging.
 * @param {string} [frontendRoot]
 * @returns {{ webDist: string, indexHtml: string, corpusManifest: string }}
 */
function assertWebDistReady(frontendRoot = getFrontendRoot()) {
  const webDist = resolveWebDist(frontendRoot);
  const indexHtml = resolveIndexHtml(frontendRoot);
  const corpusManifest = resolveCorpusManifest(frontendRoot);

  if (!fs.existsSync(webDist)) {
    throw new Error(
      `Web dist missing: ${webDist}. Run "npm run build" in frontend/ first.`
    );
  }
  if (!fs.existsSync(indexHtml)) {
    throw new Error(`index.html missing: ${indexHtml}`);
  }
  if (!fs.existsSync(corpusManifest)) {
    throw new Error(
      `Offline corpus manifest missing: ${corpusManifest}`
    );
  }

  return { webDist, indexHtml, corpusManifest };
}

/**
 * MIME types for the local static server (PathLocationStrategy + base href /).
 * @param {string} filePath
 * @returns {string}
 */
function mimeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.map': 'application/json',
    '.txt': 'text/plain; charset=utf-8',
  };
  return map[ext] || 'application/octet-stream';
}

/**
 * Map a URL pathname to a file under webDist (SPA fallback to index.html).
 * @param {string} webDist
 * @param {string} urlPathname
 * @returns {string}
 */
function resolveStaticFile(webDist, urlPathname) {
  let rel = decodeURIComponent(urlPathname.split('?')[0]);
  if (!rel || rel === '/') {
    return path.join(webDist, 'index.html');
  }
  // Prevent path escape
  rel = path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, '');
  if (rel.startsWith('/')) {
    rel = rel.slice(1);
  }
  const candidate = path.join(webDist, rel);
  if (!candidate.startsWith(webDist)) {
    return path.join(webDist, 'index.html');
  }
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return candidate;
  }
  // Angular PathLocationStrategy: unknown paths → index.html
  return path.join(webDist, 'index.html');
}

module.exports = {
  getFrontendRoot,
  resolveWebDist,
  resolveIndexHtml,
  resolveCorpusManifest,
  assertWebDistReady,
  mimeFor,
  resolveStaticFile,
};
