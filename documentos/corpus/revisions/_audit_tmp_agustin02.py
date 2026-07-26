#!/usr/bin/env python3
"""Residual OCR/syntax audit for agustin-02-confesiones-es."""
import json
import re
from collections import defaultdict
from pathlib import Path

DOC_ID = "agustin-02-confesiones-es"
PATHS = [
    Path(
        "/home/angel/proyectos/personal/documentos-vaticanos/documentos/corpus/documents"
        f"/{DOC_ID}/content.json"
    ),
    Path(
        "/home/angel/.grok/sessions/%2Fhome%2Fangel%2Fproyectos%2Fpersonal%2Fdocumentos-vaticanos"
        "/019f9fc2-f2f0-71e1-91a8-9a805bbb26d6/web_fetch/1.json"
    ),
]
OUT = Path(
    "/home/angel/proyectos/personal/documentos-vaticanos/documentos/corpus/revisions"
    f"/_audit_sample_{DOC_ID}.json"
)

PATH = next(p for p in PATHS if p.exists())
units = json.loads(PATH.read_text(encoding="utf-8"))
n = len(units)

front = list(range(min(80, n)))
tail = list(range(max(0, n - 40), n))
body_start, body_end = 80, max(80, n - 40)
body = []
if body_end > body_start:
    step = max(1, (body_end - body_start) // 40)
    body = list(range(body_start, body_end, step))[:40]
sample_idx = sorted(set(front + body + tail))

PLACEHOLDER = "[OCR: índice o tabla ilegible omitido]"
LETTER = r"A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÿ"

PATTERNS = {
    "toc_dotted_garbage": re.compile(
        r"(?:\.\s*){6,}|\.{5,}|[oncrim]{10,}", re.I
    ),
    "spaced_or_shredded_letters": re.compile(
        rf"(?:(?<=\s)|^)(?:[{LETTER}]\s+){{3,}}[{LETTER}](?=\s|$|[.,;:])"
    ),
    "internal_word_period": re.compile(r"[a-záéíóúüñà-ÿ]{2}\.[a-záéíóúüñà-ÿ]{2}"),
    "hyphen_mid_line": re.compile(rf"[{LETTER}]-\s+[a-záéíóúüñ]"),
    "digit_glued_tokens": re.compile(
        rf"(?:\d[{LETTER}]{{3,}}|[{LETTER}]{{3,}}\d{{2,}})"
    ),
    "mojibake_replacement_chars": re.compile(r"�|Ã[¡-¿]|Â.|â€|ï»¿"),
    "ellipses_leaders": re.compile(r"(?:\.\s*){4,}|\.{4,}"),
    "page_headers_footers": re.compile(
        r"(?i)(?:biblioteca de autores cristianos|\bBAC\b|página\s+\d+|pág\.\s*\d+|"
        r"^\s*\d{1,4}\s*$|SAN AGUST[IÍ]N\s*[-–—]|Prólogo a las|El libro de las)"
    ),
    "accent_corruption": re.compile(
        r"[aeiouAEIOU]['`´][a-z]|n~|N~|\b\w*¨\w*|\bqi[ií]e\b|\bq[ií]ie\b", re.I
    ),
}

BAC_CHROME = re.compile(
    r"(?i)(?:biblioteca de autores cristianos|BAC|ISBN|dep[oó]sito legal|"
    r"universidad pontificia|editorial cat[oó]lica|imprim[aá]tur|nihil obstat|"
    r"obras de san agust|emmo\.|rvdmo\.|cardenal arzobispo|MCMLXXIX)"
)
INDEX_NOISE = re.compile(
    r"(?i)(?:\b(?:cf\.|vid\.|ibid|índice|index)\b.*\d)|"
    r"(?:\d+\s*[-–,]\s*\d+.*){3,}|"
    r"(?:[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{1,20}\s+\d{1,4}\s*){4,}"
)


def snip(text, m=None, width=110):
    if m is None:
        t = text[:width]
        return t + ("…" if len(text) > width else "")
    start = max(0, m.start() - 30)
    end = min(len(text), m.end() + 50)
    s = text[start:end].replace("\n", " ")
    if start:
        s = "…" + s
    if end < len(text):
        s = s + "…"
    return s


def is_other_illegible(text: str) -> bool:
    if not text or text == PLACEHOLDER:
        return False
    letters = len(re.findall(rf"[{LETTER}]", text))
    if len(text) > 40 and letters / max(len(text), 1) < 0.45:
        return True
    singles = len(re.findall(rf"(?:^|\s)[{LETTER}](?:\s|$)", text))
    if singles >= 8 and letters > 0 and singles / max(letters, 1) > 0.3:
        return True
    # truncated mid-word endings like vislum8
    if re.search(r"[a-záéíóúñ]{4,}\d\s*$", text) or re.search(
        r"\b[A-ZÁÉÍÓÚÑ]{2,}\s+[a-záéíóúñ]{1,3}\s+[a-záéíóúñ]{1,4}\s+[A-Z]", text
    ):
        if len(text) < 120:
            return True
    return False


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


for i, u in enumerate(units):
    text = u.get("contenido") or ""
    if text.strip() == PLACEHOLDER:
        add_full("toc_dotted_garbage", i, u, PLACEHOLDER)
        continue

    if i < 80 and BAC_CHROME.search(text):
        if re.search(
            r"(?i)ISBN|dep[oó]sito|imprim|nihil|editorial cat|biblioteca de autores|"
            r"universidad pontificia|emmo|rvdmo|MCMLXXIX",
            text,
        ) or len(text) < 280:
            add_full(
                "bac_chrome_frontmatter",
                i,
                u,
                snip(text, BAC_CHROME.search(text)),
            )

    for cls, pat in PATTERNS.items():
        m = pat.search(text)
        if not m:
            continue
        if cls == "page_headers_footers":
            if len(text) < 160 or re.search(
                r"(?i)^\s*(?:Prólogo|El libro de|SAN AGUST|BAC|Conf,)", text
            ):
                add_full(cls, i, u, snip(text, m))
            continue
        if cls == "digit_glued_tokens":
            tok = m.group()
            if re.match(r"^\d+[a-z]?$", tok):
                continue
        add_full(cls, i, u, snip(text, m))

    m = re.search(
        r"\b(?:LOS|LAS|DEL)[A-ZÁÉÍÓÚÜÑ]{4,}\b|"
        r"\b[A-ZÁÉÍÓÚÜÑ]{6,}(?:DE|DEL|LA|EL|LOS|LAS)[A-ZÁÉÍÓÚÜÑ]{2,}\b|"
        r"[a-záéíóúüñ]{4,}[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]{3,}",
        text,
    )
    if m:
        add_full("glued_words", i, u, snip(text, m))

    if i >= n - 60:
        if INDEX_NOISE.search(text) or (
            len(text) < 200 and re.search(r"\d{2,4}", text) and text.count(" ") < 10
        ):
            add_full("index_noise", i, u, snip(text))
        if len(re.findall(r"\b\d{1,4}\b", text)) >= 6 and len(text) < 400:
            add_full("index_noise", i, u, snip(text))
        if re.search(r"(?i)acab[oó]se de imprimir|laus\s+deo|cuadro cronol", text):
            add_full("index_noise", i, u, snip(text))

    if is_other_illegible(text):
        add_full("other_illegible", i, u, snip(text))

    # latin density in body
    if 100 <= i < n - 40:
        latin_hits = re.findall(
            r"\b(?:quod|quia|quoniam|enim|autem|igitur|tamen|secundum|propter|"
            r"dominus|deus|spiritus|sanctus|voluntas|natura|christus|apostolus|"
            r"dicit|dixit|sicut|nisi|neque|atque|ergo|ideo)\b",
            text,
            flags=re.I,
        )
        es_hits = re.findall(
            r"\b(?:que|de|la|el|los|las|por|con|una|del|como|para|este|esta|"
            r"gracia|pecado|hombre|dios|señor|justicia|voluntad)\b",
            text,
            flags=re.I,
        )
        if len(latin_hits) >= 5 and len(es_hits) <= 2 and len(text) > 80:
            add_full("latin_mixed_into_spanish_body", i, u, snip(text))

    if len(text) > 150:
        m = re.search(r"\b\d{2,3}\b.{5,40}\b\d{2,3}\b", text)
        if m and text.count(".") >= 4 and re.search(
            r"[a-záéíóúüñ]{5,}\s+\d{2,3}\s+[A-ZÁÉÍÓÚÜÑ]", text
        ):
            add_full("wrong_column_merge", i, u, snip(text, m))


def pick(indices):
    out = []
    for i in indices:
        u = units[i]
        out.append(
            {
                "unitIndex": i,
                "consecutivo": u.get("consecutivo"),
                "preview": (u.get("contenido") or "")[:280].replace("\n", " "),
            }
        )
    return out


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
}
raw = sum(weights.get(k, 2) * v for k, v in full_counts.items())
severity = int(
    min(
        100,
        max(
            0,
            (raw / max(n, 1)) * 40
            + (10 if full_counts.get("internal_word_period", 0) > 40 else 0)
            + (8 if full_counts.get("other_illegible", 0) > 5 else 0)
            + (5 if full_counts.get("bac_chrome_frontmatter", 0) > 10 else 0),
        ),
    )
)

# body prose noise flag
body_noise = any(
    full_counts.get(k, 0) > 0
    for k in (
        "internal_word_period",
        "digit_glued_tokens",
        "other_illegible",
        "hyphen_mid_line",
        "glued_words",
        "wrong_column_merge",
    )
)

report = {
    "documentId": DOC_ID,
    "unitsTotal": n,
    "unitsSampled": len(sample_idx),
    "pathUsed": str(PATH),
    "fullCounts": dict(full_counts),
    "fullExamples": {k: v for k, v in full_examples.items()},
    "frontPreviews": pick(front[:25]),
    "midPreviews": pick(body),
    "tailPreviews": pick(tail),
    "severityHeuristic": severity,
    "frontMatterNoise": full_counts.get("bac_chrome_frontmatter", 0) > 0,
    "bodyProseNoise": body_noise,
    "indexGarbage": full_counts.get("index_noise", 0) > 0
    or full_counts.get("toc_dotted_garbage", 0) > 0,
}
OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Wrote {OUT}")
print(f"unitsTotal={n} sampled={len(sample_idx)} severity={severity}")
print("fullCounts:", dict(sorted(full_counts.items(), key=lambda x: -x[1])))
