#!/usr/bin/env bash
set -euo pipefail
cd /home/angel/proyectos/personal/documentos-vaticanos
python3 documentos/corpus/revisions/_audit_tmp_agustin34.py \
  > documentos/corpus/revisions/_audit-agustin-34-stdout.json \
  2> documentos/corpus/revisions/_audit-agustin-34-stderr.txt
echo "AUDIT34_OK"
