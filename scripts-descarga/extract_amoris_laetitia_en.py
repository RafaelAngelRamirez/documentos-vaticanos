#!/usr/bin/env python3
"""Extract the 325 numbered paragraphs of Amoris laetitia (English).

The HTML page on vatican.va is a cover (title, language bar, PDF link).
The exhortation itself is the official PDF. This reads `pdftotext -bbox-layout`
and keeps body-sized words, so footnotes and the end-matter table of contents
stay out of the numbered paragraphs.

Usage:
  pdftotext -bbox-layout AMORIS.pdf - | python3 extract_amoris_laetitia_en.py > units.json

The PDF is:
  https://www.vatican.va/content/dam/francesco/pdf/apost_exhortations/documents/papa-francesco_esortazione-ap_20160319_amoris-laetitia_en.pdf
"""

from __future__ import annotations

import json
import re
import sys

PDF_URL = (
    "https://www.vatican.va/content/dam/francesco/pdf/apost_exhortations/"
    "documents/papa-francesco_esortazione-ap_20160319_amoris-laetitia_en.pdf"
)
EXPECTED = 325
PRAYER = "Prayer to the Holy Family"


def words_of(body: str) -> list[dict]:
    out = []
    for x0, y0, x1, y1, text in re.findall(
        r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">'
        r"([^<]*)</word>",
        body,
    ):
        x0f, y0f, x1f, y1f = map(float, (x0, y0, x1, y1))
        out.append(
            {
                "x0": x0f,
                "y0": y0f,
                "x1": x1f,
                "y1": y1f,
                "t": text,
                "h": y1f - y0f,
            }
        )
    return out


def page_lines(body: str) -> list[str]:
    words = words_of(body)
    items = [word for word in words if 14.5 <= word["h"] <= 22]
    items.sort(key=lambda word: (word["y0"], word["x0"]))
    lines: list[dict] = []
    for word in items:
        if lines and abs(word["y0"] - lines[-1]["y0"]) < 2.5:
            lines[-1]["words"].append(word)
        else:
            lines.append({"y0": word["y0"], "y1": word["y1"], "words": [word]})
    # Section titles use a body-sized initial and small-caps for the rest
    # ("Y" + "ou and your wife"). They are not part of the numbered paragraph.
    small = [
        word
        for word in words
        if 8 <= word["h"] < 14.5 and not re.fullmatch(r"\d+", word["t"])
    ]
    headings = set()
    for index, line in enumerate(lines):
        body = line["words"]
        if not body or any(len(word["t"].strip(" ,.;:")) > 2 for word in body):
            continue
        if any(abs(word["y0"] - line["y0"]) < 8 for word in small):
            headings.add(index)
    drop_caps = [word for word in words if word["h"] > 28]
    for word in small + drop_caps:
        best = None
        best_overlap = 0.0
        best_index = None
        for index, line in enumerate(lines):
            if index in headings:
                continue
            overlap = min(word["y1"], line["y1"]) - max(word["y0"], line["y0"])
            if overlap > best_overlap:
                best_overlap = overlap
                best = line
                best_index = index
        if best is not None and best_overlap > 2 and best_index not in headings:
            best["words"].append(word)
    texts = []
    for index, line in enumerate(lines):
        if index in headings:
            continue
        ordered = sorted(line["words"], key=lambda word: word["x0"])
        probe = " ".join(word["t"] for word in ordered).strip()
        if re.fullmatch(r"\d+", probe) and line["y0"] > 590:
            continue
        if re.fullmatch(r"[*•·.\s]+", probe):
            continue
        text = ""
        prev = None
        for word in ordered:
            if prev is None:
                text = word["t"]
            else:
                gap = word["x0"] - prev["x1"]
                text += ("" if gap < 1.2 else " ") + word["t"]
            prev = word
        text = re.sub(r"\s+", " ", text).strip()
        if text:
            texts.append(text)
    return texts


def join_lines(lines: list[str]) -> str:
    joined: list[str] = []
    buf = ""
    for line in lines:
        if buf.endswith("-"):
            buf = buf[:-1] + line
        else:
            if buf:
                joined.append(buf)
            buf = line
    if buf:
        joined.append(buf)
    return "\n".join(joined)


def paragraphs(html: str) -> dict[int, str]:
    pages = re.findall(r"<page[^>]*>(.*?)</page>", html, re.S)
    if len(pages) < 200:
        raise SystemExit(f"expected the full PDF, got {len(pages)} pages")
    lines: list[str] = []
    for page in pages:
        lines.extend(page_lines(page))
    parts = re.split(r"(?:^|\n)(\d+)\.\s+", join_lines(lines))
    found: dict[int, str] = {}
    index = 1
    while index + 1 < len(parts):
        number = int(parts[index])
        body = re.sub(r"\s+", " ", parts[index + 1]).strip()
        if number in found:
            raise SystemExit(f"duplicate paragraph {number}")
        found[number] = body
        index += 2
    return found


def units_from_html(html: str) -> list[dict]:
    found = paragraphs(html)
    missing = [n for n in range(1, EXPECTED + 1) if n not in found]
    extra = sorted(n for n in found if n < 1 or n > EXPECTED)
    if missing or extra or len(found) != EXPECTED:
        raise SystemExit(f"paragraphs missing={missing[:8]} extra={extra[:8]} count={len(found)}")
    last = found[EXPECTED]
    prayer = last.find(PRAYER)
    if prayer < 0:
        raise SystemExit("paragraph 325 does not reach the closing prayer heading")
    last = last[:prayer].strip()
    if "fullness of love and communion" not in last:
        raise SystemExit("paragraph 325 lost its closing sentence")
    if ". ." in last:
        raise SystemExit("paragraph 325 still contains the table of contents")
    found[EXPECTED] = last
    units = []
    for number in range(1, EXPECTED + 1):
        body = found[number]
        if not body or ". ." in body:
            raise SystemExit(f"paragraph {number} is empty or swallowed the contents")
        units.append(
            {
                "consecutivo": str(number),
                "contenido": f"{number}. {body}",
                "referencias": [],
            }
        )
    opening = units[0]["contenido"]
    if not opening.startswith("1. The Joy of Love"):
        raise SystemExit(f"paragraph 1 does not open the exhortation: {opening[:80]}")
    third = units[2]["contenido"]
    if "time is greater than space" not in third:
        raise SystemExit("paragraph 3 lost the Evangelii gaudium quote")
    psalm = units[7]["contenido"]
    if not psalm.rstrip().endswith("(Ps 128:1-6)."):
        raise SystemExit("paragraph 8 still includes the following section title")
    if units[88]["contenido"].rstrip().endswith("Our daily love"):
        raise SystemExit("paragraph 89 still includes the following section title")
    return units


def main() -> None:
    html = sys.stdin.read()
    units = units_from_html(html)
    json.dump(units, sys.stdout, ensure_ascii=False, separators=(",", ":"))
    print(
        f"extract_amoris_laetitia_en: {len(units)} paragraphs from {PDF_URL}",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
