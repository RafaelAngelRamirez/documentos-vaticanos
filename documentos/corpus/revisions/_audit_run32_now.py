#!/usr/bin/env python3
"""One-shot residual OCR audit for agustin-32-antidonatistas-1-es (content.json)."""
from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

DOC_ID = "agustin-32-antidonatistas-1-es"
ROOT = Path("/home/angel/proyectos/personal/documentos-vaticanos")
CONTENT = ROOT / "documentos/corpus/documents" / DOC_ID / "content.json"
OUT_SAMPLES = ROOT / "documentos/corpus/revisions" / f"_audit-{DOC_ID}-samples.json"
OUT_REPORT = ROOT / "documentos/corpus/revisions" / f"_audit-{DOC_ID}-report.json"

LETTER = r"A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÿ"
LOWER = r"a-záéíóúüñà-ÿ"
UPPER = r"A-ZÁÉÍÓÚÜÑÀ-ÿ"
PLACEHOLDER = "[OCR: índice o tabla ilegible omitido]"

PATTERNS = {
    "toc_dotted_garbage": re.compile(
        r"(?:\.{4,}|\. \. \. \.|_{4,}|(?:o ccoo|ccoocioo|ovoOo|ooo ooo|cooo coo))"
    ),
    "bac_chrome_frontmatter": re.compile(
        r"(BIBLIOTECA DE AUTORES CRISTIANOS|B\.?\s*A\.?\s*C\.?|PONTIFICIA UNIVERSIDAD DE SALAMANCA|"
        r"LA COMISIÓN DE DICHA|IMPRENTA|DEPÓSITO LEGAL|Depósito legal|Nihil obstat|Imprimi potest|Imprimatur|"
        r"TOMO XXXII|MCMLXXXVIII|ISBN:|ORDEN SISTEM[AÁ]TICO|Escrriros|Escurros|Esckrrros|BIBLICGRAFIA)",
        re.I,
    ),
    "spaced_or_shredded_letters": re.compile(
        rf"(?<![{LETTER}])(?:[{LETTER}])(?: [{LETTER}]){{3,}}(?![{LETTER}])"
    ),
    "internal_word_period": re.compile(rf"[{LOWER}]{{2}}\.[{LOWER}]{{2}}"),
    "hyphen_mid_line": re.compile(rf"[{LETTER}]{{2}}-\s+[{LETTER}]{{2}}"),
    "digit_glued_tokens": re.compile(rf"(?:\d[{LETTER}]{{2,}}|[{LETTER}]{{2,}}\d{{2,}})"),
    "mojibake/replacement_chars": re.compile(r"(�|Ã¡|Ã©|Ã­|Ã³|Ãº|Ã±|â€™|â€œ|â€|ï¿½)"),
    "latin_mixed_into_spanish_body": re.compile(
        r"\b(?:quia|quod|quae|sicut|enim|autem|igitur|propter|secundum|"
        r"dicitur|dicit|huius|eius|eorum|ecclesiae|baptismo)\b",
        re.I,
    ),
    "wrong_column_merge": re.compile(
        r"(?:[a-záéíóúñ]{3,}\s{2,}[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\s+\d)|"
        r"(?:\b\d{1,3}\s+[A-Za-záéíóúñ]{3,}\s+\d{1,3}\s+[A-Za-záéíóúñ]{3,}\s+\d{1,3})"
    ),
    "ellipses_leaders": re.compile(r"(?:\.\s*){3,}|…+|\.{3,}"),
    "page_headers_footers": re.compile(
        r"(?:—\s*\d+\s*—|\bP[aá]g(?:ina)?\.?\s*\d+|\bS\.Ag\.\s*32\b|"
        r"SAN AGUST[IÍ]N\s*[-–—]\s*\d+|OBRAS DE SAN AGUST|ESCRITOS ANTIDONATISTAS)",
        re.I,
    ),
    "other_illegible": re.compile(r"[oncrim]{12,}", re.I),
}

