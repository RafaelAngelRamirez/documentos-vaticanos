#!/usr/bin/env python3
"""
Approximate unit-aligned residual OCR audit using clean text + known content.json
placeholders. Also loads content.json when possible for exact unitIndex samples.
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
# parents: doc dir -> documents -> corpus -> documentos -> repo
# Path: .../documents/agustin-34.../_audit_from_clean.py
# parent0=agustin-34, 1=documents, 2=corpus, 3=documentos, 4=repo
REPO = Path("/home/angel/proyectos/personal/documentos-vaticanos")
CONTENT = REPO / "documentos/corpus/documents/agustin-34-antidonatistas-3-es/content.json"
CLEAN = REPO / "documentos/padres-source/clean/agustin-34-antidonatistas-3-es.txt"
OUT = REPO / "documentos/corpus/documents/agustin-34-antidonatistas-3-es/_audit_sample.json"
OCR_PH = "[OCR: índice o tabla ilegible omitido]"
LETTER = r"A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÿ"

def soft_normalize(text: str) -> str:
    t = text.replace("\r\n", "\n").replace("\r", "\n")
    t = re.sub(r"[ \t]+\n", "\n", t)
    t = re.sub(r"\n{3,}", "\n\n", t)
    t = re.sub(r"[ \t]{2,}", " ", t)
    return t.strip()

def rejoin_hyphen(text: str) -> str:
    return re.sub(r"(\w)-\n(\w)", r"\1\2", text, flags=re.UNICODE)

def strip_pdf_chrome(text: str) -> str:
    t = text.replace("\r\n", "\n").replace("\r", "\n")
    t = re.sub(r"PÁGINA\s*\n\s*ABIERTA", "", t, flags=re.I)
    t = re.sub(r"PÁGINA\s+ABIERTA[^\n]*", "", t, flags=re.I)
    out = []
    for line in t.split("\n"):
        s = line.strip()
        if not s:
            out.append("")
            continue
        if re.match(r"^PÁGINA\s*ABIERTA", s, re.I):
            continue
        if re.match(r"^\d{1,4}$", s):
            continue
        if re.match(r"^\d+\s*\[\d+\]", s):
            continue
        out.append(line)
    return "\n".join(out)

def collapse_spaced_letters(text: str) -> str:
    # simplified: collapse runs of ≥4 single letters
    def repl(m):
        return m.group(0).replace(" ", "")
    return re.sub(
        r"\b(?:[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]\s+){3,}[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]\b",
        repl,
        text,
    )

def repair_punct_basic(text: str) -> str:
    t = re.sub(r"(?:\s*\.\s*){3,}", "...", text)
    t = re.sub(r"[ \t]+([,;:!?])", r"\1", t)
    t = re.sub(r"[ \t]+\.(?!\.)", ".", t)
    t = re.sub(r"([,;])(?=[A-Za-zÁÉÍÓÚÜÑáéíóúüñ])", r"\1 ", t)
    t = re.sub(r":(?=[A-Za-zÁÉÍÓÚÜÑáéíóúüñ])", ": ", t)
    t = re.sub(r"(?<=[a-záéíóúüñ]{2})\.(?=[A-ZÁÉÍÓÚÜÑ])", ". ", t)
    t = re.sub(r"[ \t]{2,}", " ", t)
    return t

def split_paragraphs(text: str):
    t = soft_normalize(text)
    parts = re.split(r"\n\s*\n+", t)
    return [p.replace("\n", " ").strip() for p in parts if p.replace("\n", " ").strip()]

def cap_unit_length(chunks, max_len=2500):
    out = []
    for chunk in chunks:
        if len(chunk) <= max_len:
            out.append(chunk)
            continue
        sentences = re.split(r'(?<=[.!?…»"])\s+(?=[A-ZÁÉÍÓÚÜÑ¿¡\d«"])', chunk)
        buf = ""
        for s in sentences:
            if not buf:
                buf = s
            elif len(buf) + 1 + len(s) <= max_len:
                buf = f"{buf} {s}"
            else:
                out.append(buf.strip())
                buf = s
        if buf.strip():
            out.append(buf.strip())
    return out

def plain_text_to_units(text: str):
    prepared = strip_pdf_chrome(text)
    prepared = rejoin_hyphen(prepared)
    prepared = soft_normalize(prepared)
    prepared = collapse_spaced_letters(prepared)
    prepared = repair_punct_basic(prepared)
    prepared = soft_normalize(prepared)
    chunks = split_paragraphs(prepared)
    chunks = cap_unit_length(chunks, 2500)
    units = []
    n = 0
    for raw in chunks:
        contenido = soft_normalize(raw)
        if len(contenido) < 20:
            continue
        n += 1
        units.append({"consecutivo": str(n), "contenido": contenido, "referencias": []})
    return units

def classify(t, i, n):
    classes = []
    if not t:
        return classes
    if OCR_PH in t or t.startswith("[OCR:"):
        classes.append("other_illegible")
    if re.search(r"\.{2,}\s*[oncrimONCRIM]{4,}", t) or re.search(r"[oncrimONCRIM]{12,}", t) or re.search(r"(?:\.\s*){10,}|\.{10,}", t):
        classes.append("toc_dotted_garbage")
    if i < 100 and re.search(r"biblioteca de autores cristianos|DEP[OÓ]SITO LEGAL|ISBN|NIHIL OBSTAT|IMPRIMATUR|EDITORIAL CAT[OÓ]LICA|Impreso en España|MCMXCIV", t, re.I):
        classes.append("bac_chrome_frontmatter")
    if re.search(r"\b(?:[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]\s+){3,}[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]\b", t):
        classes.append("spaced_or_shredded_letters")
    if re.search(r"[a-záéíóúüñ]{2,}\.[a-záéíóúüñ]{2,}", t):
        classes.append("internal_word_period")
    if re.search(r"[A-Za-záéíóúüñÁÉÍÓÚÜÑ]-\s+[a-záéíóúüñ]", t):
        classes.append("hyphen_mid_line")
    if re.search(r"\b[A-ZÁÉÍÓÚÜÑ]{12,}\b", t) or re.search(r"[a-záéíóúüñ]{4,}[A-ZÁÉÍÓÚÜÑ]{3,}[a-záéíóúüñ]{3,}", t):
        classes.append("glued_words")
    if re.search(r"(?<![0-9./])\d{1,3}[A-Za-záéíóúüñÁÉÍÓÚÜÑ]{4,}|[A-Za-záéíóúüñÁÉÍÓÚÜÑ]{4,}\d{3,}(?![0-9])", t):
        classes.append("digit_glued_tokens")
    if re.search(r"Ã.|Â.|â€™|â€|\uFFFD|�", t):
        classes.append("mojibake/replacement_chars")
    lat = len(re.findall(r"\b(?:quod|quia|unde|ergo|enim|tamen|sicut|nihil|omnium|ecclesiae|baptismus|episcopus|episcopi|Hierusalem|apostolus)\b", t, re.I))
    if lat >= 4 and i > 50:
        classes.append("latin_mixed_into_spanish_body")
    if re.search(r"\.{4,}|(?:\.\s*){5,}", t):
        classes.append("ellipses_leaders")
    if i >= 50 and re.search(r"Obras de San Agust[ií]n|Biblioteca de Autores Cristianos|Escritos antidonatistas\s+\d|Dep[oó]sito legal|P[áa]gina\s+\d+", t, re.I):
        classes.append("page_headers_footers")
    if re.search(r"[A-Za-záéíóúüñ]{3,}\s*\.{3,}\s*\d+\s*$", t, re.M) or re.search(r"(?:\.\s*){6,}\d+", t) or re.search(r"^\s*(índice|index|tabla de|sumario)\b", t, re.I) or (i >= n - 100 and (re.search(r"[oncrim]{8,}", t, re.I) or OCR_PH in t)):
        classes.append("index_noise")
    if re.search(r"\b(?:qiie|qne|baptisrno|espiritn|santi\.sim|sancti\.fic|despnes|tarnbien|Igiesia|cat[o0]lica)\b", t, re.I):
        classes.append("accent_corruption")
    if re.search(r"[a-záéíóúüñ]{3,}[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]{2,}[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]{2,}", t) and len(t) > 200:
        classes.append("wrong_column_merge")
    letters = len(re.findall(f"[{LETTER}]", t))
    vowels = len(re.findall(r"[aeiouáéíóúüAEIOUÁÉÍÓÚÜ]", t))
    junk = len(re.findall(r"[oncrim]{8,}", t, re.I))
    if letters > 100 and vowels / max(letters, 1) < 0.25:
        classes.append("other_illegible")
    if junk >= 2:
        classes.append("other_illegible")
    return list(dict.fromkeys(classes))

def severity(t):
    if not t or not t.strip():
        return 5
    s = 0
    if OCR_PH in t:
        s += 25
    if re.search(r"[oncrim]{12,}", t, re.I) or re.search(r"\.{2,}\s*[oncrim]{4,}", t, re.I):
        s += 40
    if re.search(r"\b(?:[A-Za-z]\s+){3,}[A-Za-z]\b", t):
        s += 20
    iwp = len(re.findall(r"[a-záéíóúüñ]{2,}\.[a-záéíóúüñ]{2,}", t))
    s += min(30, iwp * 8)
    if re.search(r"[A-Za-z]-\s+[a-z]", t):
        s += 8
    if re.search(r"\uFFFD|�|Ã.|Â.", t):
        s += 30
    if re.search(r"\.{4,}", t):
        s += 12
    letters = len(re.findall(f"[{LETTER}]", t))
    vowels = len(re.findall(r"[aeiouáéíóúüAEIOUÁÉÍÓÚÜ]", t))
    if letters > 80 and vowels / max(letters, 1) < 0.25:
        s += 30
    if len(re.findall(r"[oncrim]{8,}", t, re.I)) >= 2:
        s += 25
    return min(100, s)

def analyze(units, source_label):
    n = len(units)
    front = list(range(min(80, n)))
    mid_start, mid_end = 100, max(100, n - 80)
    stride = max(1, (mid_end - mid_start) // 40)
    mid = list(range(mid_start, mid_end, stride))[:40]
    tail = list(range(max(0, n - 40), n))
    sample_idx = sorted(set(front + mid + tail))

    class_counts = {}
    class_examples = {}
    front_noise = body_noise = index_garbage = 0
    placeholder_units = []
    iwp_units = []
    junk_units = []
    worst = []

    for i, u in enumerate(units):
        t = u.get("contenido") or ""
        cons = u.get("consecutivo") or ""
        cl = classify(t, i, n)
        sev = severity(t)
        for c in cl:
            class_counts[c] = class_counts.get(c, 0) + 1
            class_examples.setdefault(c, [])
            if len(class_examples[c]) < 4:
                snip = t[:160].replace("\n", " ")
                if c == "internal_word_period":
                    m = re.search(r".{0,25}[a-záéíóúüñ]{2,}\.[a-záéíóúüñ]{2,}.{0,25}", t)
                    if m:
                        snip = m.group(0).replace("\n", " ")
                if c == "hyphen_mid_line":
                    m = re.search(r".{0,20}[A-Za-záéíóúüñÁÉÍÓÚÜÑ]-\s+[a-záéíóúüñ].{0,20}", t)
                    if m:
                        snip = m.group(0).replace("\n", " ")
                if c in ("toc_dotted_garbage", "ellipses_leaders"):
                    m = re.search(r".{0,20}(?:\.{3,}|[oncrim]{8,}).{0,40}", t, re.I)
                    if m:
                        snip = m.group(0).replace("\n", " ")
                class_examples[c].append({"unitIndex": i, "consecutivo": cons, "snippet": snip[:150]})
        if i < 80 and (sev >= 20 or cl):
            front_noise += 1
        if 100 <= i < n - 80 and sev >= 20:
            body_noise += 1
        if i >= n - 80 and (sev >= 25 or "index_noise" in cl or "toc_dotted_garbage" in cl or OCR_PH in t):
            index_garbage += 1
        if OCR_PH in t:
            placeholder_units.append(i)
        if re.search(r"[a-záéíóúüñ]{2,}\.[a-záéíóúüñ]{2,}", t):
            toks = re.findall(r"[a-záéíóúüñ]{2,}\.[a-záéíóúüñ]{2,}", t)
            iwp_units.append({"i": i, "cons": cons, "toks": toks[:5]})
        if re.search(r"[oncrim]{10,}", t, re.I) or re.search(r"\.{2,}\s*[oncrim]{4,}", t, re.I):
            junk_units.append({"i": i, "cons": cons, "head": t[:120]})
        if sev >= 15:
            worst.append({"sev": sev, "i": i, "cons": cons, "cl": cl, "head": t[:140].replace("\n", " ")})

    worst.sort(key=lambda x: -x["sev"])
    sample = []
    for i in sample_idx:
        t = units[i].get("contenido") or ""
        sample.append({
            "unitIndex": i,
            "consecutivo": units[i].get("consecutivo"),
            "len": len(t),
            "severity": severity(t),
            "classes": classify(t, i, n),
            "head": t[:220].replace("\n", " "),
        })
    avg = sum(s["severity"] for s in sample) / max(len(sample), 1)
    return {
        "source": source_label,
        "documentId": "agustin-34-antidonatistas-3-es",
        "unitsTotal": n,
        "unitsSampled": len(sample),
        "frontNoiseUnits": front_noise,
        "bodyNoiseUnits": body_noise,
        "indexGarbageTail80": index_garbage,
        "sampleAvgSeverity": round(avg),
        "placeholderCount": len(placeholder_units),
        "placeholderFirst30": placeholder_units[:30],
        "classCounts": class_counts,
        "classExamples": class_examples,
        "iwpCount": len(iwp_units),
        "iwpSample": iwp_units[:20],
        "junkUnits": junk_units[:20],
        "worst25": worst[:25],
        "sampleFront": [s for s in sample if s["unitIndex"] < 80][:20],
        "sampleMid": [s for s in sample if 100 <= s["unitIndex"] < n - 80][:15],
        "sampleTail": [s for s in sample if s["unitIndex"] >= n - 40],
    }

def main():
    reports = {}
    # Prefer exact content.json
    if CONTENT.exists():
        units = json.loads(CONTENT.read_text(encoding="utf-8"))
        reports["content"] = analyze(units, "content.json")
        print("content units", len(units))
        print("content classes", reports["content"]["classCounts"])
        print("placeholders", reports["content"]["placeholderCount"])
    # Also clean re-unitize for comparison
    clean_text = CLEAN.read_text(encoding="utf-8")
    clean_units = plain_text_to_units(clean_text)
    reports["clean_reunitized"] = analyze(clean_units, "clean_reunitized")
    print("clean units", len(clean_units))
    print("clean classes", reports["clean_reunitized"]["classCounts"])
    OUT.write_text(json.dumps(reports, ensure_ascii=False, indent=2), encoding="utf-8")
    print("wrote", OUT)

if __name__ == "__main__":
    main()
