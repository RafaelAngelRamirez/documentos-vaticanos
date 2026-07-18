#!/usr/bin/env bash
# Run a .js test that imports sibling .ts pure-logic via --experimental-strip-types,
# without printing Node ExperimentalWarning / MODULE_TYPELESS_PACKAGE_JSON noise.
set -euo pipefail
exec node \
  --experimental-strip-types \
  --disable-warning=ExperimentalWarning \
  --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
  "$@"
