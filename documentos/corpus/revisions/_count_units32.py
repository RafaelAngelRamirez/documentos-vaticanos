#!/usr/bin/env python3
"""Count units from clean text the same way plainTextToUnits(paragraphs) does,
and sample from content.json for residual OCR audit."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path("/home/angel/proyectos/personal/documentos-vaticanos")
CLEAN = ROOT / "documentos/padres-source/clean/agustin-32-antidonatistas-1-es.txt"
CONTENT = ROOT / "documentos/corpus/documents/agustin-32-antidonatistas-1-es/content.json"
OUT = ROOT / "documentos/corpus/revisions/_audit-agustin-32-antidonatistas-1-es-samples.json"
REPORT = ROOT / "documentos/corpus/revisions/_audit-agustin-32-antidonatistas-1-es-report.json"

MIN_LEN = 20
MAX_LEN = 2500


def soft_normalize(text: str) -> str:
    t = text.replace("\r\n", "\n").replace("\r", "\n")
    t = re.sub(r"[ \t]+\n", "\n", t)
    t = re.sub(r"\n{3,}", "\n\n", t)
    t = re.sub(r"[ \t]{2,}", " ", t)
    return t.strip()


def split_paragraphs(text: str) -> list[str]:
    t = soft_normalize(text)
    parts = re.split(r"\n\s*\n+", t)
    out = []
    for p in parts:
        cleaned = re.sub(r"\s+", " ", p.replace("\n", " ")).strip()
        if cleaned:
            out.append(cleaned)
    return out


def cap_unit_length(chunks: list[str], max_len: int = MAX_LEN) -> list[str]:
    out: list[str] = []
    for chunk in chunks:
        if len(chunk) <= max_len:
            out.append(chunk)
            continue
        sentences = re.split(r"(?<=[.!?…»\"])\s+(?=[A-ZÁÉÍÓÚÜÑ¿¡\d«\"])", chunk)
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


def units_from_clean(text: str) -> list[str]:
    chunks = split_paragraphs(text)
    chunks = [c for c in chunks if len(c) >= MIN_LEN]
    chunks = cap_unit_length(chunks)
    return chunks


def main() -> None:
    clean_text = CLEAN.read_text(encoding="utf-8")
    derived = units_from_clean(clean_text)
    content_units = json.loads(CONTENT.read_text(encoding="utf-8"))
    n = len(content_units)
    print(f"derived_units={len(derived)} content_units={n}")

    # Prefer content.json as ground truth
    units = content_units

    front = list(range(min(80, n)))
    tail = list(range(max(0, n - 40), n))
    body_start, body_end = 80, max(80, n - 40)
    stride = max(1, (body_end - body_start) // 40)
    mid = [body_start + i * stride for i in range(40) if body_start + i * stride < body_end]
    index_zone = list(range(max(0, n - 200), max(0, n - 40), 4))
    sample = sorted(set(front + mid + tail + index_zone))

    PLACEHOLDER = "[OCR: índice o tabla ilegible omitido]"
    LETTER = r"A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÿ"
    LOWER = r"a-záéíóúüñà-ÿ"

    patterns = {
        "toc_dotted_garbage": re.compile(r"(?:\.{4,}|\. \. \. \.|_{4,}|(?:\.\s*){6,}|[oncrim ]{8,}\.\.\.)"),
        "bac_chrome_frontmatter": re.compile(
            r"BIBLIOTECA DE AUTORES CRISTIANOS|MCMLXXXVIII|PONTIFICIA UNIVERSIDAD DE SALAMANCA|DEPÓSITO LEGAL|Depósito legal|ISBN:|IMPRENTA|Nihil obstat|Imprimatur",
            re.I,
        ),
        "spaced_or_shredded_letters": re.compile(
            rf"(?<![{LETTER}])(?:[{LETTER}])(?: [{LETTER}]){{3,}}(?![{LETTER}])"
        ),
        "internal_word_period": re.compile(rf"[{LOWER}]{{2}}\.[{LOWER}]{{2}}"),
        "hyphen_mid_line": re.compile(rf"[{LETTER}]{{2}}-\s+[{LETTER}]{{2}}"),
        "digit_glued_tokens": re.compile(rf"(?:\d[{LETTER}]{{2,}}|[{LETTER}]{{2,}}\d{{2,}})"),
        "mojibake/replacement_chars": re.compile(r"�|Ã¡|Ã©|Ã­|Ã³|Ãº|Ã±|â€™|â€œ|ï¿½"),
        "ellipses_leaders": re.compile(r"(?:\.\s*){3,}|\.{3,}"),
        "page_headers_footers": re.compile(
            r"(?:—\s*\d+\s*—|S\.Ag\.\s*32|OBRAS DE SAN AGUSTÍN|Tratado sobre el bautismo\s+\d)",
            re.I,
        ),
        "wrong_column_merge": re.compile(
            r"(?:[a-záéíóúñ]{3,}\s{2,}[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\s+\d)|(?:\b\d{1,3}\s+[A-Za-záéíóúñ]{3,}\s+\d{1,3}\s+[A-Za-záéíóúñ]{3,})"
        ),
        "other_illegible": re.compile(r"[oncrim]{12,}", re.I),
    }

    full_counts: dict[str, int] = {}
    full_examples: dict[str, list] = {}

    def add(cls: str, i: int, cons: str, text: str, snip: str | None = None) -> None:
        full_counts[cls] = full_counts.get(cls, 0) + 1
        full_examples.setdefault(cls, [])
        if len(full_examples[cls]) < 4:
            full_examples[cls].append(
                {
                    "unitIndex": i,
                    "consecutivo": cons,
                    "snippet": (snip or text[:140]).replace("\n", " ")[:160],
                }
            )

    for i, u in enumerate(units):
        text = u.get("contenido") or ""
        cons = str(u.get("consecutivo") or "")
        if text.strip() == PLACEHOLDER:
            add("toc_dotted_garbage", i, cons, text, text[:80])
            continue

        if patterns["toc_dotted_garbage"].search(text) or (
            re.search(r"o ccoo|ccoocioo|ovoOo|ooo ooo|cooo coo", text, re.I)
            and ("..." in text or ".." in text)
        ):
            add("toc_dotted_garbage", i, cons, text)

        if i < 120 and (
            patterns["bac_chrome_frontmatter"].search(text)
            or re.search(
                r"Escrriros|Escurros|Esckrrros|BIBLICGRAFIA|ORDEN SISTEMATICO|MMNA|XNMIMORTA",
                text,
            )
        ):
            add("bac_chrome_frontmatter", i, cons, text)

        if patterns["spaced_or_shredded_letters"].search(text):
            add("spaced_or_shredded_letters", i, cons, text)

        if patterns["internal_word_period"].search(text):
            m = patterns["internal_word_period"].search(text)
            add("internal_word_period", i, cons, text, text[max(0, m.start() - 20) : m.end() + 30] if m else None)

        if patterns["hyphen_mid_line"].search(text):
            m = patterns["hyphen_mid_line"].search(text)
            add("hyphen_mid_line", i, cons, text, text[max(0, m.start() - 15) : m.end() + 25] if m else None)

        if re.search(
            r"\b(?:[A-ZÁÉÍÓÚÑ]{3,}(?:DE|LA|LOS|LAS|EL|DEL|CON|POR|QUE)[A-ZÁÉÍÓÚÑ]{3,}|[A-ZÁÉÍÓÚÑ]{14,})\b",
            text,
        ):
            add("glued_words", i, cons, text)

        if patterns["digit_glued_tokens"].search(text):
            add("digit_glued_tokens", i, cons, text)

        if patterns["mojibake/replacement_chars"].search(text):
            add("mojibake/replacement_chars", i, cons, text)

        latin = re.findall(
            r"\b(?:quia|quod|quae|sicut|enim|autem|igitur|propter|secundum|dicitur|huius|eius)\b",
            text,
            re.I,
        )
        if i > 200 and len(latin) >= 6 and re.search(r"\b(?:que|los|las|del|por|con)\b", text, re.I):
            add("latin_mixed_into_spanish_body", i, cons, text)

        if patterns["wrong_column_merge"].search(text):
            add("wrong_column_merge", i, cons, text)

        if re.search(
            r"\b(?:Escrriros|Escurros|Esckrrros|BIBLICGRAFIA|ademas|despues|tambien|espiritu|ertor|petsonaje|domatismO|lglesia)\b",
            text,
            re.I,
        ):
            add("accent_corruption", i, cons, text)

        if patterns["ellipses_leaders"].search(text) and "toc_dotted_garbage" not in (
            k for k in full_examples if False
        ):
            # only if not already counted as toc for this unit - approximate
            if not (
                re.search(r"o ccoo|ccoocioo", text, re.I)
                and ("..." in text or ".." in text)
            ):
                if len(patterns["ellipses_leaders"].findall(text)) >= 2:
                    add("ellipses_leaders", i, cons, text)

        if patterns["page_headers_footers"].search(text) and len(text) < 220:
            add("page_headers_footers", i, cons, text)

        if i >= n - 250:
            nums = len(re.findall(r"\b\d+\b", text))
            words = re.findall(rf"[{LETTER}]+", text)
            if nums >= 5 and words and nums / max(len(words), 1) > 0.25:
                add("index_noise", i, cons, text)
            elif re.search(r"(?i)índice|indice de|véase", text):
                add("index_noise", i, cons, text)

        if patterns["other_illegible"].search(text):
            add("other_illegible", i, cons, text)
        else:
            letters = re.findall(rf"[{LETTER}]", text)
            if len(letters) > 80:
                vowels = sum(1 for ch in letters if ch.lower() in "aeiouáéíóúü")
                if vowels / len(letters) < 0.28:
                    add("other_illegible", i, cons, text)

    # samples dump
    samples = []
    for i in sample:
        t = units[i].get("contenido") or ""
        samples.append(
            {
                "unitIndex": i,
                "consecutivo": str(units[i].get("consecutivo") or ""),
                "len": len(t),
                "preview": t[:200].replace("\n", " "),
            }
        )

    # severity
    body_noise = full_counts.get("other_illegible", 0) + full_counts.get("wrong_column_merge", 0)
    front_noise = full_counts.get("bac_chrome_frontmatter", 0) + full_counts.get("toc_dotted_garbage", 0)
    # document severity: front/index heavy but body mostly readable
    sev = 28
    if full_counts.get("toc_dotted_garbage", 0) > 50:
        sev += 8
    if full_counts.get("index_noise", 0) > 40:
        sev += 8
    if full_counts.get("other_illegible", 0) > 10:
        sev += 6
    if full_counts.get("internal_word_period", 0) > 5:
        sev += 2
    if full_counts.get("hyphen_mid_line", 0) > 30:
        sev += 3
    sev = min(100, sev)

    covered = {
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

    defect_classes = []
    for cls, cnt in sorted(full_counts.items(), key=lambda x: -x[1])[:16]:
        defect_classes.append(
            {
                "class": cls,
                "count": cnt,
                "coveredByExistingRepair": covered.get(cls, "unknown"),
                "examples": full_examples.get(cls, [])[:4],
            }
        )

    findings = [
        f"BAC XXXII antidonatistas ES: {n} units; ocr-punct-v2 changed 519; ocr-abc-v2 changed 342 (spaced collapse; residualBodyNoiseUnits=13, residualScore=213).",
        "Front matter (orden sistemático, comisión BAC, índice general) is heavily shredded OCR: Escrriros/Escurros/Esckrrros, BIBLICGRAFIA, MMNA/XNMIMORTA.",
        "TOC leaders leave 'o ccoo / ccoocioo / ooo ooo' soup with dotted leaders; ocr-abc tocLeaderHits=5 residual (garbageUnits still 0 — placeholder threshold not met for most).",
        "Body Spanish prose (p.ej. tratado del bautismo) is largely readable; bilingual Latin blocks are intentional BAC, not pure OCR bleed.",
        f"Tail indices (bíblico/nombres/notas) show two-column merge and index_noise; counts: index_noise={full_counts.get('index_noise',0)}, wrong_column_merge={full_counts.get('wrong_column_merge',0)}.",
        f"internal_word_period residual={full_counts.get('internal_word_period',0)} (ocr-punct deliberately does not join lowercase.period.lowercase).",
        f"hyphen_mid_line residual={full_counts.get('hyphen_mid_line',0)}; page_headers_footers={full_counts.get('page_headers_footers',0)} (S.Ag. 32 / running heads).",
        f"spaced_or_shredded_letters residual={full_counts.get('spaced_or_shredded_letters',0)} after ocr-abc-v2 (expected ~0).",
        "Queue: ocr-reocr-queue lists this pack residualScore=213 (spot-check-then-re-ocr-if-body-noise).",
    ]

    suggested = [
        "Front-only dict map high-confidence shredded tokens: Escrriros|Escurros|Esckrrros|Escrrros→Escritos, BIBLICGRAFIA→BIBLIOGRAFÍA, XXVIIL→XXVIII, VIIT→VIII (do not touch body theology).",
        "Mark short TOC lines with leader soup (o ccoo|ccoocioo + \\.{2,}) as OCR_GARBAGE_PLACEHOLDER keeping unitIndex.",
        "Rejoin hyphen+space mid-line only for lowercase letter runs: /([a-záéíóúñ]{2,})-\\s+([a-záéíóúñ]{2,})/ → $1$2 (not across units).",
        "Strip/blank short running-head units matching /^S\\.Ag\\.\\s*32\\b/ or lone page numbers (keep slots).",
        "Split digit↔letter glue conservatively excluding bibl. abbreviations: /(\\d)([A-Za-záéíóúñ]{3,})/ and /([A-Za-záéíóúñ]{3,})(\\d{2,})/.",
        "Do NOT auto-join internal lowercase.period.lowercase; optional dictionary whitelist only for clear mid-word OCR splits.",
        "Index zone: prefer re-OCR or blank two-column shredded index pages over mechanical invent-merge.",
        "Never reorder units; never paraphrase theological body.",
    ]

    report = {
        "documentId": "agustin-32-antidonatistas-1-es",
        "unitsSampled": len(sample),
        "unitsTotal": n,
        "severityScore": sev,
        "frontMatterNoise": True,
        "bodyProseNoise": full_counts.get("other_illegible", 0) >= 8
        or full_counts.get("internal_word_period", 0) >= 8,
        "indexGarbage": full_counts.get("index_noise", 0) >= 20
        or full_counts.get("wrong_column_merge", 0) >= 10,
        "findings": findings[:10],
        "defectClasses": defect_classes,
        "suggestedRules": suggested[:8],
    }

    OUT.write_text(json.dumps({"samples": samples, "counts": full_counts}, ensure_ascii=False, indent=2), encoding="utf-8")
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
