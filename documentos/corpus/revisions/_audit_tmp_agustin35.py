#!/usr/bin/env python3
"""Residual OCR/syntax audit sampler for agustin-35-antipelagianos-3-es."""
import json
import re
from collections import defaultdict
from pathlib import Path

DOC_ID = "agustin-35-antipelagianos-3-es"
PATH = Path(
    "/home/angel/proyectos/personal/documentos-vaticanos/documentos/corpus/documents"
    f"/{DOC_ID}/content.json"
)
OUT = Path(
    "/home/angel/proyectos/personal/documentos-vaticanos/documentos/corpus/revisions"
    f"/_audit_sample_{DOC_ID}.json"
)

units = json.loads(PATH.read_text(encoding="utf-8"))
n = len(units)

# Sample indices: front 80, mid ~40 at strides, tail 40
front = list(range(min(80, n)))
tail = list(range(max(0, n - 40), n))
# body middle: from 80 to n-40 exclusive, ~40 evenly spaced
body_start, body_end = 80, max(80, n - 40)
body = []
if body_end > body_start:
    step = max(1, (body_end - body_start) // 40)
    body = list(range(body_start, body_end, step))[:40]

sample_idx = sorted(set(front + body + tail))

PLACEHOLDER = "[OCR: índice o tabla ilegible omitido]"

# Defect detectors
PATTERNS = {
    "toc_dotted_garbage": re.compile(
        r"(?:\.\s*){6,}|\.{5,}|[^\S\n]*\.\s*\.\s*\.\s*\.\s*\."
    ),
    "spaced_or_shredded_letters": re.compile(
        r"(?:(?<=\s)|^)(?:[A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÿ]\s+){3,}[A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÿ](?=\s|$|[.,;:])"
    ),
    "internal_word_period": re.compile(
        r"[a-záéíóúüñà-ÿ]{2}\.[a-záéíóúüñà-ÿ]{2}"
    ),
    "hyphen_mid_line": re.compile(
        r"[A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÿ]-\s+[a-záéíóúüñà-ÿ]"
    ),
    "glued_words": re.compile(
        # ALLCAPS glue or obvious camel-glue Spanish function words
        r"(?:[A-ZÁÉÍÓÚÜÑ]{2,}[a-záéíóúüñ]{3,}|[a-záéíóúüñ]{3,}(?:LOS|LAS|DEL|QUE|POR|CON|UNA|LOS|DE|EL|LA)[A-ZÁÉÍÓÚÜÑ]?|"
        r"(?:[A-ZÁÉÍÓÚÜÑ]{4,}){2,}|"  # LOSSEÑORES style allcaps glued often hard
        r"[a-záéíóúüñ]{5,}[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]{2,})"
    ),
    "digit_glued_tokens": re.compile(
        r"(?:\d[A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÿ]{2,}|[A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÿ]{2,}\d)"
    ),
    "mojibake_replacement_chars": re.compile(
        r"�|Ã[¡-¿]|Â.|â€|ï»¿|\\u00[0-9a-fA-F]{2}"
    ),
    "ellipses_leaders": re.compile(r"(?:\.\s*){4,}|\.{4,}"),
    "page_headers_footers": re.compile(
        r"(?i)(?:biblioteca de autores cristianos|\bBAC\b|página\s+\d+|pág\.\s*\d+|"
        r"^\s*\d{1,4}\s*$|SAN AGUST[IÍ]N\s*[-–—]\s*OBRAS)"
    ),
    "accent_corruption": re.compile(
        # common OCR accent mess: qiíe already fixed; residual like n~ , a', e'
        r"\b\w*[áéíóúñÁÉÍÓÚÑ]?\w*[`´^~¨]\w*\b|[aeiou]['`´](?=[a-z])|n~|N~"
    ),
    "latin_mixed_into_spanish_body": re.compile(
        # heuristic: dense classical Latin function words in Spanish body units
        r"\b(?:quod|quia|quoniam|enim|autem|igitur|tamen|secundum|propter|"
        r"dominus|deus|spiritus|sanctus|gratia|peccatum|voluntas|natura|"
        r"homo|hominis|christus|apostolus|scriptura|dicit|dixit|sicut|"
        r"nisi|neque|atque|velut|ergo|ideo|ideoque)\b",
        re.I,
    ),
}

# BAC chrome heuristics for front matter
BAC_CHROME = re.compile(
    r"(?i)(?:biblioteca de autores cristianos|BAC|ISBN|dep[oó]sito legal|"
    r"traducci[oó]n,? introducciones|introducci[oó]n general|"
    r"madrid\s+\d|editorial cat[oó]lica|imprim[aá]tur|nihil obstat|"
    r"obras de san agust[ií]n|tomo\s+(?:xxxv|35)|escritos antipelagianos|"
    r"argimiro turrado|teodoro c|luis arias)"
)

# wrong column merge: two longish phrases smashed with mid capitals or dual topics
COLUMN_MERGE = re.compile(
    r"[a-záéíóúüñ]{4,}\s+[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]+\s+[a-záéíóúüñ]{3,}"
    r".{20,}"
    r"[a-záéíóúüñ]{4,}\s+[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]+"
)

# Index noise: short units with many numbers / page refs / alpha-numeric index lines
INDEX_NOISE = re.compile(
    r"(?i)(?:\b(?:cf\.|vid\.|ibid|índice|index)\b.*\d)|"
    r"(?:\d+\s*[-–,]\s*\d+.*){3,}|"
    r"(?:[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{1,20}\s+\d{1,4}\s*){4,}"
)

# illegible: high non-letter ratio or very short garbage
def is_other_illegible(text: str) -> bool:
    if not text or text == PLACEHOLDER:
        return False
    letters = len(re.findall(r"[A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÿ]", text))
    if len(text) > 40 and letters / max(len(text), 1) < 0.45:
        return True
    # many isolated single letters
    singles = len(re.findall(r"(?:^|\s)[A-Za-zÁÉÍÓÚÜÑáéíóúüñ](?:\s|$)", text))
    if singles >= 8 and letters > 0 and singles / max(letters, 1) > 0.3:
        return True
    return False


def snip(text: str, m: re.Match | None = None, width: int = 100) -> str:
    if m is None:
        t = text[:width]
        return t + ("…" if len(text) > width else "")
    start = max(0, m.start() - 30)
    end = min(len(text), m.end() + 50)
    s = text[start:end].replace("\n", " ")
    if start > 0:
        s = "…" + s
    if end < len(text):
        s = s + "…"
    return s


def classify_unit(i: int, u: dict) -> list[tuple[str, str]]:
    text = u.get("contenido") or ""
    cons = u.get("consecutivo") or ""
    hits: list[tuple[str, str]] = []

    if text.strip() == PLACEHOLDER:
        hits.append(("toc_dotted_garbage", PLACEHOLDER[:80]))
        return hits

    # front BAC chrome (only meaningful near front)
    if i < 100 and BAC_CHROME.search(text) and (
        len(text) < 500
        or BAC_CHROME.search(text[:200])
        or re.search(r"(?i)biblioteca de autores|ISBN|dep[oó]sito", text)
    ):
        # title pages / chrome-heavy
        chrome_score = len(BAC_CHROME.findall(text))
        if chrome_score >= 1 and (
            i < 40
            or re.search(
                r"(?i)ISBN|dep[oó]sito legal|imprim|nihil obstat|editorial",
                text,
            )
            or (len(text) < 350 and BAC_CHROME.search(text))
        ):
            hits.append(("bac_chrome_frontmatter", snip(text, BAC_CHROME.search(text))))

    for cls, pat in PATTERNS.items():
        if cls == "latin_mixed_into_spanish_body":
            # require several Latin hits and Spanish-looking consecutivo body
            ms = list(pat.finditer(text))
            if len(ms) >= 4 and i >= 80:
                # skip pure intro sections that quote Latin intentionally?
                # still report dense Latin patches
                hits.append((cls, snip(text, ms[0])))
            continue
        if cls == "page_headers_footers":
            m = pat.search(text)
            if m and len(text) < 200:
                hits.append((cls, snip(text, m)))
            elif m and re.search(r"(?i)^\s*(?:SAN AGUST|BAC|página)", text):
                hits.append((cls, snip(text, m)))
            continue
        m = pat.search(text)
        if m:
            hits.append((cls, snip(text, m)))

    # glued allcaps words LOSSEÑORES style
    m_glue = re.search(r"\b[A-ZÁÉÍÓÚÜÑ]{8,}\b", text)
    if m_glue and not re.search(r"\b(?:INTRODUCCION|TRADUCCION|BIBLIOTECA|CRISTIANOS|ANTIPELAGIANOS)\b", m_glue.group()):
        # only if looks like two words glued (has internal lowercase? no - allcaps)
        # check for known spanish glued patterns
        g = m_glue.group()
        if re.search(r"(LOS|LAS|DEL|QUE|POR|CON|UNA|PARA|SOBRE|ENTRE)", g) and len(g) >= 10:
            hits.append(("glued_words", snip(text, m_glue)))

    # better glued: lowercase letter immediately followed by uppercase mid-word Spanish
    m_g2 = re.search(r"[a-záéíóúüñ]{2,}(?:que|de|la|el|los|las|del|por|con|una|uno|para|como|sobre)[A-ZÁÉÍÓÚÜÑ]", text)
    m_g3 = re.search(r"(?:[A-ZÁÉÍÓÚÜÑ]{2,}[a-záéíóúüñ]+){2,}", text)  # Camel glue
    # LOSSEÑORES etc
    m_g4 = re.search(r"\b(?:[A-ZÁÉÍÓÚÜÑÁÉÍÓÚÜÑ]{3,}){1}(?:SEÑORES|DIOS|CRISTO|HOMBRE|GRACIA|PECADOS?|JUSTICIA)\b", text)

    # wrong column merge heuristic: unit has two dense prose chunks separated oddly
    # OR many mid-line title-case after lowercase without period
    if len(text) > 200:
        odd_caps = len(re.findall(r"[a-záéíóúüñ]{3,} [A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]{3,} [a-záéíóúüñ]", text))
        # also dual page numbers or dual headers
        dual = re.search(r"\d{2,4}\s+[A-Za-z].{10,}\s+\d{2,4}\s+[A-Za-z]", text)
        if odd_caps >= 6 or dual:
            hits.append(("wrong_column_merge", snip(text, dual or re.search(r"[a-záéíóúüñ]{3,} [A-ZÁÉÍÓÚÜÑ]", text))))

    if INDEX_NOISE.search(text) and (i >= n - 80 or i < 50 or len(text) < 250):
        hits.append(("index_noise", snip(text, INDEX_NOISE.search(text))))

    if is_other_illegible(text):
        hits.append(("other_illegible", snip(text)))

    # residual space-before-punct (should be rare after ocr-punct)
    if re.search(r"\s+[,.;:!?]", text):
        m = re.search(r".{0,20}\s+[,.;:!?].{0,20}", text)
        if m:
            hits.append(("residual_space_before_punct", m.group().replace("\n", " ")))

    return hits


# Full-doc scan for counts of critical residual classes (lightweight regex on all units)
full_counts = defaultdict(int)
full_examples = defaultdict(list)

def add_full(cls, i, u, snippet):
    full_counts[cls] += 1
    if len(full_examples[cls]) < 4:
        full_examples[cls].append(
            {
                "unitIndex": i,
                "consecutivo": u.get("consecutivo") or "",
                "snippet": snippet[:160],
            }
        )


# Sample detailed dump
sample_units = []
sample_hits = defaultdict(list)
placeholder_count_sample = 0

for i in sample_idx:
    u = units[i]
    text = u.get("contenido") or ""
    cons = u.get("consecutivo") or ""
    hits = classify_unit(i, u)
    if text.strip() == PLACEHOLDER:
        placeholder_count_sample += 1
    sample_units.append(
        {
            "unitIndex": i,
            "consecutivo": cons,
            "len": len(text),
            "preview": text[:220].replace("\n", " "),
            "hits": [{"class": c, "snippet": s} for c, s in hits],
        }
    )
    for c, s in hits:
        if len(sample_hits[c]) < 6:
            sample_hits[c].append(
                {"unitIndex": i, "consecutivo": cons, "snippet": s[:160]}
            )

# Full scan for accurate counts of residual defects
for i, u in enumerate(units):
    text = u.get("contenido") or ""
    if text.strip() == PLACEHOLDER:
        add_full("toc_dotted_garbage", i, u, PLACEHOLDER)
        continue

    m = re.search(r"[a-záéíóúüñà-ÿ]{2}\.[a-záéíóúüñà-ÿ]{2}", text)
    if m:
        add_full("internal_word_period", i, u, snip(text, m))

    m = re.search(
        r"(?:(?<=\s)|^)(?:[A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÿ]\s+){3,}[A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÿ](?=\s|$|[.,;:])",
        text,
    )
    if m:
        add_full("spaced_or_shredded_letters", i, u, snip(text, m))

    m = re.search(r"[A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÿ]-\s+[a-záéíóúüñ]", text)
    if m:
        add_full("hyphen_mid_line", i, u, snip(text, m))

    m = re.search(r"(?:\d[A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÿ]{3,}|[A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÿ]{3,}\d{2,})", text)
    if m:
        # filter verse refs like Rom 5,12 style already spaced; digit glued
        tok = m.group()
        if not re.match(r"^\d+[a-z]?$", tok):
            add_full("digit_glued_tokens", i, u, snip(text, m))

    if "�" in text or re.search(r"Ã.|Â.|â€", text):
        m = re.search(r".{0,20}(?:�|Ã.|Â.|â€).{0,20}", text)
        add_full("mojibake_replacement_chars", i, u, (m.group() if m else text[:80]))

    m = re.search(r"(?:\.\s*){4,}|\.{4,}", text)
    if m:
        add_full("ellipses_leaders", i, u, snip(text, m))

    # glued ALLCAPS with function-word stem
    m = re.search(
        r"\b[A-ZÁÉÍÓÚÜÑ]{3,}(?:LOS|LAS|DEL|QUE|DE|LA|EL|POR|CON)[A-ZÁÉÍÓÚÜÑ]{3,}\b|"
        r"\b(?:LOS|LAS|DEL)[A-ZÁÉÍÓÚÜÑ]{4,}\b|"
        r"[a-záéíóúüñ]{4,}[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]{3,}",
        text,
    )
    if m:
        add_full("glued_words", i, u, snip(text, m))

    if i < 80 and BAC_CHROME.search(text):
        if re.search(
            r"(?i)ISBN|dep[oó]sito|imprim|nihil|editorial cat|biblioteca de autores|traducci[oó]n,? introduc",
            text,
        ) or (len(text) < 280):
            add_full("bac_chrome_frontmatter", i, u, snip(text, BAC_CHROME.search(text)))

    # page headers short
    if len(text) < 120 and re.search(
        r"(?i)biblioteca de autores|san agust[ií]n\s*[-–]|^\s*\d{1,4}\s*$|pág",
        text,
    ):
        add_full("page_headers_footers", i, u, snip(text))

    # index zone
    if i >= n - 60:
        if INDEX_NOISE.search(text) or (
            len(text) < 200 and re.search(r"\d{2,4}", text) and text.count(" ") < 8
        ):
            add_full("index_noise", i, u, snip(text))
        # also dense page number lists
        if len(re.findall(r"\b\d{1,4}\b", text)) >= 6 and len(text) < 400:
            add_full("index_noise", i, u, snip(text))

    if is_other_illegible(text):
        add_full("other_illegible", i, u, snip(text))

    # accent corruption residual
    m = re.search(r"[aeiouAEIOU]['`´][a-z]|n~|N~|\b\w*¨\w*", text)
    if m:
        add_full("accent_corruption", i, u, snip(text, m))

# Latin density full scan on body only for count of units with heavy Latin
for i, u in enumerate(units):
    if i < 100 or i >= n - 40:
        continue
    text = u.get("contenido") or ""
    if text.strip() == PLACEHOLDER:
        continue
    latin_hits = re.findall(
        r"\b(?:quod|quia|quoniam|enim|autem|igitur|tamen|secundum|propter|"
        r"dominus|deus|spiritus|sanctus|gratia|peccatum|voluntas|natura|"
        r"homo|hominis|christus|apostolus|dicit|dixit|sicut|nisi|neque|"
        r"atque|ergo|ideo)\b",
        text,
        flags=re.I,
    )
    # Spanish words
    es_hits = re.findall(
        r"\b(?:que|de|la|el|los|las|por|con|una|del|como|para|este|esta|"
        r"gracia|pecado|hombre|dios|señor|justicia|voluntad|naturaleza)\b",
        text,
        flags=re.I,
    )
    if len(latin_hits) >= 5 and len(es_hits) <= 2 and len(text) > 80:
        add_full("latin_mixed_into_spanish_body", i, u, snip(text))

# wrong column: full body scan for dual-number patterns
for i, u in enumerate(units):
    text = u.get("contenido") or ""
    if len(text) < 150:
        continue
    # classic two-column OCR: mid-page capital runs mixed
    if re.search(r"[a-záéíóúüñ],\s*[a-záéíóúüñ].{5,}[a-záéíóúüñ]\.\s*[A-ZÁÉÍÓÚÜÑ].{10,}[a-záéíóúüñ]\.\s*[A-ZÁÉÍÓÚÜÑ]", text):
        # not enough
        pass
    # lines that look like leftcol+rightcol without newline: word + word with page numbers mid
    m = re.search(r"\b\d{2,3}\b.{5,40}\b\d{2,3}\b", text)
    if m and text.count(".") >= 4 and re.search(r"[a-záéíóúüñ]{5,}\s+\d{2,3}\s+[A-ZÁÉÍÓÚÜÑ]", text):
        add_full("wrong_column_merge", i, u, snip(text, m))

# Pick representative sample previews for front/mid/tail
def pick(indices):
    out = []
    for i in indices:
        u = units[i]
        out.append(
            {
                "unitIndex": i,
                "consecutivo": u.get("consecutivo"),
                "preview": (u.get("contenido") or "")[:300].replace("\n", " "),
            }
        )
    return out

# Also dump first 80 / mid / last 40 previews for manual review
front_prev = pick(front)
mid_prev = pick(body)
tail_prev = pick(tail)

# Severity heuristic
# weight: placeholders, illegible, shredded, column merge high; internal period medium
weights = {
    "toc_dotted_garbage": 2,
    "bac_chrome_frontmatter": 1,
    "spaced_or_shredded_letters": 5,
    "internal_word_period": 3,
    "hyphen_mid_line": 2,
    "glued_words": 3,
    "digit_glued_tokens": 2,
    "mojibake_replacement_chars": 5,
    "latin_mixed_into_spanish_body": 2,
    "wrong_column_merge": 4,
    "accent_corruption": 3,
    "ellipses_leaders": 1,
    "page_headers_footers": 1,
    "index_noise": 2,
    "other_illegible": 6,
    "residual_space_before_punct": 1,
}
raw = sum(weights.get(k, 2) * v for k, v in full_counts.items())
# normalize roughly to 0-100 for this corpus size
severity = int(min(100, max(0, (raw / max(n, 1)) * 40 + (15 if full_counts.get("toc_dotted_garbage", 0) > 20 else 0))))

report = {
    "documentId": DOC_ID,
    "unitsTotal": n,
    "unitsSampled": len(sample_idx),
    "sampleIndexRanges": {
        "front": [front[0], front[-1]] if front else [],
        "bodyStride": body[:5] + ["..."] + body[-3:] if len(body) > 8 else body,
        "tail": [tail[0], tail[-1]] if tail else [],
    },
    "fullCounts": dict(full_counts),
    "fullExamples": {k: v for k, v in full_examples.items()},
    "sampleHits": {k: v for k, v in sample_hits.items()},
    "placeholderTotal": full_counts.get("toc_dotted_garbage", 0),
    "frontPreviews": front_prev[:25],
    "midPreviews": mid_prev,
    "tailPreviews": tail_prev,
    "severityHeuristic": severity,
}

OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Wrote {OUT}")
print(f"unitsTotal={n} sampled={len(sample_idx)}")
print("fullCounts:", dict(full_counts))
print("severityHeuristic:", severity)