COVERED = {
    "toc_dotted_garbage": "partial",
    "bac_chrome_frontmatter": "none",
    "spaced_or_shredded_letters": "full",
    "internal_word_period": "none",
    "hyphen_mid_line": "none",
    "glued_words": "partial",
    "digit_glued_tokens": "none",
    "mojibake/replacement_chars": "none",
    "latin_mixed_into_spanish_body": "none",
    "wrong_column_merge": "none",
    "accent_corruption": "partial",
    "ellipses_leaders": "partial",
    "page_headers_footers": "none",
    "index_noise": "partial",
    "other_illegible": "none",
}


def snip(text: str, m: re.Match | None = None, width: int = 140) -> str:
    if not text:
        return ""
    if m is None:
        s = text[:width]
    else:
        a = max(0, m.start() - 35)
        b = min(len(text), m.end() + 45)
        s = text[a:b]
    s = re.sub(r"\s+", " ", s).strip()
    return s if len(s) <= width else s[: width - 1] + "…"


def classify(text: str, i: int, total: int) -> list[str]:
    if not text:
        return []
    if text.strip() == PLACEHOLDER:
        return ["toc_dotted_garbage"]
    classes: list[str] = []
    is_front = i < 120
    is_tail = i >= total - 250

    if PATTERNS["toc_dotted_garbage"].search(text) or (
        re.search(r"o ccoo|ccoocioo|ovoOo|ooo ooo|cooo coo", text, re.I)
        and ("..." in text or ".." in text or "…" in text)
    ):
        classes.append("toc_dotted_garbage")
    elif PATTERNS["ellipses_leaders"].search(text):
        if len(PATTERNS["ellipses_leaders"].findall(text)) >= 2:
            classes.append("ellipses_leaders")

    if is_front and (
        PATTERNS["bac_chrome_frontmatter"].search(text)
        or re.search(
            r"(?i)(?:ORDEN SISTEM|DE LA PRESENTE EDICI|BIBLICGRAFIA|INTRODUCCION GENERAL|"
            r"DEDICATORIA|SIGLAS|Escrriros|Escurros|Esckrrros|MMNA|XNMIMORTA|aPoLoG|sígLICOS|rFiLosór)",
            text,
        )
    ):
        classes.append("bac_chrome_frontmatter")

    if PATTERNS["spaced_or_shredded_letters"].search(text):
        classes.append("spaced_or_shredded_letters")
    if PATTERNS["internal_word_period"].search(text):
        classes.append("internal_word_period")
    if PATTERNS["hyphen_mid_line"].search(text):
        classes.append("hyphen_mid_line")

    if re.search(
        r"\b(?:[A-ZÁÉÍÓÚÑ]{3,}(?:DE|LA|LOS|LAS|EL|EN|DEL|CON|POR|QUE)[A-ZÁÉÍÓÚÑ]{3,}|[A-ZÁÉÍÓÚÑ]{14,})\b",
        text,
    ) or re.search(rf"[{LOWER}]{{3,}}[{UPPER}][{LOWER}]{{2,}}", text):
        classes.append("glued_words")

    if PATTERNS["digit_glued_tokens"].search(text):
        classes.append("digit_glued_tokens")
    if PATTERNS["mojibake/replacement_chars"].search(text):
        classes.append("mojibake/replacement_chars")

    latin_hits = PATTERNS["latin_mixed_into_spanish_body"].findall(text)
    if (
        len(latin_hits) >= 5
        and re.search(r"\b(?:que|los|las|del|una|por|con)\b", text, re.I)
        and i > 100
    ):
        # intentional bilingual BAC body is common — flag only dense latin+spanish mixes
        classes.append("latin_mixed_into_spanish_body")

    if PATTERNS["wrong_column_merge"].search(text):
        classes.append("wrong_column_merge")

    if re.search(
        r"\b(?:Escrriros|Escurros|Esckrrros|BIBLICGRAFIA|ademas|despues|tambien|espiritu|"
        r"petsonaje|domatismO|lglesia|petsecución|ertor)\b",
        text,
        re.I,
    ):
        classes.append("accent_corruption")

    if PATTERNS["page_headers_footers"].search(text) and len(text) < 220:
        classes.append("page_headers_footers")
    if re.match(r"^\s*—?\s*\d{1,4}\s*—?\s*$", text.strip()):
        classes.append("page_headers_footers")

    if is_tail:
        nums = len(re.findall(r"\b\d+\b", text))
        words = re.findall(rf"[{LETTER}]+", text)
        if nums >= 5 and words and nums / max(len(words), 1) > 0.25:
            classes.append("index_noise")
        elif re.search(r"(?i)véase|v\.\s*t|índice|indice de notas|indice bíblico|indice de", text):
            classes.append("index_noise")
        elif len(text) < 120 and re.search(r"\d", text) and nums >= 2:
            classes.append("index_noise")

    if PATTERNS["other_illegible"].search(text):
        classes.append("other_illegible")
    else:
        letters = re.findall(rf"[{LETTER}]", text)
        if len(letters) > 80:
            vowels = sum(1 for ch in letters if ch.lower() in "aeiouáéíóúü")
            if vowels / len(letters) < 0.28:
                classes.append("other_illegible")

    return list(dict.fromkeys(classes))


