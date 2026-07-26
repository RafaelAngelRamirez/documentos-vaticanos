#!/usr/bin/env python3
"""Residual OCR/syntax audit sampler for agustin-12-tratados-morales-es."""
import json
import re
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

DOC_ID = "agustin-12-tratados-morales-es"
PATH = Path(
    "/home/angel/proyectos/personal/documentos-vaticanos/documentos/corpus/documents"
    f"/{DOC_ID}/content.json"
)
OUT = Path(
    "/home/angel/proyectos/personal/documentos-vaticanos/documentos/corpus/revisions"
    f"/_audit_sample_{DOC_ID}.json"
)
SAMPLES = Path(
    "/home/angel/proyectos/personal/documentos-vaticanos/documentos/corpus/revisions"
    f"/_audit_samples_{DOC_ID}"
)

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

PATTERNS = {
    "toc_dotted_garbage": re.compile(
        r"(?:\.\s*){6,}|\.{5,}|[^\S\n]*\.\s*\.\s*\.\s*\.\s*\.|o{5,}|[oncrim]{10,}",
        re.I,
    ),
    "spaced_or_shredded_letters": re.compile(
        r"(?:(?<=\s)|^)(?:[A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÿ]\s+){3,}[A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÿ](?=\s|$|[.,;:])"
    ),
    "internal_word_period": re.compile(r"[a-záéíóúüñà-ÿ]{2}\.[a-záéíóúüñà-ÿ]{2}"),
    "hyphen_mid_line": re.compile(r"[A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÿ]-\s+[a-záéíóúüñ]"),
    "digit_glued_tokens": re.compile(
        r"(?:\d[A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÿ]{3,}|[A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÿ]{3,}\d{2,})"
    ),
    "mojibake_replacement_chars": re.compile(r"�|Ã[¡-¿]|Â.|â€|ï»¿"),
    "ellipses_leaders": re.compile(r"(?:\.\s*){4,}|\.{4,}"),
    "page_headers_footers": re.compile(
        r"(?i)(?:biblioteca de autores cristianos|\bBAC\b|página\s+\d+|pág\.\s*\d+|"
        r"^\s*\d{1,4}\s*$|SAN AGUST[IÍ]N\s*[-–—]\s*OBRAS|OBRAS DE SAN AGUST)"
    ),
    "accent_corruption": re.compile(
        r"[aeiouAEIOU]['`´][a-z]|n~|N~|\b\w*¨\w*|qi[ií]e"
    ),
}

BAC_CHROME = re.compile(
    r"(?i)(?:biblioteca de autores cristianos|BAC|ISBN|dep[oó]sito legal|"
    r"traducci[oó]n,? introducciones|introducci[oó]n general|"
    r"madrid\s+\d|editorial cat[oó]lica|imprim[aá]tur|nihil obstat|"
    r"obras de san agust[ií]n|tomo\s+(?:xii|12)|tratados morales|"
    r"edicion bilingue|mcml|graficas nebrija|felix garcia|lope cilleruelo|"
    r"ramiro florez)"
)

INDEX_NOISE = re.compile(
    r"(?i)(?:\b(?:cf\.|vid\.|ibid|índice|index)\b.*\d)|"
    r"(?:\d+\s*[-–,]\s*\d+.*){3,}|"
    r"(?:[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{1,20}\s+\d{1,4}\s*){4,}"
)


def is_other_illegible(text: str) -> bool:
    if not text or text == PLACEHOLDER:
        return False
    letters = len(re.findall(r"[A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÿ]", text))
    if len(text) > 40 and letters / max(len(text), 1) < 0.45:
        return True
    singles = len(re.findall(r"(?:^|\s)[A-Za-zÁÉÍÓÚÜÑáéíóúüñ](?:\s|$)", text))
    if singles >= 8 and letters > 0 and singles / max(letters, 1) > 0.3:
        return True
    vowels = len(re.findall(r"[aeiouáéíóúüAEIOUÁÉÍÓÚÜ]", text))
    if letters > 80 and vowels / max(letters, 1) < 0.25:
        return True
    return False


def snip(text: str, m: re.Match | None = None, width: int = 120) -> str:
    if m is None:
        t = re.sub(r"\s+", " ", text[:width])
        return t + ("…" if len(text) > width else "")
    start = max(0, m.start() - 30)
    end = min(len(text), m.end() + 50)
    s = text[start:end].replace("\n", " ")
    if start > 0:
        s = "…" + s
    if end < len(text):
        s = s + "…"
    return s


