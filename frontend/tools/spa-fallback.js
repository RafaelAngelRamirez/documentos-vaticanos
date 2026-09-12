'use strict';

// Angular 16 webpack-dev-server htmlAcceptHeaders omit '*/*'.
// curl default Accept is that token, so GET /explorar/relaciones 404s
// (`Cannot GET`) while browsers (Accept: text/html) already get index.html.
// proxy.conf.json is the wrong tool. extra-webpack.config.js is unused here.
// Serve-only transform; production nginx uses try_files.
function withSpaFallback(config) {
  const ds = config && config.devServer;
  if (!ds) return config;

  const fallback = ds.historyApiFallback;
  if (!fallback || fallback === true) {
    ds.historyApiFallback = {
      disableDotRule: true,
      htmlAcceptHeaders: ['text/html', 'application/xhtml+xml', '*/*'],
    };
    return config;
  }

  const headers = Array.isArray(fallback.htmlAcceptHeaders)
    ? fallback.htmlAcceptHeaders.slice()
    : ['text/html', 'application/xhtml+xml'];
  if (!headers.includes('*/*')) headers.push('*/*');
  fallback.htmlAcceptHeaders = headers;
  return config;
}

module.exports = { withSpaFallback };
