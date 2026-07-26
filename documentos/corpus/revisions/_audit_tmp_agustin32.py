#!/usr/bin/env python3
"""Sample + classify residual OCR defects for agustin-32-antidonatistas-1-es."""
from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

DOC_ID = "agustin-32-antidonatistas-1-es"
ROOT = Path(__file__).resolve().parents[3]
CONTENT = ROOT / "documentos/corpus/documents" / DOC_ID / "content.json"
OUT = Path(__file__).resolve().parent / f"_audit-{DOC_ID}-samples.json"
REPORT = Path(__file__).resolve().parent / f"_audit-{DOC_ID}-report.json"

LETTER = r"A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÿ"
LOWER = r"a-záéíóúüñà-ÿ"
UPPER = r"A-ZÁÉÍÓÚÜÑÀ-ÿ"

PLACEHOLDER = "[OCR: índice o tabla ilegible omitido]"

PATTERNS = {
    "toc_dotted_garbage": re.compile(r"(?:\.{4,}|\. \. \. \.|\t\.+\t|…{2,}|_{4,})"),
    "bac_chrome_frontmatter": re.compile(
        r"(BIBLIOTECA DE AUTORES CRISTIANOS|B\.?\s*A\.?\s*C\.?|PONTIFICIA UNIVERSIDAD DE SALAMANCA|"
        r"LA COMISIÓN DE DICHA|IMPRENTA|DEPÓSITO LEGAL|Nihil obstat|Imprimi potest|Imprimatur|"
        r"TOMO XXXII|AUTORES CRISTIANOS Declarada|MCMLXXXVIII|MCML)",
        re.I,
    ),
    "spaced_or_shredded_letters": re.compile(
        rf"(?<![{LETTER}])(?:[{LETTER}])(?: [{LETTER}]){{3,}}(?![{LETTER}])"
    ),
    "internal_word_period": re.compile(rf"[{LOWER}]{{2}}\.[{LOWER}]{{2}}"),
    "hyphen_mid_line": re.compile(rf"[{LETTER}]{{2}}-\s+[{LETTER}]{{2}}"),
    "digit_glued_tokens": re.compile(rf"(?:\d[{LETTER}]{{2,}}|[{LETTER}]{{2,}}\d)"),
    "mojibake_replacement_chars": re.compile(r"(�|Ã¡|Ã©|Ã­|Ã³|Ãº|Ã±|â€™|â€œ|â€|ï¿½|ﬁ|ﬂ)"),
    "latin_mixed_into_spanish_body": re.compile(
        r"\b(?:quia|quod|quae|sicut|enim|autem|igitur|propter|secundum|"
        r"dicitur|dicit|huius|eius|eorum|ecclesiae|baptismo)\b",
        re.I,
    ),
    "wrong_column_merge": re.compile(
        r"(?:[a-záéíóúñ]{3,}\s{2,}[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\s+\d+\s+[A-ZÁÉÍÓÚÑ])|"
        r"(?:\b\d{1,3}\s+[A-Za-záéíóúñ]{4,}\s+\d{1,3}\s+[A-Za-záéíóúñ]{4,}\s+\d{1,3})"
    ),
    "ellipses_leaders": re.compile(r"(?:\.\s*){3,}|…+|\.{3,}"),
    "page_headers_footers": re.compile(
        r"(?:—\s*\d+\s*—|\bP[aá]g(?:ina)?\.?\s*\d+|\bVOL(?:UMEN)?\.?\s*XXXII\b|"
        r"SAN AGUST[IÍ]N\s*[-–—]\s*\d+|OBRAS DE SAN AGUST|ESCRITOS ANTIDONATISTAS)",
        re.I,
    ),
}

COVERED = {
    "toc_dotted_garbage": "partial",  # ocr-abc garbage placeholder; residual leaders remain
    "bac_chrome_frontmatter": "none",
    "spaced_or_shredded_letters": "full",  # ocr-abc spaced-letter-collapse
    "internal_word_period": "none",  # ocr-punct deliberately does not join
    "hyphen_mid_line": "none",
    "glued_words": "partial",  # ocr-abc splitGluedUpperParticles trailing only
    "digit_glued_tokens": "none",
    "mojibake/replacement_chars": "none",
    "latin_mixed_into_spanish_body": "none",
    "wrong_column_merge": "none",
    "accent_corruption": "partial",  # high-confidence confusions only
    "ellipses_leaders": "partial",  # ocr-punct collapses spaced ellipsis
    "page_headers_footers": "none",
    "index_noise": "partial",  # garbage TOC exclude placeholder
    "other_illegible": "none",
}