def refine(text: str, c: str) -> str:
    map_pat = {
        "internal_word_period": PATTERNS["internal_word_period"],
        "hyphen_mid_line": PATTERNS["hyphen_mid_line"],
        "spaced_or_shredded_letters": PATTERNS["spaced_or_shredded_letters"],
        "digit_glued_tokens": PATTERNS["digit_glued_tokens"],
        "mojibake/replacement_chars": PATTERNS["mojibake/replacement_chars"],
        "ellipses_leaders": PATTERNS["ellipses_leaders"],
        "page_headers_footers": PATTERNS["page_headers_footers"],
        "bac_chrome_frontmatter": PATTERNS["bac_chrome_frontmatter"],
        "toc_dotted_garbage": PATTERNS["toc_dotted_garbage"],
        "wrong_column_merge": PATTERNS["wrong_column_merge"],
        "other_illegible": PATTERNS["other_illegible"],
    }
    pat = map_pat.get(c)
    if pat:
        m = pat.search(text)
        if m:
            return snip(text, m)
    if c == "accent_corruption":
        m = re.search(
            r"\b(?:Escrriros|Escurros|Esckrrros|BIBLICGRAFIA|petsonaje|domatismO|lglesia|petsecución)\b",
            text,
            re.I,
        )
        if m:
            return snip(text, m)
    if c == "glued_words":
        m = re.search(
            r"\b(?:[A-ZÁÉÍÓÚÑ]{3,}(?:DE|LA|LOS|LAS|EL|EN|DEL|CON|POR|QUE)[A-ZÁÉÍÓÚÑ]{3,}|[A-ZÁÉÍÓÚÑ]{14,})\b",
            text,
        )
        if m:
            return snip(text, m)
    return snip(text)