full_counts = defaultdict(int)
full_examples = defaultdict(list)


def add_full(cls, i, u, snippet):
    full_counts[cls] += 1
    if len(full_examples[cls]) < 4:
        full_examples[cls].append(
            {
                "unitIndex": i,
                "consecutivo": u.get("consecutivo") or "",
                "snippet": snippet[:180],
            }
        )


sample_units = []
sample_hits = defaultdict(list)
placeholder_total = 0

for i, u in enumerate(units):
    text = u.get("contenido") or ""
    if text.strip() == PLACEHOLDER or "índice o tabla ilegible" in text:
        placeholder_total += 1
        add_full("toc_dotted_garbage", i, u, PLACEHOLDER)
        if i < 80 or i >= n - 60:
            add_full("index_noise", i, u, PLACEHOLDER)
        continue

    m = PATTERNS["internal_word_period"].search(text)
    if m:
        low = m.group().lower()
        if low not in ("es.decir", "art.cit", "op.cit", "p.ej"):
            add_full("internal_word_period", i, u, snip(text, m))

    m = PATTERNS["spaced_or_shredded_letters"].search(text)
    if m:
        add_full("spaced_or_shredded_letters", i, u, snip(text, m))

    m = PATTERNS["hyphen_mid_line"].search(text)
    if m:
        add_full("hyphen_mid_line", i, u, snip(text, m))

    m = PATTERNS["digit_glued_tokens"].search(text)
    if m:
        add_full("digit_glued_tokens", i, u, snip(text, m))

    if PATTERNS["mojibake_replacement_chars"].search(text):
        m = re.search(r".{0,20}(?:�|Ã.|Â.|â€).{0,20}", text)
        add_full(
            "mojibake/replacement_chars",
            i,
            u,
            (m.group() if m else text[:80]),
        )

    m = PATTERNS["ellipses_leaders"].search(text)
    if m:
        add_full("ellipses_leaders", i, u, snip(text, m))

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
            r"(?i)ISBN|dep[oó]sito|imprim|nihil|editorial|biblioteca de autores|"
            r"traducci[oó]n|edicion bilingue|mcml|graficas|version, introducciones",
            text,
        ) or (len(text) < 400):
            add_full("bac_chrome_frontmatter", i, u, snip(text, BAC_CHROME.search(text)))

    if len(text) < 150 and PATTERNS["page_headers_footers"].search(text):
        add_full("page_headers_footers", i, u, snip(text))

    if i >= n - 60:
        if INDEX_NOISE.search(text) or (
            len(text) < 200 and re.search(r"\d{2,4}", text) and text.count(" ") < 12
        ):
            add_full("index_noise", i, u, snip(text))
        if len(re.findall(r"\b\d{1,4}\b", text)) >= 6 and len(text) < 500:
            add_full("index_noise", i, u, snip(text))

    if is_other_illegible(text):
        add_full("other_illegible", i, u, snip(text))

    m = PATTERNS["accent_corruption"].search(text)
    if m:
        add_full("accent_corruption", i, u, snip(text, m))

    # residual space-before-punct
    if re.search(r"[ \t]+[,.;:!?]", text):
        m = re.search(r".{0,25}[ \t]+[,.;:!?].{0,25}", text)
        if m:
            add_full("residual_space_before_punct", i, u, m.group().replace("\n", " "))

    # wrong column merge: dual page numbers / dense mid-cap after lower without sentence break
    if len(text) > 180:
        odd_caps = len(
            re.findall(
                r"[a-záéíóúüñ]{3,} [A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]{3,} [a-záéíóúüñ]",
                text,
            )
        )
        dual = re.search(
            r"\d{2,4}\s+[A-Za-záéíóú].{15,80}\s+\d{2,4}\s+[A-Za-záéíóú]", text
        )
        if odd_caps >= 6 or dual:
            add_full(
                "wrong_column_merge",
                i,
                u,
                snip(text, dual or re.search(r"[a-záéíóúüñ]{3,} [A-ZÁÉÍÓÚÜÑ]", text)),
            )

