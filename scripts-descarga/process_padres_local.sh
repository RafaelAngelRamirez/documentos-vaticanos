#!/usr/bin/env bash
# Process LOCAL PDFs only (no download). Text extract or OCR → corpus.
# Run this while download_padres_queue.sh fills documentos/padres-source/pdf/.
#
#   ./process_padres_local.sh --ns 3,4,6
#   ./process_padres_local.sh --all-pending --skip-ocr   # only text-layer tomos
#   ./process_padres_local.sh --all-pending              # text + OCR images
set -euo pipefail
export PATH="/home/linuxbrew/.linuxbrew/bin:/usr/bin:$PATH"

REPO="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPTS="$REPO/scripts-descarga"
# Reuse batch logic with --skip-download (never hits the network)
exec bash "$SCRIPTS/batch_agustin_pending.sh" --skip-download "$@"