def snippet(text: str, m: re.Match | None = None, width: int = 120) -> str:
    if not text:
        return ""
    if m is None:
        s = text[:width]
    else:
        a = max(0, m.start() - 40)
        b = min(len(text), m.end() + 40)
        s = text[a:b]
    s = re.sub(r"\s+", " ", s).strip()
    if len(s) > width:
        s = s[: width - 1] + "…"
    return s


def classify_unit(text: str, unit_index: int, total: int) -> list[str]:
    if not text:
        return []
    if text.strip() == PLACEHOLDER:
        return ["toc_dotted_garbage"]
    classes: list[str] = []
    is_front = unit_index < 100
    is_tail = unit_index >= total - 200

    if PATTERNS["toc_dotted_garbage"].search(text):
        leaders = len(PATTERNS["toc_dotted_garbage"].findall(text))
        if leaders >= 2 or (leaders >= 1 and len(text) < 220):
            classes.append("toc_dotted_garbage")
        else:
            classes.append("ellipses_leaders")
    elif PATTERNS["ellipses_leaders"].search(text):
        # single ellipsis in prose is ok; count dense
        if len(PATTERNS["ellipses_leaders"].findall(text)) >= 2:
            classes.append("ellipses_leaders")

    if is_front and (
        PATTERNS["bac_chrome_frontmatter"].search(text)
        or re.search(
            r"(?i)(?:ORDEN SISTEM[AÁ]TICO|DE LA PRESENTE EDICI[OÓ]N|BIBLICGRAFIA|"
            r"INTRODUCCION GENERAL|DEDICATORIA|SIGLAS|ABREVIATURAS|"
            r"Escrriros|Escurros|Esckrrros|aPoLoG|sígLICOS|rFiLosór)",
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

    glued = False
    if re.search(r"\b(?:LOSSEÑORES\w*|DELA[A-ZÁÉÍÓÚÑ]{2,}|PARAEL\w+|[A-ZÁÉÍÓÚÑ]{14,})\b", text):
        glued = True
    if re.search(rf"[{LOWER}]{{3,}}[{UPPER}][{LOWER}]{{2,}}", text):
        glued = True
    if re.search(
        r"\b(?:[A-ZÁÉÍÓÚÑ]{3,}(?:DE|LA|LOS|LAS|EL|EN|DEL|CON|POR|QUE)[A-ZÁÉÍÓÚÑ]{3,})\b",
        text,
    ):
        glued = True
    # shredded OCR tokens like Escrriros, BIBLICGRAFIA counted as other/glued noise front
    if glued:
        classes.append("glued_words")

    if PATTERNS["digit_glued_tokens"].search(text):
        classes.append("digit_glued_tokens")

    if PATTERNS["mojibake_replacement_chars"].search(text):
        classes.append("mojibake/replacement_chars")

    latin_hits = PATTERNS["latin_mixed_into_spanish_body"].findall(text)
    if (
        len(latin_hits) >= 5
        and re.search(r"\b(?:que|los|las|del|una|por|con)\b", text, re.I)
        and unit_index > 100
    ):
        classes.append("latin_mixed_into_spanish_body")

    if PATTERNS["wrong_column_merge"].search(text):
        classes.append("wrong_column_merge")

    missing = re.findall(
        r"\b(?:ademas|despues|tambien|espiritu|apostol|"
        r"justificacion|santificacion|resurreccion|oracion|corazon|"
        r"salvacion|predicacion|exhortacion|introduccion|conclusion|"
        r"iluminacion|BIBLICGRAFIA)\b",
        text,
        re.I,
    )
    # OCR letter corruption (not just missing accents)
    corrupt = re.findall(
        r"\b(?:Escrriros|Escurros|Esckrrros|sígLICOS|rFiLosórFicOsS|aPoLoGÉricos|"
        r"BIBLICGRAFIA|VIIT|XXVIIL|TT\.\s*TI)\b",
        text,
    )
    if len(missing) >= 2 or corrupt:
        classes.append("accent_corruption")

    if PATTERNS["page_headers_footers"].search(text) and len(text) < 200:
        classes.append("page_headers_footers")
    if re.match(r"^\s*—?\s*\d{1,4}\s*—?\s*$", text.strip()):
        classes.append("page_headers_footers")

    if is_tail:
        nums = len(re.findall(r"\b\d+\b", text))
        words = re.findall(rf"[{LETTER}]+", text)
        if nums >= 5 and words and nums / max(len(words), 1) > 0.25:
            classes.append("index_noise")
        elif re.search(r"(?i)véase|v\.\s*t|cf\.|cfr\.|índice|indice", text):
            classes.append("index_noise")
        elif len(text) < 100 and re.search(r"\d", text) and nums >= 2:
            classes.append("index_noise")

    letters = re.findall(rf"[{LETTER}]", text)
    if letters and len(letters) > 50:
        vowels = sum(1 for ch in letters if ch.lower() in "aeiouáéíóúü")
        vr = vowels / len(letters)
        if vr < 0.28:
            classes.append("other_illegible")
        elif re.search(r"[oncrim]{12,}", text, re.I):
            classes.append("other_illegible")
        # high rate of OCR garbage characters mixed in short tokens
        words = re.findall(rf"[{LETTER}]+", text)
        if words:
            short = sum(1 for w in words if len(w) <= 2)
            if short / len(words) > 0.6 and len(words) > 20 and vr < 0.4:
                classes.append("other_illegible")

    # shredded mixed-case OCR in front matter titles
    if re.search(r"(?:[A-Za-z]*[a-z][A-Z]{2,}[a-z]+|[A-Z]{2,}[a-z]{2,}[A-Z]{2,})", text):
        if "accent_corruption" not in classes and unit_index < 80:
            # count as accent/letter corruption already handled via corrupt list
            pass

    return list(dict.fromkeys(classes))


def severity_of_unit(text: str, classes: list[str]) -> int:
    if not text:
        return 40
    if text.strip() == PLACEHOLDER:
        return 90
    score = 0
    weights = {
        "toc_dotted_garbage": 40,
        "bac_chrome_frontmatter": 12,
        "spaced_or_shredded_letters": 35,
        "internal_word_period": 18,
        "hyphen_mid_line": 10,
        "glued_words": 15,
        "digit_glued_tokens": 10,
        "mojibake/replacement_chars": 40,
        "latin_mixed_into_spanish_body": 22,
        "wrong_column_merge": 45,
        "accent_corruption": 18,
        "ellipses_leaders": 10,
        "page_headers_footers": 12,
        "index_noise": 30,
        "other_illegible": 50,
    }
    for c in classes:
        score += weights.get(c, 10)
    letters = re.findall(rf"[{LETTER}]", text)
    if letters:
        vowels = sum(1 for ch in letters if ch.lower() in "aeiouáéíóúü")
        vr = vowels / len(letters)
        if vr < 0.28:
            score += 40
        elif vr < 0.35:
            score += 15
    # shredded title tokens
    if re.search(r"\b(?:Escrriros|Escurros|Esckrrros|BIBLICGRAFIA)\b", text):
        score += 20
    return min(100, score)


def refine_snip(text: str, c: str) -> str:
    pat_map = {
        "internal_word_period": PATTERNS["internal_word_period"],
        "hyphen_mid_line": PATTERNS["hyphen_mid_line"],
        "spaced_or_shredded_letters": PATTERNS["spaced_or_shredded_letters"],
        "digit_glued_tokens": PATTERNS["digit_glued_tokens"],
        "mojibake/replacement_chars": PATTERNS["mojibake_replacement_chars"],
        "ellipses_leaders": PATTERNS["ellipses_leaders"],
        "page_headers_footers": PATTERNS["page_headers_footers"],
        "bac_chrome_frontmatter": PATTERNS["bac_chrome_frontmatter"],
        "toc_dotted_garbage": PATTERNS["toc_dotted_garbage"],
        "wrong_column_merge": PATTERNS["wrong_column_merge"],
    }
    pat = pat_map.get(c)
    if pat:
        m = pat.search(text)
        if m:
            return snippet(text, m)
    if c == "glued_words":
        m = re.search(
            r"\b(?:[A-ZÁÉÍÓÚÑ]{3,}(?:DE|LA|LOS|LAS|EL|EN|DEL|CON|POR|QUE)[A-ZÁÉÍÓÚÑ]{3,}|[A-ZÁÉÍÓÚÑ]{14,})\b",
            text,
        )
        if m:
            return snippet(text, m)
    if c == "accent_corruption":
        m = re.search(
            r"\b(?:Escrriros|Escurros|Esckrrros|BIBLICGRAFIA|ademas|despues|tambien|espiritu)\b",
            text,
            re.I,
        )
        if m:
            return snippet(text, m)
    return snippet(text)


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
        for i in range(n_mid):
            idx = body_start + i * stride
            if idx < body_end:
                mid.append(idx)
    # denser index zone
    index_zone = list(range(max(0, total - 200), max(0, total - 40), 4))
    # extra front chrome 80-150
    extra_front = list(range(80, min(150, total), 3))
    sample_idxs = sorted(set(front + mid + tail + index_zone + extra_front))

    class_examples: dict[str, list[dict]] = defaultdict(list)
    class_counts_sampled: dict[str, int] = defaultdict(int)
    full_counts: dict[str, int] = defaultdict(int)
    full_examples: dict[str, list[dict]] = defaultdict(list)

    samples_out = []
    sample_severities = []

    for i in sample_idxs:
        u = units[i]
        text = u.get("contenido") or ""
        cons = str(u.get("consecutivo") or "")
        classes = classify_unit(text, i, total)
        sev = severity_of_unit(text, classes)
        sample_severities.append(sev)
        for c in classes:
            class_counts_sampled[c] += 1
            if len(class_examples[c]) < 4:
                class_examples[c].append(
                    {"unitIndex": i, "consecutivo": cons, "snippet": refine_snip(text, c)}
                )
        samples_out.append(
            {
                "unitIndex": i,
                "consecutivo": cons,
                "classes": classes,
                "severity": sev,
                "len": len(text),
                "preview": snippet(text, width=180),
            }
        )

    # Full-corpus scan for counts
    all_severities = []
    front_noise = 0
    body_noise = 0
    index_noise_n = 0
    body_sev_sum = 0
    body_sev_n = 0
    for i, u in enumerate(units):
        text = u.get("contenido") or ""
        cons = str(u.get("consecutivo") or "")
        classes = classify_unit(text, i, total)
        sev = severity_of_unit(text, classes)
        all_severities.append(sev)
        if i < 120 and classes:
            front_noise += 1
        if 200 <= i < total - 200 and sev >= 25:
            body_noise += 1
        if i >= total - 200 and "index_noise" in classes:
            index_noise_n += 1
        if 200 <= i < total - 200:
            body_sev_sum += sev
            body_sev_n += 1
        for c in classes:
            full_counts[c] += 1
            if len(full_examples[c]) < 4:
                full_examples[c].append(
                    {"unitIndex": i, "consecutivo": cons, "snippet": refine_snip(text, c)}
                )

    avg_sev = sum(all_severities) / max(len(all_severities), 1)
    body_avg = body_sev_sum / max(body_sev_n, 1)
    # overall severityScore: blend body readability + residual defect density
    high = sum(1 for s in all_severities if s >= 35)
    high_ratio = high / max(total, 1)
    # map to 0-100 document score
    # clean BAC body ~10-20; this pack likely moderate residual
    severity_score = int(
        min(
            100,
            round(
                body_avg * 0.55
                + high_ratio * 100 * 0.35
                + (15 if front_noise > 30 else 5)
                + (10 if index_noise_n > 20 else 0)
            ),
        )
    )

    defect_classes = []
    # prefer full_counts, cap 16 classes
    for c, cnt in sorted(full_counts.items(), key=lambda x: -x[1])[:16]:
        exs = full_examples.get(c) or class_examples.get(c) or []
        defect_classes.append(
            {
                "class": c,
                "count": cnt,
                "coveredByExistingRepair": COVERED.get(c, "unknown"),
                "examples": exs[:4],
            }
        )

    findings = []
    findings.append(
        f"Pack BAC XXXII antidonatistas ES: {total} units; ocr-punct-v2 changed 519, ocr-abc-v2 changed 342 (spaced collapse)."
    )
    findings.append(
        f"Front matter (units 0–~100) is noisy BAC chrome with shredded titles (Escrriros/Escurros/BIBLICGRAFIA) and orden sistemático fragments."
    )
    if full_counts.get("digit_glued_tokens"):
        findings.append(
            f"digit_glued_tokens residual dense ({full_counts['digit_glued_tokens']} units) — refs/pages glued to letters."
        )
    if full_counts.get("internal_word_period"):
        findings.append(
            f"internal_word_period left unrepaired by design ({full_counts['internal_word_period']} units)."
        )
    if full_counts.get("index_noise"):
        findings.append(
            f"Tail index zone has index_noise in {full_counts['index_noise']} units (ocr-abc residualBodyNoiseUnits=13, tocLeaderHits=5)."
        )
    if full_counts.get("spaced_or_shredded_letters", 0) == 0:
        findings.append("spaced-letter runs appear fully collapsed by ocr-abc-v2 (0 residual spaced runs in scan).")
    if full_counts.get("hyphen_mid_line"):
        findings.append(
            f"hyphen_mid_line still present in {full_counts['hyphen_mid_line']} units (line-break hyphens not rejoined)."
        )
    findings.append(
        f"Full-scan high-severity units (≥35): {high}/{total}; body_avg_severity≈{body_avg:.1f}."
    )

    suggested = []
    if full_counts.get("hyphen_mid_line"):
        suggested.append(
            "Rejoin hyphen+space mid-line only when both sides are lowercase letter runs ≥2: /([a-záéíóúñ]{2})-\\s+([a-záéíóúñ]{2})/ → '$1$2' (no cross-unit)."
        )
    if full_counts.get("digit_glued_tokens"):
        suggested.append(
            "Split digit-letter glue with conservative whitelist: /(\\d)([A-Za-záéíóúñ]{3,})/ → '$1 $2' and /([A-Za-záéíóúñ]{3,})(\\d{2,})/ → '$1 $2' excluding bibl. book codes."
        )
    if full_counts.get("page_headers_footers"):
        suggested.append(
            "Blank or strip short page-header units matching /^(—\\s*)?\\d{1,4}(\\s*—)?$/ or repeating 'OBRAS DE SAN AGUSTÍN' running heads (keep unitIndex slot)."
        )
    if full_counts.get("bac_chrome_frontmatter") or full_counts.get("accent_corruption"):
        suggested.append(
            "Front-matter only: map high-confidence shredded title tokens (Escrriros→Escritos, Escurros→Escritos, BIBLICGRAFIA→BIBLIOGRAFIA, XXVIIL→XXVIII) via fixed dict; do not touch body theology."
        )
    if full_counts.get("glued_words"):
        suggested.append(
            "Extend glued-uppercase particle split: insert space before DE|LA|LOS|DEL|CON|POR inside [A-Z]{12,} runs when stem≥5 (already partial in ocr-abc)."
        )
    if full_counts.get("toc_dotted_garbage") or full_counts.get("index_noise"):
        suggested.append(
            "Mark remaining TOC/index dotted-leader units with OCR_GARBAGE_PLACEHOLDER (stable index) when leader density high and unit short."
        )
    if full_counts.get("internal_word_period"):
        suggested.append(
            "Do NOT auto-join lowercase.period.lowercase globally; optionally whitelist mid-word OCR splits only with dictionary check (sancti.ficationis) — leave que.dista alone."
        )
    suggested.append(
        "No unit reordering; never paraphrase theological body. Prefer re-OCR residualBodyNoise pages over creative repair."
    )

    report = {
        "documentId": DOC_ID,
        "unitsSampled": len(sample_idxs),
        "unitsTotal": total,
        "severityScore": severity_score,
        "frontMatterNoise": front_noise > 20,
        "bodyProseNoise": body_noise > 50 or body_avg >= 18,
        "indexGarbage": index_noise_n > 15 or full_counts.get("index_noise", 0) > 20,
        "findings": findings[:10],
        "defectClasses": defect_classes,
        "suggestedRules": suggested[:8],
        "_debug": {
            "avg_severity": round(avg_sev, 2),
            "body_avg_severity": round(body_avg, 2),
            "high_units": high,
            "front_noise_units": front_noise,
            "index_noise_tail": index_noise_n,
            "full_counts": dict(full_counts),
            "sample_avg_sev": round(sum(sample_severities) / max(len(sample_severities), 1), 2),
        },
    }

    OUT.write_text(
        json.dumps(
            {
                "documentId": DOC_ID,
                "unitsTotal": total,
                "unitsSampled": len(sample_idxs),
                "samples": samples_out,
                "class_counts_sampled": dict(class_counts_sampled),
                "class_examples": {k: v for k, v in class_examples.items()},
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    print(f"\n# wrote {OUT}", file=sys.stderr)
    print(f"# wrote {REPORT}", file=sys.stderr)
    print(
        f"# total={total} sampled={len(sample_idxs)} severity={severity_score} body_avg={body_avg:.1f}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