def main() -> int:
    units = json.loads(CONTENT.read_text(encoding="utf-8"))
    total = len(units)
    front = list(range(0, min(80, total)))
    tail = list(range(max(0, total - 40), total))
    body_start = 80
    body_end = max(body_start, total - 40)
    body_span = body_end - body_start
    mid: list[int] = []
    if body_span > 0:
        n_mid = 40
        stride = max(1, body_span // n_mid)
        for k in range(n_mid):
            idx = body_start + k * stride
            if idx < body_end:
                mid.append(idx)
    index_zone = list(range(max(0, total - 200), max(0, total - 40), 4))
    extra_front = list(range(80, min(150, total), 3))
    sample_idxs = sorted(set(front + mid + tail + index_zone + extra_front))

    full_counts: dict[str, int] = defaultdict(int)
    full_examples: dict[str, list] = defaultdict(list)
    sample_rows = []
    all_sev = []
    front_noise = 0
    body_noise = 0
    index_noise_n = 0
    body_sev_sum = 0
    body_sev_n = 0

    weights = {
        "toc_dotted_garbage": 40,
        "bac_chrome_frontmatter": 12,
        "spaced_or_shredded_letters": 35,
        "internal_word_period": 18,
        "hyphen_mid_line": 10,
        "glued_words": 15,
        "digit_glued_tokens": 8,
        "mojibake/replacement_chars": 40,
        "latin_mixed_into_spanish_body": 12,
        "wrong_column_merge": 45,
        "accent_corruption": 18,
        "ellipses_leaders": 10,
        "page_headers_footers": 12,
        "index_noise": 30,
        "other_illegible": 50,
    }

    for i, u in enumerate(units):
        text = u.get("contenido") or ""
        cons = str(u.get("consecutivo") or "")
        classes = classify(text, i, total)
        sev = 0
        for c in classes:
            sev += weights.get(c, 10)
            full_counts[c] += 1
            if len(full_examples[c]) < 4:
                full_examples[c].append(
                    {"unitIndex": i, "consecutivo": cons, "snippet": refine(text, c)}
                )
        letters = re.findall(rf"[{LETTER}]", text)
        if letters:
            vowels = sum(1 for ch in letters if ch.lower() in "aeiouáéíóúü")
            vr = vowels / len(letters)
            if vr < 0.28:
                sev += 40
            elif vr < 0.35:
                sev += 15
        sev = min(100, sev)
        all_sev.append(sev)
        if i < 120 and classes:
            front_noise += 1
        if 200 <= i < total - 200 and sev >= 25:
            body_noise += 1
        if i >= total - 250 and "index_noise" in classes:
            index_noise_n += 1
        if 200 <= i < total - 200:
            body_sev_sum += sev
            body_sev_n += 1

    for i in sample_idxs:
        u = units[i]
        text = u.get("contenido") or ""
        cons = str(u.get("consecutivo") or "")
        classes = classify(text, i, total)
        sample_rows.append(
            {
                "unitIndex": i,
                "consecutivo": cons,
                "classes": classes,
                "len": len(text),
                "preview": snip(text, width=200),
            }
        )

    body_avg = body_sev_sum / max(body_sev_n, 1)
    high = sum(1 for s in all_sev if s >= 35)
    high_ratio = high / max(total, 1)
    severity_score = int(
        min(
            100,
            round(
                body_avg * 0.45
                + high_ratio * 100 * 0.30
                + (18 if front_noise > 40 else 8 if front_noise > 20 else 3)
                + (12 if index_noise_n > 30 else 6 if index_noise_n > 10 else 0)
                + (8 if full_counts.get("toc_dotted_garbage", 0) > 30 else 0)
            ),
        )
    )

    defect_classes = []
    for c, cnt in sorted(full_counts.items(), key=lambda x: -x[1])[:16]:
        defect_classes.append(
            {
                "class": c,
                "count": int(cnt),
                "coveredByExistingRepair": COVERED.get(c, "unknown"),
                "examples": full_examples.get(c, [])[:4],
            }
        )

    findings = [
        f"BAC XXXII antidonatistas ES: {total} units; ocr-punct-v2 changed 519; ocr-abc-v2 changed 342 (spaced collapse; residualBodyNoiseUnits=13, residualScore=213).",
        f"Front noise units (0–119 with any defect class): {front_noise}; BAC chrome shredded titles remain (Escrriros/Escurros/BIBLICGRAFIA).",
        f"toc_dotted_garbage full-count={full_counts.get('toc_dotted_garbage',0)}; ocr-abc tocLeaderHits=5 residual (garbageUnits still 0).",
        f"Body mid-zone (200..n-200) units with severity≥25: {body_noise}; body_avg_severity≈{body_avg:.1f}; high-severity(≥35)={high}/{total}.",
        f"index_noise tail count={full_counts.get('index_noise',0)}; wrong_column_merge={full_counts.get('wrong_column_merge',0)} (two-col indices).",
        f"internal_word_period={full_counts.get('internal_word_period',0)} (ocr-punct does not join lowercase.period.lowercase).",
        f"hyphen_mid_line={full_counts.get('hyphen_mid_line',0)}; page_headers_footers={full_counts.get('page_headers_footers',0)} (S.Ag. 32 running heads).",
        f"spaced_or_shredded_letters residual={full_counts.get('spaced_or_shredded_letters',0)} after ocr-abc-v2 (expected ~0).",
        f"digit_glued_tokens={full_counts.get('digit_glued_tokens',0)}; accent_corruption={full_counts.get('accent_corruption',0)}; glued_words={full_counts.get('glued_words',0)}.",
        "Bilingual Latin+Spanish blocks in body are intentional BAC edition layout, not pure OCR bleed — do not purge Latin wholesale.",
    ]

    suggested = [
        "Front-only fixed dict: Escrriros|Escurros|Esckrrros|Escrrros→Escritos; BIBLICGRAFIA→BIBLIOGRAFÍA; XXVIIL→XXVIII; VIIT→VIII (no body theology).",
        "Mark short TOC lines with leader soup (o ccoo|ccoocioo + \\.{2,}) as OCR_GARBAGE_PLACEHOLDER keeping unitIndex.",
        "Rejoin hyphen+space mid-line only for lowercase letter runs: /([a-záéíóúñ]{2,})-\\s+([a-záéíóúñ]{2,})/ → $1$2 (not across units).",
        "Strip/blank short running-head units matching /^S\\.Ag\\.\\s*32\\b/ or lone page numbers (keep slots).",
        "Split digit↔letter glue conservatively excluding bibl. abbreviations: /(\\d)([A-Za-záéíóúñ]{3,})/ and /([A-Za-záéíóúñ]{3,})(\\d{2,})/.",
        "Do NOT auto-join internal lowercase.period.lowercase; optional dictionary whitelist only for clear mid-word OCR splits.",
        "Index zone: prefer re-OCR or blank two-column shredded index pages over invent-merge.",
        "Never reorder units; never paraphrase theological body. Prefer re-OCR residualBodyNoise pages over creative repair.",
    ]

    report = {
        "documentId": DOC_ID,
        "unitsSampled": len(sample_idxs),
        "unitsTotal": total,
        "severityScore": severity_score,
        "frontMatterNoise": front_noise > 20,
        "bodyProseNoise": body_noise > 80 or body_avg >= 15 or full_counts.get("other_illegible", 0) >= 8,
        "indexGarbage": index_noise_n > 15 or full_counts.get("index_noise", 0) > 20,
        "findings": findings[:10],
        "defectClasses": defect_classes,
        "suggestedRules": suggested[:8],
        "_debug": {
            "body_avg_severity": round(body_avg, 2),
            "high_units": high,
            "front_noise_units": front_noise,
            "index_noise_tail": index_noise_n,
            "full_counts": dict(full_counts),
        },
    }

    OUT_SAMPLES.write_text(
        json.dumps(
            {
                "documentId": DOC_ID,
                "unitsTotal": total,
                "unitsSampled": len(sample_idxs),
                "samples": sample_rows,
                "full_counts": dict(full_counts),
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    OUT_REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    print(f"# wrote {OUT_SAMPLES}", file=sys.stderr)
    print(f"# wrote {OUT_REPORT}", file=sys.stderr)
    print(
        f"# total={total} sampled={len(sample_idxs)} severity={severity_score} body_avg={body_avg:.1f}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
