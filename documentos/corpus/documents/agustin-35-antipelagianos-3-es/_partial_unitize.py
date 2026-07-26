#!/usr/bin/env python3
"""Unitize clean text OR load content.json; emit multi-line audit sample JSON."""
import json
import re
from pathlib import Path

REPO = Path("/home/angel/proyectos/personal/documentos-vaticanos")
DOC = "agustin-35-antipelagianos-3-es"
CLEAN = REPO / f"documentos/padres-source/clean/{DOC}.txt"
CONTENT = REPO / f"documentos/corpus/documents/{DOC}/content.json"
OUT = REPO / f"documentos/corpus/documents/{DOC}/_audit_sample.json"
OCR_PH = "[OCR: índice o tabla ilegible omitido]"


def soft_normalize(text: str) -> str:
    t = text.replace("\r\n", "\n").replace("\r", "\n")
    t = re.sub(r"[ \t]+\n", "\n", t)
    t = re.sub(r"\n{3,}", "\n\n", t)
    t = re.sub(r"[ \t]{2,}", " ", t)
    return t.strip()


def rejoin_hyphen(text: str) -> str:
    return re.sub(r"(\w)-\n(\w)", r"\1\2", text)


def cap_unit_length(chunks, max_len=2500):
    out = []
    for chunk in chunks:
        if len(chunk) <= max_len:
            if len(chunk) >= 20:
                out.append(chunk)
            continue
        sents = re.split(r'(?<=[.!?…»"])\s+(?=[A-ZÁÉÍÓÚÜÑ¿¡\d«"])', chunk)
        buf = ""
        for s in sents:
            if not buf:
                buf = s
            elif len(buf) + 1 + len(s) <= max_len:
                buf = f"{buf} {s}"
            else:
                if len(buf.strip()) >= 20:
                    out.append(buf.strip())
                buf = s
        if buf.strip() and len(buf.strip()) >= 20:
            out.append(buf.strip())
    return out


def unitize_clean(path: Path):
    text = path.read_text(encoding="utf-8")
    text = rejoin_hyphen(text)
    text = soft_normalize(text)
    paras = [
        p.replace("\n", " ").strip()
        for p in re.split(r"\n\s*\n+", text)
        if p.replace("\n", " ").strip()
    ]
    chunks = cap_unit_length(paras, 2500)
    return [
        {"consecutivo": str(i + 1), "contenido": c, "referencias": []}
        for i, c in enumerate(chunks)
    ]


