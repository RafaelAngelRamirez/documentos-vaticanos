#!/usr/bin/env python3
"""
Scrape official English Catechism (CCC) from vatican.va ENG0015 IntraText.

Produces labeled units + content.json for import_ccc_official.ts:
  documentos/magisterium-source/clean/cic-en.content.json

Usage:
  python3 scrape_ccc_eng0015.py
  python3 scrape_ccc_eng0015.py --limit 20   # smoke
"""
from __future__ import annotations

import argparse
import html as html_lib
import json
import re
import time
import urllib.error
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
OUT_DIR = REPO / "documentos/magisterium-source/clean"
BASE = "https://www.vatican.va/archive/ENG0015"
INDEX = f"{BASE}/_INDEX.HTM"
UA = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 DocumentosVaticanos/1.0"
)


def fetch(url: str, retries: int = 4) -> str:
    last: Exception | None = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=45) as resp:
                raw = resp.read()
            # IntraText ENG0015 is latin-1 / iso-8859-1
            return raw.decode("latin-1", errors="replace")
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(1.2 * (attempt + 1))
    raise RuntimeError(f"fetch failed {url}: {last}")


def strip_tags(s: str) -> str:
    s = re.sub(r"<br\s*/?>", "\n", s, flags=re.I)
    s = re.sub(r"</p\s*>", "\n", s, flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    s = html_lib.unescape(s)
    s = s.replace("\xa0", " ")
    s = re.sub(r"[ \t]+\n", "\n", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    s = re.sub(r"[ \t]{2,}", " ", s)
    return s.strip()


def list_pages(index_html: str) -> list[str]:
    """Collect __P*.HTM page names from index (no extra HTTP).

    IntraText uses base36-ish suffixes (__P1 … __P9, __PA …). Index order of
    appearance is good enough for scrape; numbering is de-duplicated later.
    """
    found = re.findall(r"(__P[A-Z0-9]+\.HTM)", index_html, flags=re.I)
    # preserve first-seen order from TOC
    seen: set[str] = set()
    pages: list[str] = []
    for p in found:
        key = p.upper()
        if key in seen:
            continue
        seen.add(key)
        pages.append(p if p.endswith(".HTM") else p)
    if "__P1.HTM" not in {p.upper() for p in pages} and " __P1.HTM" not in index_html:
        # ensure prologue page is first if present under any case
        pass
    # Prefer starting at __P1 when listed
    upper_map = {p.upper(): p for p in pages}
    if "__P1.HTM" in upper_map:
        first = upper_map["__P1.HTM"]
        pages = [first] + [p for p in pages if p.upper() != "__P1.HTM"]
    return pages


def parse_units(page_html: str) -> list[dict]:
    """Extract numbered CCC paragraphs and section headers from one page."""
    units: list[dict] = []
    # Prefer MsoNormal paragraphs
    blocks = re.findall(
        r"<p class=MsoNormal>(.*?)</p>", page_html, flags=re.S | re.I
    )
    if not blocks:
        # fallback: strip body-ish
        m = re.search(r"<hr size=1 noshade>(.*)<hr size=1 width=30%", page_html, re.S | re.I)
        if m:
            text = strip_tags(m.group(1))
            for line in text.split("\n"):
                line = line.strip()
                if not line or line in ("Previous - Next", "Next", "Previous"):
                    continue
                mm = re.match(r"^(\d{1,4})\s+(.+)$", line, re.S)
                if mm:
                    units.append(
                        {
                            "consecutivo": mm.group(1),
                            "contenido": f"{mm.group(1)} {mm.group(2).strip()}",
                            "referencias": [],
                        }
                    )
                elif len(line) > 3:
                    units.append(
                        {
                            "consecutivo": "section",
                            "contenido": line,
                            "referencias": [],
                        }
                    )
        return units

    for raw in blocks:
        text = strip_tags(raw)
        if not text:
            continue
        # skip nav crumbs
        if text in ("Previous - Next", "Previous", "Next") or text.startswith(
            "Copyright"
        ):
            continue
        # footnote body at bottom often "1 Jn 17 3" — skip short pure refs after §
        mm = re.match(r"^(\d{1,4})\s+(.+)$", text, re.S)
        if mm:
            n, body = mm.group(1), mm.group(2).strip()
            # skip bare footnote expansions (very short + bible-ish)
            if len(body) < 40 and re.search(
                r"\b(Jn|Mt|Mk|Lk|Rom|Cor|Tim|Acts|Gen|Ex|Ps)\b", body
            ):
                continue
            units.append(
                {
                    "consecutivo": n,
                    "contenido": f"{n} {body}",
                    "referencias": [],
                }
            )
        else:
            # section / title
            if len(text) < 2:
                continue
            units.append(
                {
                    "consecutivo": "section",
                    "contenido": text,
                    "referencias": [],
                }
            )
    return units


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="max pages (0=all)")
    ap.add_argument("--sleep", type=float, default=0.15)
    args = ap.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"[i] index {INDEX}")
    index_html = fetch(INDEX)
    pages = list_pages(index_html)
    print(f"[i] {len(pages)} pages")
    if args.limit:
        pages = pages[: args.limit]

    all_units: list[dict] = []
    seen_nums: set[str] = set()
    for i, page in enumerate(pages):
        url = f"{BASE}/{page}"
        try:
            html = fetch(url)
        except Exception as e:
            print(f"[!] {page}: {e}")
            continue
        units = parse_units(html)
        for u in units:
            c = u["consecutivo"]
            if c.isdigit():
                if c in seen_nums:
                    # keep first occurrence of numbered paragraph
                    continue
                seen_nums.add(c)
            all_units.append(u)
        if (i + 1) % 25 == 0 or i == 0:
            print(
                f"  progress pages={i+1}/{len(pages)} units={len(all_units)} "
                f"nums={len(seen_nums)}"
            )
        time.sleep(args.sleep)

    out = OUT_DIR / "cic-en.content.json"
    out.write_text(json.dumps(all_units, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"[✓] wrote {len(all_units)} units ({len(seen_nums)} numbered) → {out}")
    if all_units:
        print("[i] sample0:", all_units[0]["contenido"][:120])
        # find first numbered
        for u in all_units:
            if u["consecutivo"].isdigit():
                print("[i] sample num:", u["contenido"][:120])
                break
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
