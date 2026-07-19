#!/usr/bin/env python3
"""
Generic batch MT: base content.json (usually es) → target locale twin.

Produces:
  - checkpoint JSON (resume-safe, per pack+locale)
  - labeled dump for import_locale_twin.ts
  - content.json ready for corpus write

Protects Can. N / § from translation. Batches short units under ~4000 chars.

Usage:
  python3 translate_locale_twin.py --base lg-es --locale en
  python3 translate_locale_twin.py --base cceo-es --locale zh --resume
  python3 translate_locale_twin.py --base lg-es --locale en --limit 5   # smoke

  # Prefer project venv with deep-translator:
  #   python3 -m venv /tmp/grok-goal-bf844dbde623/implementer/venv
  #   /tmp/grok-goal-bf844dbde623/implementer/venv/bin/pip install deep-translator
  #   /tmp/grok-goal-bf844dbde623/implementer/venv/bin/python translate_locale_twin.py …
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
CORPUS_DOCS = REPO / "documentos/corpus/documents"
OUT_DIR = REPO / "documentos/magisterium-source/clean"

try:
    from deep_translator import GoogleTranslator, MyMemoryTranslator
except ImportError:
    print(
        "deep_translator required. e.g.\n"
        "  python3 -m venv /tmp/grok-goal-bf844dbde623/implementer/venv\n"
        "  /tmp/grok-goal-bf844dbde623/implementer/venv/bin/pip install deep-translator\n",
        file=sys.stderr,
    )
    sys.exit(1)

# Google free endpoint hard-caps ~5000 chars; stay well under (UTF-8 / markup expansion).
# MyMemory free endpoint hard-caps ~500 chars.
MAX_BATCH_CHARS = 3500
MAX_SINGLE_CHARS = 4500
MYMEMORY_MAX_CHARS = 450
UNIT_SEP = "\n\n⟦U⟧\n\n"

# Session-level: prefer MyMemory after Google rate-limit storms.
_PREFERRED_BACKEND = "google"

# MyMemory wants BCP-like codes (es-ES, en-GB, zh-CN, …).
MYMEMORY_CODES = {
    "es": "es-ES",
    "en": "en-GB",
    "zh": "zh-CN",
    "hi": "hi-IN",
    "ar": "ar-SA",
    "la": "la-XN",
    "it": "it-IT",
    "fr": "fr-FR",
    "de": "de-DE",
    "pt": "pt-PT",
}


def _is_rate_limit(err: BaseException) -> bool:
    low = str(err).lower()
    return (
        "too many requests" in low
        or "rate" in low
        or "429" in low
        or "5 requests per second" in low
    )


def make_translator(source: str, target: str, backend: str = "google"):
    """Build a deep_translator client for Google or MyMemory."""
    if backend == "mymemory":
        src = MYMEMORY_CODES.get(source, source if "-" in source else f"{source}-{source.upper()}")
        dst = MYMEMORY_CODES.get(target, target if "-" in target else target)
        # zh target key is "zh" → zh-CN already in map
        return MyMemoryTranslator(source=src, target=dst)
    g_target = {"zh": "zh-CN"}.get(target, target)
    return GoogleTranslator(source=source, target=g_target)

CAN_RE = re.compile(
    r"\b[Cc]ann?\.\s*\d+(?:\s*(?:,|et|–|-|y|and|und)\s*\d+)*",
)
SEC_RE = re.compile(r"§{1,2}\s*\d+")


def family_key(doc_id: str) -> str:
    """Strip trailing -ai and known locale suffix."""
    base = re.sub(r"-ai$", "", doc_id, flags=re.I)
    m = re.search(
        r"-(es|la|en|zh|hi|ar|it|fr|de|pt|el)$",
        base,
        flags=re.I,
    )
    if m:
        return base[: m.start()]
    return base


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


def postprocess(s: str) -> str:
    s = re.sub(r"(?i)\bcan\.\s*(\d)", r"Can. \1", s)
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r" *\n *", "\n", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


def _chunk_text(text: str, max_len: int = MAX_SINGLE_CHARS) -> list[str]:
    """Split long unit into sentence-ish chunks under max_len."""
    if len(text) <= max_len:
        return [text]
    chunks: list[str] = []
    rest = text
    while rest:
        if len(rest) <= max_len:
            chunks.append(rest)
            break
        # Prefer break at paragraph / sentence boundary
        window = rest[:max_len]
        br = max(window.rfind("\n\n"), window.rfind(". "), window.rfind("; "), window.rfind(" "))
        if br < max_len // 3:
            br = max_len
        chunks.append(rest[:br].strip())
        rest = rest[br:].strip()
    return [c for c in chunks if c]


def translate_text(
    translator,
    text: str,
    retries: int = 8,
    *,
    source_lang: str = "es",
    target_lang: str = "en",
    backend: str | None = None,
) -> str:
    """Translate text; auto-fallback Google → MyMemory on rate-limit."""
    global _PREFERRED_BACKEND
    backend = backend or _PREFERRED_BACKEND
    max_chars = MYMEMORY_MAX_CHARS if backend == "mymemory" else MAX_SINGLE_CHARS

    # Long units: translate piece by piece.
    pieces = _chunk_text(text, max_chars)
    if len(pieces) > 1:
        return postprocess(
            " ".join(
                translate_text(
                    translator,
                    p,
                    retries,
                    source_lang=source_lang,
                    target_lang=target_lang,
                    backend=backend,
                )
                for p in pieces
            )
        )

    protected, toks = protect(text)
    if len(protected) > max_chars:
        protected, toks = text, {}
        pieces = _chunk_text(protected, max_chars)
        if len(pieces) > 1:
            return postprocess(
                " ".join(
                    translate_text(
                        translator,
                        p,
                        retries,
                        source_lang=source_lang,
                        target_lang=target_lang,
                        backend=backend,
                    )
                    for p in pieces
                )
            )

    last_err: Exception | None = None
    active = translator
    for attempt in range(retries):
        try:
            raw = active.translate(protected)
            if not raw or not str(raw).strip():
                raise RuntimeError("empty translation")
            return postprocess(unprotect(str(raw), toks))
        except Exception as e:  # noqa: BLE001
            last_err = e
            err_s = str(e)
            # Immediate re-chunk if length error
            if "5000" in err_s or "500" in err_s or "length" in err_s.lower():
                pieces = _chunk_text(text, max(200, max_chars // 2))
                if len(pieces) > 1:
                    return postprocess(
                        " ".join(
                            translate_text(
                                active,
                                p,
                                retries,
                                source_lang=source_lang,
                                target_lang=target_lang,
                                backend=backend,
                            )
                            for p in pieces
                        )
                    )
            # Google rate-limit → switch session to MyMemory
            if backend == "google" and _is_rate_limit(e):
                print(
                    "  [i] Google rate-limit — switching session to MyMemory",
                    flush=True,
                )
                _PREFERRED_BACKEND = "mymemory"
                backend = "mymemory"
                max_chars = MYMEMORY_MAX_CHARS
                active = make_translator(source_lang, target_lang, "mymemory")
                # Re-chunk current text under MyMemory limit
                pieces = _chunk_text(text, max_chars)
                if len(pieces) > 1:
                    return postprocess(
                        " ".join(
                            translate_text(
                                active,
                                p,
                                retries,
                                source_lang=source_lang,
                                target_lang=target_lang,
                                backend="mymemory",
                            )
                            for p in pieces
                        )
                    )
                protected, toks = protect(text)
                if len(protected) > max_chars:
                    protected, toks = text, {}
                time.sleep(1)
                continue
            wait = min(60, 2**attempt) if backend == "mymemory" else min(180, 30 + 20 * attempt)
            print(
                f"  [retry {attempt+1}/{retries}] {type(e).__name__}: {err_s[:120]}; sleep {wait}s",
                flush=True,
            )
            time.sleep(wait)
    raise RuntimeError(f"translate failed after {retries}: {last_err}")


def unpack_batch(translated: str, n: int) -> list[str]:
    if n == 1:
        return [translated.strip()]
    parts = re.split(r"\n*\s*⟦U⟧\s*\n*", translated)
    if len(parts) != n:
        parts2 = re.split(r"\n{2,}", translated)
        if len(parts2) == n:
            parts = parts2
        else:
            while len(parts) < n:
                parts.append("")
            parts = parts[:n]
    return [p.strip() for p in parts]


def load_checkpoint(path: Path) -> dict:
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {"units": {}, "meta": {}}


def save_checkpoint(path: Path, cp: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(cp, ensure_ascii=False, indent=0) + "\n",
        encoding="utf-8",
    )


def write_outputs(
    units: list[dict], labeled: Path, content_out: Path
) -> None:
    labeled.parent.mkdir(parents=True, exist_ok=True)
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
    labeled.write_text(
        "\n\n".join(labeled_parts).strip() + "\n", encoding="utf-8"
    )
    content_out.write_text(
        json.dumps(content, ensure_ascii=False), encoding="utf-8"
    )
    print(f"[✓] wrote {labeled} ({len(units)} units)")
    print(f"[✓] wrote {content_out}")


def take_pending_batch(
    base_units: list[dict],
    start: int,
    cp: dict,
    force: bool,
) -> tuple[list[int], str, int]:
    """
    From `start`, skip done units; pack consecutive pending under MAX_BATCH_CHARS.
    Returns (indices, joined_text, next_index_after_batch).
    """
    i = start
    # Skip already translated
    while i < len(base_units):
        key = str(base_units[i]["consecutivo"])
        if not force and key in cp["units"]:
            i += 1
            continue
        break
    if i >= len(base_units):
        return [], "", i

    idxs: list[int] = []
    parts: list[str] = []
    total_c = 0
    j = i
    while j < len(base_units):
        key = str(base_units[j]["consecutivo"])
        if not force and key in cp["units"]:
            # Hit a done unit mid-stream: flush what we have
            break
        body = (base_units[j].get("contenido") or "").strip()
        add = len(body) + (len(UNIT_SEP) if parts else 0)
        if parts and total_c + add > MAX_BATCH_CHARS:
            break
        # Never put a long unit into a multi-unit batch (chunking is per-call).
        if len(body) > MAX_BATCH_CHARS:
            if parts:
                break
            parts.append(body)
            idxs.append(j)
            j += 1
            break
        parts.append(body)
        idxs.append(j)
        total_c += add
        j += 1
    return idxs, UNIT_SEP.join(parts), j


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Batch MT for locale twin packs (es → en/zh/hi/ar)"
    )
    ap.add_argument(
        "--base",
        required=True,
        help="Base corpus doc id (e.g. lg-es, cceo-es)",
    )
    ap.add_argument(
        "--locale",
        required=True,
        help="Target locale: en, zh, hi, ar, …",
    )
    ap.add_argument(
        "--source-lang",
        default="es",
        help="Google source language code (default es)",
    )
    ap.add_argument("--limit", type=int, default=0, help="Only first N units")
    ap.add_argument(
        "--resume",
        action="store_true",
        help="Resume from checkpoint (also auto if checkpoint exists)",
    )
    ap.add_argument(
        "--force-retranslate",
        action="store_true",
        help="Ignore checkpoint",
    )
    ap.add_argument(
        "--sleep",
        type=float,
        default=0.2,
        help="Delay between batch requests (seconds)",
    )
    ap.add_argument(
        "--out-dir",
        default=str(OUT_DIR),
        help="Output directory for labeled/content/checkpoint",
    )
    ap.add_argument(
        "--content",
        default="",
        help="Override path to base content.json",
    )
    ap.add_argument(
        "--no-batch",
        action="store_true",
        help="Translate one unit at a time (slower, safer)",
    )
    args = ap.parse_args()

    target = args.locale.lower().strip()
    base_id = args.base.strip()
    fam = family_key(base_id)

    content_path = (
        Path(args.content)
        if args.content
        else CORPUS_DOCS / base_id / "content.json"
    )
    if not content_path.exists():
        print(f"[!] missing base content: {content_path}", file=sys.stderr)
        return 1

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    checkpoint = out_dir / f"{fam}-{target}.translate.checkpoint.json"
    labeled = out_dir / f"{fam}-{target}.txt"
    content_out = out_dir / f"{fam}-{target}.content.json"

    base_units = json.loads(content_path.read_text(encoding="utf-8"))
    if args.limit and args.limit > 0:
        base_units = base_units[: args.limit]

    cp = (
        load_checkpoint(checkpoint)
        if (args.resume or checkpoint.exists()) and not args.force_retranslate
        else {"units": {}, "meta": {}}
    )
    if args.force_retranslate:
        cp = {"units": {}, "meta": {}}

    g_source = args.source_lang
    g_target = target
    # Mutable box so nested mt() can swap backends without free-var issues.
    client: dict = {
        "tr": make_translator(g_source, g_target, _PREFERRED_BACKEND),
    }

    total = len(base_units)
    print(
        f"[i] translating {total} units {base_id} ({g_source}→{g_target}) "
        f"family={fam} backend={_PREFERRED_BACKEND}",
        flush=True,
    )

    def mt(text: str) -> str:
        # Keep translator in sync if session switched backends mid-run
        if _PREFERRED_BACKEND == "mymemory" and not isinstance(
            client["tr"], MyMemoryTranslator
        ):
            client["tr"] = make_translator(g_source, g_target, "mymemory")
        return translate_text(
            client["tr"],
            text,
            source_lang=g_source,
            target_lang=g_target,
        )

    done_new = 0
    i = 0
    while i < len(base_units):
        if args.no_batch or _PREFERRED_BACKEND == "mymemory":
            # MyMemory: one unit (or small chunks inside mt) at a time
            key = str(base_units[i]["consecutivo"])
            if not args.force_retranslate and key in cp["units"]:
                i += 1
                continue
            body = (base_units[i].get("contenido") or "").strip()
            es = mt(body)
            cp["units"][key] = {
                "consecutivo": key,
                "contenido": es,
                "src_len": len(body),
                "dst_len": len(es),
            }
            done_new += 1
            i += 1
        else:
            idxs, batch_text, next_i = take_pending_batch(
                base_units, i, cp, args.force_retranslate
            )
            if not idxs:
                break
            translated = mt(batch_text)
            chunks = unpack_batch(translated, len(idxs))
            for unit_i, chunk in zip(idxs, chunks):
                k = str(base_units[unit_i]["consecutivo"])
                src = (base_units[unit_i].get("contenido") or "").strip()
                if not chunk and src:
                    chunk = mt(src)
                cp["units"][k] = {
                    "consecutivo": k,
                    "contenido": chunk,
                    "src_len": len(src),
                    "dst_len": len(chunk),
                }
                done_new += 1
            i = next_i

        if done_new % 20 == 0 or done_new == 1:
            save_checkpoint(checkpoint, cp)
            print(
                f"  progress new={done_new} checkpointed @ i≈{i}/{total} "
                f"backend={_PREFERRED_BACKEND}",
                flush=True,
            )
        time.sleep(args.sleep)

    save_checkpoint(checkpoint, cp)

    out_units: list[dict] = []
    missing = 0
    for u in base_units:
        key = str(u["consecutivo"])
        body = cp["units"].get(key, {}).get("contenido")
        if body is None:
            print(f"[!] missing translation for {key}", file=sys.stderr)
            body = ""
            missing += 1
        out_units.append(
            {
                "consecutivo": key,
                "contenido": body,
                "referencias": u.get("referencias") or [],
            }
        )

    write_outputs(out_units, labeled, content_out)
    print(f"[✓] done: {total} units, new_translations={done_new}, missing={missing}")
    print(
        f"[i] import with:\n"
        f"  npx ts-node --transpile-only import_locale_twin.ts "
        f"--base {base_id} --locale {target} --file {content_out}"
    )
    return 1 if missing else 0


if __name__ == "__main__":
    raise SystemExit(main())
