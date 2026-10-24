'use strict';

const { createBuilder } = require('@angular-devkit/architect');
const { executeDevServerBuilder } = require('@angular-devkit/build-angular');
const { withSpaFallback } = require('./spa-fallback');

/**
 * Serve-only wrapper: same schema as @angular-devkit/build-angular:dev-server.
 * Production `build` target stays on the official browser builder.
 */
module.exports = createBuilder((options, context) =>
  executeDevServerBuilder(options, context, {
    webpackConfiguration: withSpaFallback,
  }),
);
