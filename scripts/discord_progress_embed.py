#!/usr/bin/env python3
"""Discord rich progress payload for IMPERIUM build notifications.

Pure functions — no network. Builds an Incoming Webhook body with Embeds
(status color, progress bar, stage checklist, footer/timestamp).

CLI (from notify-build.sh state dir):
  python3 scripts/discord_progress_embed.py /tmp/build-notify-<id>.d

Stdout: one JSON object suitable as the webhook body (content + embeds + username).
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence

# Discord embed colors (decimal)
COLOR_RUNNING = 0x5865F2  # Blurple
COLOR_SUCCESS = 0x57F287  # Green
COLOR_FAIL = 0xED4245  # Red
COLOR_SKIP = 0xFEE75C  # Yellow (aviso / omitido)
COLOR_IDLE = 0x99AAB5  # Grey

STATUS_RUNNING = "running"
STATUS_SUCCESS = "success"
STATUS_FAIL = "fail"
STATUS_SKIP = "skip"

# Wider bar looks better inside an embed code block
BAR_SLOTS = 20


def progress_bar(step: int, total: int, slots: int = BAR_SLOTS) -> tuple[str, int]:
    """Return (bar_string, percent). Uses full/empty block glyphs."""
    total = max(1, int(total))
    step = max(0, min(int(step), total))
    filled = (step * slots) // total
    pct = (step * 100) // total
    bar = "█" * filled + "░" * (slots - filled)
    return bar, pct


def format_elapsed(seconds: int | None) -> str:
    if seconds is None or seconds < 0:
        return "—"
    m, s = divmod(int(seconds), 60)
    h, m = divmod(m, 60)
    if h:
        return f"{h}h {m:02d}m {s:02d}s"
    return f"{m}m {s:02d}s"


def resolve_status(*, failed: bool, done: bool, skipped: bool = False) -> str:
    if failed:
        return STATUS_FAIL
    if skipped:
        return STATUS_SKIP
    if done:
        return STATUS_SUCCESS
    return STATUS_RUNNING


def status_meta(status: str) -> dict[str, Any]:
    if status == STATUS_SUCCESS:
        return {
            "color": COLOR_SUCCESS,
            "emoji": "✅",
            "label": "Completado",
            "title_prefix": "✅",
        }
    if status == STATUS_FAIL:
        return {
            "color": COLOR_FAIL,
            "emoji": "❌",
            "label": "Falló",
            "title_prefix": "❌",
        }
    if status == STATUS_SKIP:
        return {
            "color": COLOR_SKIP,
            "emoji": "⏭️",
            "label": "Omitido",
            "title_prefix": "⏭️",
        }
    return {
        "color": COLOR_RUNNING,
        "emoji": "🏗️",
        "label": "En curso",
        "title_prefix": "🏗️",
    }


def format_stages(
    stages: Sequence[Mapping[str, str]],
    *,
    current_elapsed: int | None = None,
) -> str:
    """Human-readable stage list for an embed field (max ~1024 chars)."""
    if not stages:
        return "_Sin etapas aún…_"
    lines: list[str] = []
    for st in stages:
        status = (st.get("status") or "pending").lower()
        label = (st.get("label") or "").strip() or "…"
        if status == "done":
            lines.append(f"✅ ~~{label}~~")
        elif status == "current":
            extra = ""
            if current_elapsed is not None and current_elapsed >= 0:
                extra = f" · ⏱ {format_elapsed(current_elapsed)}"
            lines.append(f"⏳ **{label}**…{extra}")
        elif status == "fail":
            lines.append(f"❌ **{label}**")
        elif status == "skip":
            lines.append(f"⏭️ ~~{label}~~")
        else:
            lines.append(f"⬜ {label}")
    text = "\n".join(lines)
    # Discord field value limit
    if len(text) > 1000:
        text = text[:997] + "…"
    return text


def clip_error_reason(text: str, *, max_chars: int = 900) -> str:
    """Trim failure detail for a Discord embed field (limit 1024 with fences)."""
    t = (text or "").replace("\r\n", "\n").replace("\r", "\n").strip()
    if not t:
        return ""
    if len(t) > max_chars:
        t = "…" + t[-(max_chars - 1) :]
    return t


def build_discord_message(
    *,
    title: str,
    subtitle: str = "",
    step: int = 0,
    total: int = 1,
    stages: Sequence[Mapping[str, str]] | None = None,
    status: str = STATUS_RUNNING,
    started_unix: int | None = None,
    run_started_unix: int | None = None,
    stage_started_unix: int | None = None,
    now_unix: int | None = None,
    run_id: str = "",
    error_reason: str = "",
) -> dict[str, Any]:
    """Build Incoming Webhook JSON body with rich embed(s).

    Timing:
      - run_started_unix: wall clock for the whole build (preferred for "⏱ Tiempo").
      - started_unix: legacy alias for run_started when run_started_unix is None.
      - stage_started_unix: wall clock for the *current* stage only (live ⏳ line).
    """
    stages = list(stages or [])
    meta = status_meta(status)
    bar, pct = progress_bar(step, total)
    now = now_unix if now_unix is not None else int(datetime.now(tz=timezone.utc).timestamp())
    # Global run duration (survives stage transitions).
    run_anchor = run_started_unix if run_started_unix is not None else started_unix
    elapsed = (now - run_anchor) if run_anchor is not None else None

    # Live elapsed for the current stage only while running.
    stage_anchor = stage_started_unix
    if stage_anchor is None and run_started_unix is None:
        # Legacy: only started_unix existed and meant "current stage" after first step.
        stage_anchor = started_unix
    current_elapsed = None
    if status == STATUS_RUNNING and stage_anchor is not None:
        current_elapsed = now - stage_anchor

    clean_title = (title or "Build").strip()
    clean_sub = (subtitle or "").strip()
    embed_title = f"{meta['title_prefix']} {clean_title}"
    if status == STATUS_SUCCESS:
        embed_title = f"{meta['title_prefix']} {clean_title} — listo"
    elif status == STATUS_FAIL:
        embed_title = f"{meta['title_prefix']} {clean_title} — falló"
    elif status == STATUS_SKIP:
        embed_title = f"{meta['title_prefix']} {clean_title} — omitido"

    # Visual progress block (code fence keeps mono spacing)
    progress_block = (
        f"```\n"
        f"{bar}  {pct}%\n"
        f"```\n"
        f"**{step} / {total}** pasos · **{meta['label']}**"
    )

    fields: list[dict[str, Any]] = [
        {
            "name": "📊 Progreso",
            "value": progress_block,
            "inline": False,
        },
        {
            "name": "📋 Etapas",
            "value": format_stages(stages, current_elapsed=current_elapsed),
            "inline": False,
        },
    ]
    err_clip = clip_error_reason(error_reason) if status == STATUS_FAIL else ""
    if err_clip:
        # Code fence helps monospaced TS/docker errors; field value max 1024.
        fields.append(
            {
                "name": "💥 Razón del error",
                "value": f"```\n{err_clip}\n```"[:1024],
                "inline": False,
            }
        )
    skip_clip = clip_error_reason(error_reason) if status == STATUS_SKIP and error_reason else ""
    if skip_clip:
        fields.append(
            {
                "name": "ℹ️ Aviso",
                "value": f"```\n{skip_clip}\n```"[:1024],
                "inline": False,
            }
        )
    if clean_sub:
        fields.append({"name": "🏷️ Versión / detalle", "value": clean_sub, "inline": True})
    fields.append(
        {
            "name": "⏱ Total",
            "value": format_elapsed(elapsed),
            "inline": True,
        }
    )
    fields.append(
        {
            "name": "📌 Estado",
            "value": f"{meta['emoji']} {meta['label']}",
            "inline": True,
        }
    )

    ts = datetime.fromtimestamp(now, tz=timezone.utc).isoformat().replace("+00:00", "Z")
    footer_bits = ["IMPERIUM Build"]
    if run_id:
        footer_bits.append(f"run {run_id[:24]}")
    footer_bits.append(f"{pct}%")

    description = (
        f"{meta['emoji']} Actualización de compilación en tiempo real.\n"
        f"La barra se **edita** en este mismo mensaje (no hay spam)."
    )
    if status == STATUS_FAIL and err_clip:
        first_line = err_clip.split("\n", 1)[0].strip()
        if first_line:
            description = f"{meta['emoji']} **Falló:** {first_line}"

    embed: dict[str, Any] = {
        "title": embed_title[:256],
        "description": description[:4096],
        "color": meta["color"],
        "fields": fields[:25],
        "footer": {"text": " · ".join(footer_bits)[:2048]},
        "timestamp": ts,
    }

    # Short content for mobile push / channel list preview (not embed-only silence)
    content = f"{meta['emoji']} **{clean_title}** · {pct}% · {meta['label']}"
    if clean_sub:
        content += f" · `{clean_sub}`"
    if status == STATUS_FAIL and err_clip:
        preview = err_clip.split("\n", 1)[0].strip()
        if preview:
            content += f"\n💥 {preview}"
    content = content[:2000]

    return {
        "username": "IMPERIUM Build",
        "content": content,
        "embeds": [embed],
        "allowed_mentions": {"parse": []},
        # Internal helpers for tests / n8n introspection (Discord ignores unknown? 
        # actually Discord rejects unknown top-level keys sometimes — strip extras in to_webhook_body)
        "_meta": {
            "status": status,
            "percent": pct,
            "color": meta["color"],
            "step": step,
            "total": total,
        },
    }


def to_webhook_body(message: Mapping[str, Any]) -> dict[str, Any]:
    """Strip internal keys; keep only Discord-accepted webhook fields."""
    allowed = {
        "content",
        "username",
        "avatar_url",
        "tts",
        "embeds",
        "allowed_mentions",
        "components",
        "files",
        "payload_json",
        "attachments",
        "flags",
        "thread_name",
        "applied_tags",
    }
    return {k: v for k, v in message.items() if k in allowed}


def parse_stages_file(text: str) -> list[dict[str, str]]:
    """Parse notify-build stages file lines: 'status label…'."""
    known = {"done", "current", "fail", "skip", "pending"}
    out: list[dict[str, str]] = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        parts = line.split(None, 1)
        status = parts[0] if parts else "pending"
        label = parts[1] if len(parts) > 1 else ""
        if status not in known:
            status = "pending"
            label = line
        out.append({"status": status, "label": label})
    return out


def from_state_dir(dir_path: str | Path) -> dict[str, Any]:
    """Load notify-build state directory and build Discord webhook body."""
    d = Path(dir_path)
    title = (d / "title").read_text(encoding="utf-8", errors="replace") if (d / "title").exists() else "Build"
    subtitle = (d / "subtitle").read_text(encoding="utf-8", errors="replace") if (d / "subtitle").exists() else ""
    try:
        step = int((d / "step").read_text(encoding="utf-8").strip() or "0")
    except Exception:
        step = 0
    try:
        total = int((d / "total").read_text(encoding="utf-8").strip() or "1")
    except Exception:
        total = 1
    stages_text = (d / "stages").read_text(encoding="utf-8", errors="replace") if (d / "stages").exists() else ""
    stages = parse_stages_file(stages_text)
    failed = (d / "failed").exists()
    done = (d / "done").exists()
    skipped = (d / "skipped").exists()
    error_reason = ""
    if (d / "error").exists():
        error_reason = (d / "error").read_text(encoding="utf-8", errors="replace")
    elif skipped and (d / "skip_reason").exists():
        error_reason = (d / "skip_reason").read_text(encoding="utf-8", errors="replace")
    def _read_epoch(name: str) -> int | None:
        p = d / name
        if not p.exists():
            return None
        try:
            return int(p.read_text(encoding="utf-8").strip())
        except Exception:
            return None

    # run_started = global; started = current stage (reset each notify_step).
    run_started_unix = _read_epoch("run_started")
    stage_started_unix = _read_epoch("started")
    # Backward compat: old state dirs only had "started" as global anchor.
    started_unix = run_started_unix if run_started_unix is not None else stage_started_unix
    run_id = d.name.replace("build-notify-", "").replace(".d", "")
    status = resolve_status(failed=failed, done=done, skipped=skipped)
    msg = build_discord_message(
        title=title,
        subtitle=subtitle,
        step=step,
        total=total,
        stages=stages,
        status=status,
        started_unix=started_unix,
        run_started_unix=run_started_unix,
        stage_started_unix=stage_started_unix if run_started_unix is not None else None,
        run_id=run_id,
        error_reason=error_reason,
    )
    return to_webhook_body(msg)


def main(argv: Sequence[str] | None = None) -> int:
    argv = list(argv if argv is not None else sys.argv[1:])
    if not argv:
        print("usage: discord_progress_embed.py <state_dir>", file=sys.stderr)
        return 2
    body = from_state_dir(argv[0])
    json.dump(body, sys.stdout, ensure_ascii=False, separators=(",", ":"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
