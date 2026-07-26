#!/usr/bin/env bash
set -euo pipefail
cd /home/angel/proyectos/personal/documentos-vaticanos
python3 documentos/corpus/revisions/_audit_tmp_agustin31.py \
  > documentos/corpus/revisions/_audit-agustin-31-stdout.json \
  2> documentos/corpus/revisions/_audit-agustin-31-stderr.json
echo "AUDIT31_OK"