# Latin density on body
for i, u in enumerate(units):
    if i < 100 or i >= n - 40:
        continue
    text = u.get("contenido") or ""
    if text.strip() == PLACEHOLDER or "índice o tabla" in text:
        continue
    latin_hits = re.findall(
        r"\b(?:quod|quia|quoniam|enim|autem|igitur|tamen|secundum|propter|"
        r"dominus|deus|spiritus|sanctus|gratia|peccatum|voluntas|natura|"
        r"homo|hominis|christus|apostolus|dicit|dixit|sicut|nisi|neque|"
        r"atque|ergo|ideo)\b",
        text,
        flags=re.I,
    )
    es_hits = re.findall(
        r"\b(?:que|de|la|el|los|las|por|con|una|del|como|para|este|esta|"
        r"gracia|pecado|hombre|dios|señor|justicia|voluntad|naturaleza)\b",
        text,
        flags=re.I,
    )
    if len(latin_hits) >= 5 and len(es_hits) <= 2 and len(text) > 80:
        add_full("latin_mixed_into_spanish_body", i, u, snip(text))

# Sample region dumps
SAMPLES.mkdir(parents=True, exist_ok=True)
for name, idxs in (
    ("A_front", front),
    ("B_mid", body),
    ("C_tail", tail),
):
    lines = []
    for i in idxs:
        u = units[i]
        t = u.get("contenido") or ""
        lines.append(
            f"=== unitIndex={i} consecutivo={u.get('consecutivo')} len={len(t)} ===\n{t}\n"
        )
    (SAMPLES / f"{name}.txt").write_text("\n".join(lines), encoding="utf-8")

for i in sample_idx:
    u = units[i]
    text = u.get("contenido") or ""
    sample_units.append(
        {
            "unitIndex": i,
            "consecutivo": u.get("consecutivo") or "",
            "len": len(text),
            "preview": re.sub(r"\s+", " ", text[:240]),
        }
    )

# Body noise approx
body_noise = 0
for i in range(80, max(80, n - 50)):
    text = units[i].get("contenido") or ""
    if text.strip() == PLACEHOLDER or "índice o tabla" in text:
        continue
    # any residual defect class that is not pure chrome
    flags = 0
    if PATTERNS["internal_word_period"].search(text):
        flags += 1
    if PATTERNS["hyphen_mid_line"].search(text):
        flags += 1
    if is_other_illegible(text):
        flags += 1
    if re.search(r"[a-záéíóúüñ]{4,}[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]{3,}", text):
        flags += 1
    if flags:
        body_noise += 1

# severity 0-100
score = 0
score += min(20, placeholder_total // 3)
score += min(15, full_counts.get("internal_word_period", 0))
score += min(10, full_counts.get("hyphen_mid_line", 0) // 2)
score += min(12, full_counts.get("glued_words", 0) // 3)
score += min(10, full_counts.get("wrong_column_merge", 0) // 2)
score += min(10, full_counts.get("other_illegible", 0) // 2)
score += min(8, full_counts.get("index_noise", 0) // 4)
score += min(8, full_counts.get("digit_glued_tokens", 0) // 5)
score += min(5, full_counts.get("residual_space_before_punct", 0) // 5)
# body is largely readable Spanish post ocr-abc/punct → keep moderate
if body_noise < 50:
    score = min(score, 35)
score = max(0, min(100, score))

out = {
    "documentId": DOC_ID,
    "unitsTotal": n,
    "unitsSampled": len(sample_idx),
    "sampleIndices": sample_idx,
    "placeholderTotal": placeholder_total,
    "bodyNoiseUnitsApprox": body_noise,
    "severityScore": score,
    "classCounts": dict(full_counts),
    "classExamples": {k: v for k, v in full_examples.items()},
    "frontPreviews": sample_units[:25],
    "midPreviews": [s for s in sample_units if 80 <= s["unitIndex"] < n - 40][:20],
    "tailPreviews": [s for s in sample_units if s["unitIndex"] >= n - 40],
    "findings": [
        f"unitsTotal={n}; placeholders(TOC garbage blanked)={placeholder_total}",
        f"ocr-abc residualBodyNoiseUnits=2 residualScore=30; ocr-punct internalWordPeriod=27 spaceBeforePunct=27",
        f"body_noise_approx={body_noise}; auto_severity={score}",
        "Front: BAC title/chrome + TOC dotted leaders already placeholderized",
        "Body: mostly readable Spanish; residual internal periods, hyphens, mild glue/OCR",
        "Tail: check index zone noise",
    ],
}

OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({"wrote": str(OUT), "units": n, "placeholders": placeholder_total, "counts": dict(full_counts), "score": score}, ensure_ascii=False, indent=2))
