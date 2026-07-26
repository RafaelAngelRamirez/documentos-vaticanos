#!/usr/bin/env python3
"""Unitize clean text in-process and emit NDJSON samples (run if shell available)."""
import json, re
from pathlib import Path

REPO = Path("/home/angel/proyectos/personal/documentos-vaticanos")
CLEAN = REPO / "documentos/padres-source/clean/agustin-34-antidonatistas-3-es.txt"
CONTENT = REPO / "documentos/corpus/documents/agustin-34-antidonatistas-3-es/content.json"
OUT = REPO / "documentos/corpus/documents/agustin-34-antidonatistas-3-es/_audit_sample.json"

# --- if content.json load works, use it ---
try:
    units = json.loads(CONTENT.read_text(encoding="utf-8"))
    source = "content.json"
except Exception as e:
    units = None
    source = f"fallback:{e}"

if units is None:
    # minimal fallback: paragraph split of clean
    text = CLEAN.read_text(encoding="utf-8")
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"(\w)-\n(\w)", r"\1\2", text)
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text).strip()
    chunks = [p.replace("\n", " ").strip() for p in re.split(r"\n\s*\n+", text) if p.replace("\n", " ").strip()]
    # cap length
    capped = []
    for chunk in chunks:
        if len(chunk) <= 2500:
            if len(chunk) >= 20:
                capped.append(chunk)
            continue
        sents = re.split(r'(?<=[.!?…»"])\s+(?=[A-ZÁÉÍÓÚÜÑ¿¡\d«"])', chunk)
        buf = ""
        for s in sents:
            if not buf:
                buf = s
            elif len(buf) + 1 + len(s) <= 2500:
                buf = f"{buf} {s}"
            else:
                if len(buf.strip()) >= 20:
                    capped.append(buf.strip())
                buf = s
        if buf.strip() and len(buf.strip()) >= 20:
            capped.append(buf.strip())
    units = [{"consecutivo": str(i + 1), "contenido": c} for i, c in enumerate(capped)]

# write compact sample report
n = len(units)
print("SOURCE", source, "UNITS", n)

# exact content scan if we have it
OCR_PH = "[OCR: índice o tabla ilegible omitido]"
rows = []
for i, u in enumerate(units):
    t = u.get("contenido") or ""
    rows.append((i, u.get("consecutivo"), len(t), t[:100].replace("\n", " "), OCR_PH in t))

ph = [r for r in rows if r[4]]
print("PLACEHOLDERS", len(ph), "first", [r[0] for r in ph[:40]])
print("LAST10")
for r in rows[-10:]:
    print(r[0], r[1], r[2], r[3][:80])
print("FIRST15")
for r in rows[:15]:
    print(r[0], r[1], r[2], r[3][:80])

# mid samples
for i in range(100, n - 80, max(1, (n - 180) // 40))[:40]:
    r = rows[i]
    print("MID", r[0], r[1], r[2], r[3][:80])
