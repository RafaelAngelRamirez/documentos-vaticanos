#!/usr/bin/env python3
"""
Translate CCEO Latin units → Spanish (Google Translate via deep-translator).

Checkpointed: resume-safe. Produces:
  - checkpoint JSON (partial/full units)
  - labeled dump for import_cceo_es.ts
  - content.json ready for corpus write

Usage:
  python3 translate_cceo_es.py
  python3 translate_cceo_es.py --resume
  python3 translate_cceo_es.py --limit 20   # smoke
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
LA_CONTENT = REPO / "documentos/corpus/documents/cceo-la/content.json"
OUT_DIR = REPO / "documentos/magisterium-source/clean"
CHECKPOINT = OUT_DIR / "cceo-es.translate.checkpoint.json"
LABELED = OUT_DIR / "cceo-es.txt"
CONTENT_OUT = OUT_DIR / "cceo-es.content.json"

# Prefer project venv if present (scratch or local); else system with deep_translator.
try:
    from deep_translator import GoogleTranslator
except ImportError:
    print(
        "deep_translator required. e.g. pip install deep-translator",
        file=sys.stderr,
    )
    sys.exit(1)


CAN_RE = re.compile(
    r"\b[Cc]ann?\.\s*\d+(?:\s*(?:,|et|–|-)\s*\d+)*",
)
SEC_RE = re.compile(r"§{1,2}\s*\d+")
# Latin cross-ref leftovers after unprotect
ET_IN_CANN = re.compile(r"\b(cann\.\s*\d+)\s+et\s+(\d+)\b", re.I)


def protect(text: str) -> tuple[str, dict[str, str]]:
    toks: dict[str, str] = {}

    def repl(m: re.Match[str]) -> str:
        key = f"__TOK{len(toks)}__"
        toks[key] = m.group(0)
        return f" {key} "

    out = CAN_RE.sub(repl, text)
    out = SEC_RE.sub(repl, out)
    return out, toks


def unprotect(text: str, toks: dict[str, str]) -> str:
    for k, v in toks.items():
        text = text.replace(k, v)
        text = text.replace(k.lower(), v)
    return text


def postprocess(es: str) -> str:
    # Normalize canon abbreviations
    es = re.sub(r"(?i)\bcan\.\s*(\d)", r"Can. \1", es)
    es = re.sub(r"(?i)\bcann\.\s*", "cann. ", es)
    es = ET_IN_CANN.sub(r"\1 y \2", es)
    # Collapse whitespace while keeping single newlines if any
    es = re.sub(r"[ \t]+", " ", es)
    es = re.sub(r" *\n *", "\n", es)
    es = re.sub(r"\n{3,}", "\n\n", es)
    # Google sometimes leaves "Poder." if protect missed
    es = re.sub(r"^Poder\.\s*(\d+)", r"Can. \1", es)
    es = es.strip()
    return es


def translate_one(translator: GoogleTranslator, latin: str, retries: int = 5) -> str:
    protected, toks = protect(latin)
    last_err: Exception | None = None
    for attempt in range(retries):
        try:
            # Google free endpoint ~5k chars; our max unit is ~2.5k
            raw = translator.translate(protected)
            if not raw or not str(raw).strip():
                raise RuntimeError("empty translation")
            return postprocess(unprotect(str(raw), toks))
        except Exception as e:  # noqa: BLE001 — network/rate-limit resilience
            last_err = e
            wait = min(60, 2 ** attempt)
            print(f"  [retry {attempt+1}/{retries}] {e}; sleep {wait}s", flush=True)
            time.sleep(wait)
    raise RuntimeError(f"translate failed after {retries}: {last_err}")


def looks_spanish(text: str) -> bool:
    """Heuristic: Spanish function words / not pure Latin stubs."""
    if "[TRADUCIR]" in text:
        return False
    low = text.lower()
    # Latin-heavy markers that should not dominate
    latin_hits = sum(
        1
        for w in (
            "huius",
            "codicis",
            "ecclesiae",
            "episcopi",
            "quod attinet",
            "nisi",
            "sunt.",
            "debent",
        )
        if w in low
    )
    es_hits = sum(
        1
        for w in (
            " de ",
            " los ",
            " las ",
            " del ",
            " que ",
            " para ",
            " con ",
            " este ",
            " según ",
            " debe ",
            " pueden ",
            " iglesia",
            " cánon",
            " canon",
            " obispo",
        )
        if w in low
    )
    return es_hits >= 2 and latin_hits <= 3


def load_checkpoint() -> dict:
    if CHECKPOINT.exists():
        return json.loads(CHECKPOINT.read_text(encoding="utf-8"))
    return {"units": {}, "meta": {}}


def save_checkpoint(cp: dict) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    CHECKPOINT.write_text(
        json.dumps(cp, ensure_ascii=False, indent=0) + "\n",
        encoding="utf-8",
    )


def write_outputs(units: list[dict]) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    # labeled dump: consecutivo\nbody\n\n
    labeled_parts = []
    content = []
    for u in units:
        consec = str(u["consecutivo"])
        body = (u["contenido"] or "").strip()
        labeled_parts.append(f"{consec}\n{body}")
        content.append(
            {
                "consecutivo": consec,
                "contenido": body,
                "referencias": u.get("referencias") or [],
            }
        )
    LABELED.write_text("\n\n".join(labeled_parts).strip() + "\n", encoding="utf-8")
    CONTENT_OUT.write_text(
        json.dumps(content, ensure_ascii=False), encoding="utf-8"
    )
    print(f"[✓] wrote {LABELED} ({len(units)} units)")
    print(f"[✓] wrote {CONTENT_OUT}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="Only first N units")
    ap.add_argument("--resume", action="store_true", help="Resume checkpoint")
    ap.add_argument(
        "--sleep",
        type=float,
        default=0.15,
        help="Delay between requests (seconds)",
    )
    ap.add_argument(
        "--force-retranslate",
        action="store_true",
        help="Ignore checkpoint translations",
    )
    args = ap.parse_args()

    la_units = json.loads(LA_CONTENT.read_text(encoding="utf-8"))
    if args.limit and args.limit > 0:
        la_units = la_units[: args.limit]

    cp = load_checkpoint() if (args.resume or CHECKPOINT.exists()) else {"units": {}, "meta": {}}
    if args.force_retranslate:
        cp = {"units": {}, "meta": {}}

    translator = GoogleTranslator(source="la", target="es")
    done = 0
    total = len(la_units)
    print(f"[i] translating {total} CCEO units la→es", flush=True)

    out_units: list[dict] = []
    for i, u in enumerate(la_units):
        consec = str(u["consecutivo"])
        latin = (u.get("contenido") or "").strip()
        key = consec

        if not args.force_retranslate and key in cp["units"]:
            es = cp["units"][key]["contenido"]
        else:
            es = translate_one(translator, latin)
            cp["units"][key] = {
                "consecutivo": consec,
                "contenido": es,
                "latin_len": len(latin),
                "es_len": len(es),
            }
            done += 1
            if done % 25 == 0 or done == 1:
                save_checkpoint(cp)
                print(
                    f"  [{i+1}/{total}] Can. {consec} ok (new={done})",
                    flush=True,
                )
            time.sleep(args.sleep)

        out_units.append(
            {
                "consecutivo": consec,
                "contenido": es if key in cp["units"] else cp["units"].get(key, {}).get("contenido", es),
                "referencias": u.get("referencias") or [],
            }
        )
        # always take from checkpoint if present
        if key in cp["units"]:
            out_units[-1]["contenido"] = cp["units"][key]["contenido"]

    save_checkpoint(cp)
    write_outputs(out_units)

    # Quality gate on samples
    bad = []
    for idx in (0, min(10, total - 1), min(100, total - 1), total // 2, total - 1):
        if idx < 0 or idx >= total:
            continue
        body = out_units[idx]["contenido"]
        if not looks_spanish(body):
            bad.append((idx, out_units[idx]["consecutivo"], body[:120]))
        if "[TRADUCIR]" in body:
            bad.append((idx, out_units[idx]["consecutivo"], "STUB"))
    if bad:
        print("[!] quality issues:", bad, file=sys.stderr)
        return 2
    print(f"[✓] done: {total} units, new_translations={done}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
