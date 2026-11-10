#!/usr/bin/env bash
# Cheap tests from the n8n entry (.ci-build.sh) and the pull-request workflow.
# No release, no web package, no APK. DV_CI=1 matches the build entry.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export DV_CI=1

bash scripts/ci-agent-gate.sh map

npm --prefix frontend run test:open-reading
npm --prefix frontend run test:reader-prefs
npm --prefix frontend run test:unit-bookmark
npm --prefix frontend run test:review
npm --prefix frontend run test:reader-bars
npm --prefix frontend run test:mobile-flows
npm --prefix frontend run test:speech-prep
npm --prefix frontend run test:speech-lang
npm --prefix frontend run test:read-aloud
npm --prefix frontend run test:ui-i18n
npm --prefix frontend run test:clases
npm --prefix frontend run test:sync-journal
npm --prefix frontend run test:unpack-ship-index
npm --prefix frontend run test:shelf-search
node scripts-descarga/corpus_structure_contract.test.js
node scripts/corpus-sync-assets.test.js
node scripts/patristic-pack.test.js
node scripts/patristic-pack.js proof --canonical documentos/corpus --check --out scripts/proof/patristic-pack-hash.ndjson
bash scripts/node-strip-types.sh frontend/src/app/core/corpus/patristic-pack.logic.test.js
node scripts/on-demand-sources.test.js
bash scripts/on-demand-ship.test.sh
node scripts/dead-style-copies.test.js
node scripts-descarga/write_corpus_copy.test.js
bash scripts/node-strip-types.sh backend/src/routes/references-document-id.logic.test.js
node scripts/agent-structure.test.js
bash scripts/ci-release-guard.test.sh
node scripts/ci-evidence-policy.test.mjs