def classify(t: str, i: int, n: int):
    classes = []
    if not t:
        return classes
    if OCR_PH in t or t.startswith("[OCR:"):
        classes.append("toc_dotted_garbage")
        return classes
    if re.search(r"\.{2,}\s*[oncrimONCRIM]{4,}|[oncrimONCRIM]{12,}|(?:\.\s*){8,}|\.{8,}", t):
        classes.append("toc_dotted_garbage")
    if i < 100 and re.search(
        r"biblioteca de autores cristianos|DEP[OÓ]SITO LEGAL|ISBN|NIHIL OBSTAT|IMPRIMATUR|EDITORIAL CAT[OÓ]LICA|Impreso en España|MCML|BIBLIOTECA DE AUTORES|ARGIMIRO TURRADO|SEÑORES SIGUIENTES|Gran Canciller|PONTIFICIA UNIVERSIDAD|TEODORO C",
        t,
        re.I,
    ):
        classes.append("bac_chrome_frontmatter")
    if re.search(r"\b(?:[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]\s+){3,}[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]\b", t):
        classes.append("spaced_or_shredded_letters")
    if re.search(r"[a-záéíóúüñ]{2}\.[a-záéíóúüñ]{2}", t):
        classes.append("internal_word_period")
    if re.search(r"[A-Za-záéíóúüñÁÉÍÓÚÜÑ]-\s+[a-záéíóúüñ]", t):
        classes.append("hyphen_mid_line")
    if re.search(
        r"\b[A-ZÁÉÍÓÚÜÑ]{12,}\b|LOSSEÑORES|SANAGUST|PORLOS|ENEL|DELA|ALAÑO|[a-záéíóúüñ]{4,}[A-ZÁÉÍÓÚÜÑ]{2,}[a-záéíóúüñ]{3,}",
        t,
        re.I,
    ):
        classes.append("glued_words")
    if re.search(
        r"(?<![0-9.,/])\d{1,3}[A-Za-záéíóúüñÁÉÍÓÚÜÑ]{4,}|[A-Za-záéíóúüñÁÉÍÓÚÜÑ]{4,}\d{2,}(?![0-9.,])",
        t,
    ):
        classes.append("digit_glued_tokens")
    if re.search(r"Ã.|Â.|â€™|â€|\uFFFD|�", t):
        classes.append("mojibake/replacement_chars")
    lat = len(
        re.findall(
            r"\b(?:quod|quia|unde|ergo|enim|tamen|sicut|nihil|omnium|ecclesiae|baptismus|episcopus|apostolus|peccatum|voluntas|natura|hominis|dicit|dixit|nisi|neque|atque|igitur|secundum|propter)\b",
            t,
            re.I,
        )
    )
    es = len(
        re.findall(
            r"\b(?:que|de|la|el|los|las|por|con|una|del|como|para|este|gracia|pecado|hombre|dios)\b",
            t,
            re.I,
        )
    )
    if lat >= 5 and es <= 3 and i > 80 and len(t) > 80:
        classes.append("latin_mixed_into_spanish_body")
    if re.search(r"\.{4,}|(?:\.\s*){5,}", t):
        classes.append("ellipses_leaders")
    if (i >= 50 or len(t) < 160) and re.search(
        r"Obras de San Agust[ií]n|Biblioteca de Autores Cristianos|Escritos antipelagianos|Dep[oó]sito legal|P[áa]gina\s+\d+",
        t,
        re.I,
    ) and len(t) < 220:
        classes.append("page_headers_footers")
    if i >= n - 80 and (
        re.search(r"índice|index|tabla de|sumario", t, re.I)
        or (re.search(r"[oncrim]{8,}", t, re.I) and len(t) < 400)
        or (len(re.findall(r"\b\d{1,4}\b", t)) >= 8 and len(t) < 500)
    ):
        classes.append("index_noise")
    if re.search(
        r"\b(?:qiie|qne|baptisrno|espiritn|santi\.sim|sancti\.fic|despnes|tarnbien|Igiesia)\b|[aeiouAEIOU]['`´][a-z]|n~|N~",
        t,
        re.I,
    ):
        classes.append("accent_corruption")
    if len(t) > 200 and (
        re.search(
            r"[a-záéíóúüñ]{3,}\s+\d{2,3}\s+[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]{3,}.{10,}\d{2,3}\s+[A-ZÁÉÍÓÚÜÑ]",
            t,
        )
        or (
            re.search(
                r"[a-záéíóúüñ]{3,}[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]{2,}[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]{2,}",
                t,
            )
            and len(re.findall(r"[a-záéíóúüñ]{3,} [A-ZÁÉÍÓÚÜÑ]", t)) >= 6
        )
    ):
        classes.append("wrong_column_merge")
    letters = len(re.findall(r"[A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÿ]", t))
    vowels = len(re.findall(r"[aeiouáéíóúüAEIOUÁÉÍÓÚÜ]", t))
    junk = len(re.findall(r"[oncrim]{8,}", t, re.I))
    if letters > 100 and vowels / max(letters, 1) < 0.25:
        classes.append("other_illegible")
    if junk >= 2:
        classes.append("other_illegible")
    return list(dict.fromkeys(classes))


def snip(t, pat, maxn=150):
    m = re.search(pat, t, re.I) if isinstance(pat, str) else re.search(pat, t)
    if not m:
        return t[:maxn].replace("\n", " ")
    a = max(0, m.start() - 25)
    b = min(len(t), m.end() + 40)
    s = t[a:b].replace("\n", " ")
    if a:
        s = "…" + s
    if b < len(t):
        s = s + "…"
    return s[:maxn]


source = "content.json"
try:
    units = json.loads(CONTENT.read_text(encoding="utf-8"))
except Exception as e:
    units = unitize_clean(CLEAN)
    source = f"clean_unitize:{e}"

