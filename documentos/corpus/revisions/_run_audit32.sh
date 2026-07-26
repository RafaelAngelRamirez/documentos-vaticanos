#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../.."
python3 documentos/corpus/revisions/_audit_tmp_agustin32.py > documentos/corpus/revisions/_audit-agustin-32-antidonatistas-1-es-report.json
echo "done"
