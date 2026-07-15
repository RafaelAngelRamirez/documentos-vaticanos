#!/usr/bin/env bash
# Back-compat wrapper → ocr_volume.sh (padres-source layout).
#   ./ocr_padres_volume.sh --pdf ../documentos/padres-source/pdf/agustin-12.pdf \
#     --doc-id agustin-12-tratados-morales-es --jobs 4
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
exec bash "$DIR/ocr_volume.sh" --source-root padres-source --lang spa_fast "$@"
