/**
 * SPA historyApiFallback: curl default Accept must rewrite to index.html.
 * Run: node frontend/tools/spa-fallback.test.js
 */
'use strict';

const assert = require('assert');
const path = require('path');
const history = require(path.join(
  __dirname,
  '../node_modules/connect-history-api-fallback',
));
const { withSpaFallback } = require('./spa-fallback');

function rewrittenUrl(options, accept) {
  const req = {
    method: 'GET',
    url: '/explorar/relaciones',
    headers: { accept },
  };
  history(options)(req, {}, () => {});
  return req.url;
}

const angularDefault = {
  htmlAcceptHeaders: ['text/html', 'application/xhtml+xml'],
};
assert.strictEqual(
  rewrittenUrl(angularDefault, '*/*'),
  '/explorar/relaciones',
  'stock Angular 16 does not rewrite curl Accept */*',
);
assert.strictEqual(
  rewrittenUrl(angularDefault, 'text/html'),
  '/index.html',
  'browsers with text/html already fall back',
);

const patched = withSpaFallback({
  devServer: { historyApiFallback: { ...angularDefault } },
}).devServer.historyApiFallback;
assert.ok(patched.htmlAcceptHeaders.includes('*/*'), 'adds */*');
assert.strictEqual(
  rewrittenUrl(patched, '*/*'),
  '/index.html',
  'curl default Accept rewrites to index.html',
);
assert.strictEqual(
  rewrittenUrl(patched, 'text/html'),
  '/index.html',
  'browser Accept still rewrites',
);

const enabled = withSpaFallback({
  devServer: { historyApiFallback: true },
}).devServer.historyApiFallback;
assert.ok(enabled.htmlAcceptHeaders.includes('*/*'));

console.log('spa-fallback.test.js: ok');