n = len(units)
front = list(range(min(80, n)))
mid_start, mid_end = 80, max(80, n - 40)
stride = max(1, (mid_end - mid_start) // 40)
mid = list(range(mid_start, mid_end, stride))[:40]
tail = list(range(max(0, n - 40), n))
sample_idx = sorted(set(front + mid + tail))

counts = {}
examples = {}
placeholder = []
worst = []

for i, u in enumerate(units):
    t = u.get("contenido") or ""
    cons = u.get("consecutivo") or ""
    cl = classify(t, i, n)
    for c in cl:
        counts[c] = counts.get(c, 0) + 1
        examples.setdefault(c, [])
        if len(examples[c]) < 4:
            pats = {
                "toc_dotted_garbage": r"(?:\.{3,}|[oncrim]{8,}|índice o tabla)",
                "bac_chrome_frontmatter": r"biblioteca de autores|DEP[OÓ]SITO|ISBN|IMPRIMATUR|EDITORIAL|BIBLIOTECA DE AUTORES|SEÑORES SIGUIENTES|ARGIMIRO",
                "spaced_or_shredded_letters": r"\b(?:[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]\s+){3,}[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]\b",
                "internal_word_period": r"[a-záéíóúüñ]{2}\.[a-záéíóúüñ]{2}",
                "hyphen_mid_line": r"[A-Za-záéíóúüñÁÉÍÓÚÜÑ]-\s+[a-záéíóúüñ]",
                "glued_words": r"LOSSEÑORES|SANAGUST|\b[A-ZÁÉÍÓÚÜÑ]{12,}\b|[a-záéíóúüñ]{4,}[A-ZÁÉÍÓÚÜÑ]{2,}",
                "digit_glued_tokens": r"\d[A-Za-záéíóúüñÁÉÍÓÚÜÑ]{4,}|[A-Za-záéíóúüñÁÉÍÓÚÜÑ]{4,}\d{2,}",
                "mojibake/replacement_chars": r"Ã.|Â.|â€|�",
                "latin_mixed_into_spanish_body": r"\b(?:quod|quia|enim|tamen|sicut|peccatum|voluntas)\b",
                "ellipses_leaders": r"\.{4,}|(?:\.\s*){5,}",
                "page_headers_footers": r"Biblioteca de Autores|Escritos antipelagianos|Dep[oó]sito legal|P[áa]gina",
                "index_noise": r"índice|index|\b\d{1,4}\b",
                "accent_corruption": r"qiie|santi\.|sancti\.|[aeiou]['`´]|n~",
                "wrong_column_merge": r"\d{2,3}\s+[A-ZÁÉÍÓÚÜÑ]|[a-záéíóúüñ]{3,}[A-ZÁÉÍÓÚÜÑ]",
                "other_illegible": r"[oncrim]{8,}",
            }
            examples[c].append(
                {
                    "unitIndex": i,
                    "consecutivo": cons,
                    "snippet": snip(t, pats.get(c, r".{1,80}")),
                }
            )
    if OCR_PH in t:
        placeholder.append(i)
    hy = len(re.findall(r"[A-Za-záéíóúüñÁÉÍÓÚÜÑ]-\s+[a-záéíóúüñ]", t))
    score = 0
    if OCR_PH in t:
        score += 25
    if re.search(r"[oncrim]{12,}", t, re.I):
        score += 40
    score += min(30, hy * 3)
    score += min(
        30, len(re.findall(r"[a-záéíóúüñ]{2}\.[a-záéíóúüñ]{2}", t)) * 8
    )
    if score >= 15 or cl:
        worst.append(
            {
                "sev": score,
                "i": i,
                "cons": cons,
                "cl": cl,
                "head": t[:160].replace("\n", " "),
            }
        )

worst.sort(key=lambda x: -x["sev"])
sample = []
for i in sample_idx:
    t = units[i].get("contenido") or ""
    sample.append(
        {
            "unitIndex": i,
            "consecutivo": units[i].get("consecutivo"),
            "len": len(t),
            "classes": classify(t, i, n),
            "head": t[:300].replace("\n", " "),
        }
    )

# severity
hy_count = counts.get("hyphen_mid_line", 0)
ph = len(placeholder)
avg = 0
if sample:
    # rough
    avg = sum(1 for s in sample if s["classes"]) / len(sample) * 40
severity = int(min(100, max(18, avg + (12 if ph > 15 else 0) + (15 if hy_count > 400 else 8 if hy_count > 100 else 0) + (8 if counts.get("wrong_column_merge", 0) > 20 else 0) + (5 if counts.get("latin_mixed_into_spanish_body", 0) > 10 else 0))))

report = {
    "source": source,
    "documentId": DOC,
    "unitsTotal": n,
    "unitsSampled": len(sample),
    "severityScore": severity,
    "placeholderCount": ph,
    "placeholderFirst40": placeholder[:40],
    "placeholderLast20": [i for i in placeholder if i >= n - 100][:20],
    "classCounts": counts,
    "classExamples": examples,
    "frontMatterNoise": any(
        s["unitIndex"] < 80 and s["classes"] for s in sample
    ),
    "bodyProseNoise": hy_count > 50
    or counts.get("wrong_column_merge", 0) > 10
    or counts.get("latin_mixed_into_spanish_body", 0) > 5,
    "indexGarbage": any(i >= n - 80 for i in placeholder)
    or counts.get("index_noise", 0) > 5,
    "worst40": worst[:40],
    "sampleFront": [s for s in sample if s["unitIndex"] < 80],
    "sampleMid": [s for s in sample if 80 <= s["unitIndex"] < n - 40],
    "sampleTail": [s for s in sample if s["unitIndex"] >= n - 40],
}

OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print("wrote", OUT, "source=", source, "n=", n, "severity=", severity)
print("counts", json.dumps(counts, ensure_ascii=False))
print("placeholders", ph)
