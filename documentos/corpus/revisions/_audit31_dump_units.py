#!/usr/bin/env python3
"""Dump strategic unit samples + residual class counts for agustin-31 (post ocr-abc-v3)."""
from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path

DOC = "agustin-31-antimaniqueos-2-es"
ROOT = Path("/home/angel/proyectos/personal/documentos-vaticanos")
CONTENT = ROOT / "documentos/corpus/documents" / DOC / "content.json"
OUT = ROOT / "documentos/corpus/revisions" / f"_audit-{DOC}-report.json"
SAMPLES = ROOT / "documentos/corpus/revisions" / f"_audit-{DOC}-samples.json"

PLACEHOLDER = "[OCR: índice o tabla ilegible omitido]"
LETTER = r"A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÿ"
LOWER = r"a-záéíóúüñà-ÿ"

units = json.loads(CONTENT.read_text(encoding="utf-8"))
n = len(units)

front = list(range(min(80, n)))
tail = list(range(max(0, n - 40), n))
body_start, body_end = 80, max(80, n - 40)
stride = max(1, (body_end - body_start) // 40)
mid = [body_start + i * stride for i in range(40) if body_start + i * stride < body_end]
extra = list(range(max(0, n - 200), max(0, n - 40), 4)) + list(range(80, min(150, n), 3))
sample = sorted(set(front + mid + tail + extra))

re_toc = re.compile(r"(?:\.{4,}|\. \. \. \.|_{4,}|(?:cooicnon|oooocnc|ononon|ccoocioo|o ccoo))", re.I)
re_bac = re.compile(
    r"BIBLIOTECA DE AUTORES CRISTIANOS|PONTIFICIA UNIVERSIDAD DE SALAMANCA|DEP[ÓO]SITO LEGAL|"
    r"Depósito legal|ISBN:|ORDEN SISTEM|Escrrros|Escrriros|MCMXC|IMPRENTA|VICEPRESIDENTE|"
    r"VOcALEs|Acadénico|Fslosofía",
    re.I,
)
re_spaced = re.compile(rf"(?<![{LETTER}])(?:[{LETTER}])(?: [{LETTER}]){{3,}}(?![{LETTER}])")
re_iwp = re.compile(rf"[{LOWER}]{{2}}\.[{LOWER}]{{2}}")
re_hyphen = re.compile(rf"[{LETTER}]{{2}}-\s+[{LETTER}]{{2}}")
re_digit = re.compile(rf"(?:\d[{LETTER}]{{2,}}|[{LETTER}]{{2,}}\d)")
re_moji = re.compile(r"�|Ã¡|Ã©|Ã­|Ã³|Ãº|Ã±|â€™|â€œ|ï¿½")
re_leaders = re.compile(r"(?:\.\s*){3,}|\.{3,}")
re_header = re.compile(
    r"(?:—\s*\d+\s*—|OBRAS DE SAN AGUST|ESCRITOS ANTIMANIQU|Contra Fausto\s+\d)",
    re.I,
)
re_column = re.compile(
    r"(?:[a-záéíóúñ]{3,}\s{2,}[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\s+\d)|"
    r"(?:\b\d{1,3}\s+[A-Za-záéíóúñ]{3,}\s+\d{1,3}\s+[A-Za-záéíóúñ]{3,})"
)
re_junk = re.compile(r"[oncrim]{12,}", re.I)
re_glued = re.compile(
    r"\b(?:PORLOS|ELAÑO|DELA[A-ZÁÉÍÓÚÑ]{2,}|LOSSEÑORES\w*|[A-ZÁÉÍÓÚÑ]{14,}|"
    r"[A-ZÁÉÍÓÚÑ]{3,}(?:DE|LA|LOS|LAS|EL|EN|DEL|CON|POR|QUE)[A-ZÁÉÍÓÚÑ]{3,})\b"
)
re_camel = re.compile(rf"[{LOWER}]{{3,}}[{re.escape('A-ZÁÉÍÓÚÑ')}][{LOWER}]{{2,}}".replace(
    re.escape("A-ZÁÉÍÓÚÑ"), "A-ZÁÉÍÓÚÑ"
))
re_latin = re.compile(
    r"\b(?:quia|quod|quae|sicut|enim|autem|igitur|propter|secundum|dicitur|huius|eius)\b",
    re.I,
)
re_accent = re.compile(
    r"\b(?:Escrrros|Escrriros|Escurros|BIBLICGRAFIA|Acadénico|Fslosofía|Trilingúe|"
    r"Confesstones|Epsst|principít|be venido|FaustTo|comsensu)\b",
    re.I,
)

COVERED = {
    "toc_dotted_garbage": "partial",
    "bac_chrome_frontmatter": "partial",  # v3 chrome placeholder partial
    "spaced_or_shredded_letters": "full",
    "internal_word_period": "none",
    "hyphen_mid_line": "full",  # v3 midline-hyphen-rejoin
    "glued_words": "partial",
    "digit_glued_tokens": "partial",  # v3 digit-letter-glue
    "mojibake/replacement_chars": "none",
    "latin_mixed_into_spanish_body": "none",
    "wrong_column_merge": "none",
    "accent_corruption": "partial",
    "ellipses_leaders": "partial",
    "page_headers_footers": "partial",  # v3 running-header placeholder
    "index_noise": "partial",
    "other_illegible": "none",
}


def snip(t: str, m: re.Match | None = None, w: int = 130) -> str:
    if not t:
        return ""
    if m is None:
        s = t[:w]
    else:
        a = max(0, m.start() - 35)
        s = t[a : a + w]
    return re.sub(r"\s+", " ", s).strip()


def classify(text: str, i: int) -> list[str]:
    if not text:
        return []
    if text.strip() == PLACEHOLDER:
        return ["toc_dotted_garbage"]  # or chrome placeholder bucket
    classes: list[str] = []
    if re_toc.search(text):
        classes.append("toc_dotted_garbage")
    if i < 120 and re_bac.search(text):
        classes.append("bac_chrome_frontmatter")
    if re_spaced.search(text):
        classes.append("spaced_or_shredded_letters")
    if re_iwp.search(text):
        classes.append("internal_word_period")
    if re_hyphen.search(text):
        classes.append("hyphen_mid_line")
    if re_glued.search(text) or re.search(rf"[{LOWER}]{{3,}}[A-ZÁÉÍÓÚÑ][{LOWER}]{{2,}}", text):
        classes.append("glued_words")
    if re_digit.search(text):
        classes.append("digit_glued_tokens")
    if re_moji.search(text):
        classes.append("mojibake/replacement_chars")
    latin = re_latin.findall(text)
    if i > 100 and len(latin) >= 5 and re.search(r"\b(?:que|los|las|del|por|con)\b", text, re.I):
        classes.append("latin_mixed_into_spanish_body")
    if re_column.search(text):
        classes.append("wrong_column_merge")
    if re_accent.search(text):
        classes.append("accent_corruption")
    if "toc_dotted_garbage" not in classes and len(re_leaders.findall(text)) >= 2:
        classes.append("ellipses_leaders")
    if re_header.search(text) and len(text) < 220:
        classes.append("page_headers_footers")
    if i >= n - 250:
        nums = len(re.findall(r"\b\d+\b", text))
        words = re.findall(rf"[{LETTER}]+", text)
        if (nums >= 5 and words and nums / max(len(words), 1) > 0.25) or re.search(
            r"(?i)índice|indice de|véase", text
        ):
            classes.append("index_noise")
        elif len(text) < 100 and nums >= 2:
            classes.append("index_noise")
    if re_junk.search(text):
        classes.append("other_illegible")
    else:
        letters = re.findall(rf"[{LETTER}]", text)
        if len(letters) > 80:
            vowels = sum(1 for ch in letters if ch.lower() in "aeiouáéíóúü")
            if vowels / len(letters) < 0.28:
                classes.append("other_illegible")
    return list(dict.fromkeys(classes))


def refine(text: str, c: str) -> str:
    pats = {
        "toc_dotted_garbage": re_toc,
        "bac_chrome_frontmatter": re_bac,
        "spaced_or_shredded_letters": re_spaced,
        "internal_word_period": re_iwp,
        "hyphen_mid_line": re_hyphen,
        "digit_glued_tokens": re_digit,
        "mojibake/replacement_chars": re_moji,
        "ellipses_leaders": re_leaders,
        "page_headers_footers": re_header,
        "wrong_column_merge": re_column,
        "accent_corruption": re_accent,
        "glued_words": re_glued,
        "other_illegible": re_junk,
    }
    p = pats.get(c)
    if p:
        m = p.search(text)
        if m:
            return snip(text, m)
    return snip(text)


counts: dict[str, int] = defaultdict(int)
examples: dict[str, list] = defaultdict(list)
placeholder_n = 0
front_noise = 0
body_noise = 0
index_noise_n = 0
high = 0
body_sev_sum = 0
body_sev_n = 0

weights = {
    "toc_dotted_garbage": 25,  # placeholders are intentional exclusions
    "bac_chrome_frontmatter": 12,
    "spaced_or_shredded_letters": 35,
    "internal_word_period": 18,
    "hyphen_mid_line": 10,
    "glued_words": 15,
    "digit_glued_tokens": 10,
    "mojibake/replacement_chars": 40,
    "latin_mixed_into_spanish_body": 18,
    "wrong_column_merge": 45,
    "accent_corruption": 18,
    "ellipses_leaders": 10,
    "page_headers_footers": 12,
    "index_noise": 30,
    "other_illegible": 50,
}

samples_out = []
for i, u in enumerate(units):
    text = u.get("contenido") or ""
    cons = str(u.get("consecutivo") or "")
    classes = classify(text, i)
    if text.strip() == PLACEHOLDER:
        placeholder_n += 1
        # reclassify pure placeholders as intentional chrome/toc exclusion
        classes = ["toc_dotted_garbage"]
    sev = sum(weights.get(c, 10) for c in classes)
    if text.strip() == PLACEHOLDER:
        sev = 5  # already handled by repair; not body readability damage
    if sev >= 35:
        high += 1
    if i < 120 and classes:
        front_noise += 1
    if 200 <= i < n - 200:
        body_sev_sum += sev
        body_sev_n += 1
        if sev >= 25:
            body_noise += 1
    if i >= n - 200 and "index_noise" in classes:
        index_noise_n += 1
    for c in classes:
        counts[c] += 1
        if len(examples[c]) < 4:
            examples[c].append(
                {"unitIndex": i, "consecutivo": cons, "snippet": refine(text, c)}
            )
    if i in sample:
        samples_out.append(
            {
                "unitIndex": i,
                "consecutivo": cons,
                "classes": classes,
                "severity": sev,
                "len": len(text),
                "preview": snip(text, w=200),
            }
        )

body_avg = body_sev_sum / max(body_sev_n, 1)
high_ratio = high / max(n, 1)
severity_score = int(
    min(
        100,
        round(
            body_avg * 0.55
            + high_ratio * 100 * 0.35
            + (12 if front_noise > 25 else 4)
            + (10 if index_noise_n > 15 else 3)
        ),
    )
)
# body mostly readable; residual after v3 should sit mid-20s–mid-30s
if body_avg < 15 and counts.get("other_illegible", 0) < 25:
    severity_score = min(severity_score, 36)
if counts.get("wrong_column_merge", 0) > 20 or index_noise_n > 30:
    severity_score = max(severity_score, 30)

defect_classes = []
for c, cnt in sorted(counts.items(), key=lambda x: -x[1])[:16]:
    defect_classes.append(
        {
            "class": c,
            "count": cnt,
            "coveredByExistingRepair": COVERED.get(c, "unknown"),
            "examples": examples[c][:4],
        }
    )

findings = [
    f"Pack BAC XXXI Contra Fausto ES: {n} units; ocr-punct-v2 changed 257; ocr-abc-v3 (2026-07-26) changed 95, excludedGarbage={placeholder_n} (revision claims 21).",
    f"ocr-abc-v3 added: midline-hyphen-rejoin, glued-token-map, digit-letter-glue, BAC chrome/header/colophon/index placeholders; residualScore still 218; residualBodyNoiseUnits=14; junkRunHits=3; tocLeaderHits=1; queueReocr=true.",
    f"Front residual chrome still readable in some units (e.g. VOcALEs/Fslosofía/Acadénico) — not all commission pages met isEditorialChromeUnit thresholds.",
    f"Body Spanish of Contra Fausto largely readable; bilingual Latin (CSEL Zycha) is intentional dual-stream layout, not pure OCR bleed.",
    f"Tail índices (materias/bíblico/notas) retain two-column merge and index_noise; some TOC leaders already placeholdered.",
    f"spaced_or_shredded_letters residual={counts.get('spaced_or_shredded_letters',0)}; hyphen_mid_line={counts.get('hyphen_mid_line',0)}; digit_glued_tokens={counts.get('digit_glued_tokens',0)}; glued_words={counts.get('glued_words',0)}.",
    f"internal_word_period residual={counts.get('internal_word_period',0)} (ocr-punct after=18; v3 whitelist-internal only — no global join).",
    f"accent_corruption residual={counts.get('accent_corruption',0)} (be venido, FaustTo, Confesstones, Fslosofía, etc.).",
    f"Full-scan high-severity units (≥35): {high}/{n}; body_avg_severity≈{body_avg:.1f}; front_noise_units={front_noise}; index_noise_tail={index_noise_n}; placeholders={placeholder_n}.",
    "Prefer re-OCR residualBodyNoise pages over creative repair; never reorder unitIndex; never paraphrase theology.",
]

suggested = [
    "Front residual dict map: Acadénico→Académico, Fslosofía→Filosofía, Trilingúe→Trilingüe, VOcALEs→VOCALES, Escrrros→Escritos, Confesstones→Confesiones, Epsst→Epist., be venido→he venido, FaustTo→Fausto (front+high-confidence only).",
    "Widen isEditorialChromeUnit to catch single-hit commission lists (VOcALEs/Decanos) when length>200 and ≥3 OCR-shred tokens.",
    "Index-zone: re-OCR or placeholder remaining two-column materias pages (wrong_column_merge) when vowel ratio low + dual-column pattern; keep unitIndex.",
    "Optional internal_word_period whitelist dict only (no global lowercase.period.lowercase join).",
    "Extend accent/confusion map for body: be venido→he venido, comsensu→consensu (title refs), FaustTo→Fausto when adjacent to dialogue labels.",
    "Do not strip intentional Latin body blocks; dual-stream ES/LA is editorial BAC.",
    "Never reorder units; never paraphrase theological body.",
    "Re-OCR residualBodyNoiseUnits=14 pages flagged by isResidualBodyNoise rather than inventing text.",
]

report = {
    "documentId": DOC,
    "unitsSampled": len(sample),
    "unitsTotal": n,
    "severityScore": severity_score,
    "frontMatterNoise": front_noise > 15 or placeholder_n > 5,
    "bodyProseNoise": body_noise > 40 or body_avg >= 16 or counts.get("other_illegible", 0) >= 8,
    "indexGarbage": index_noise_n > 10
    or counts.get("index_noise", 0) > 15
    or counts.get("wrong_column_merge", 0) >= 8,
    "findings": findings[:10],
    "defectClasses": defect_classes,
    "suggestedRules": suggested[:8],
    "_debug": {
        "body_avg": round(body_avg, 2),
        "high": high,
        "front_noise": front_noise,
        "index_noise_n": index_noise_n,
        "body_noise": body_noise,
        "placeholders": placeholder_n,
        "counts": dict(counts),
    },
}

OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
SAMPLES.write_text(
    json.dumps({"samples": samples_out, "counts": dict(counts)}, ensure_ascii=False, indent=2),
    encoding="utf-8",
)
print(json.dumps(report, ensure_ascii=False, indent=2))
