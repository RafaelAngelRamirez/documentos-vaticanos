#!/usr/bin/env bash
# Notificaciones de progreso de build a Telegram (y Discord) vía un webhook de n8n.
#
# Sourceable desde los scripts de build (docker-compilar.sh, build.sh,
# generate-release.sh). En lugar de mandar un mensaje por etapa, EDITA un único
# mensaje de Telegram (y otro de Discord) simulando una barra de progreso con el
# avance de cada etapa (✅ hecho / ⏳ actual / ❌ falló).
#
# Diseño:
#   - El primer script en arrancar genera BUILD_RUN_ID y lo exporta; los scripts
#     anidados lo heredan y contribuyen a LA MISMA barra (un solo mensaje por
#     destino: Telegram + Discord).
#   - El estado (message_id, discord_message_id, paso, etapas) vive en un
#     directorio temporal compartido por run_id, con flock para mutaciones
#     atómicas entre procesos.
#   - n8n es un relevo tonto: Telegram send/edit + Discord create/edit (si el
#     servidor tiene DISCORD_BUILD_WEBHOOK_URL o bot token configurado).
#
# Robustez: todas las funciones públicas son no-op si BUILD_NOTIFY_WEBHOOK está
# vacío o el webhook no responde, y NUNCA abortan el build (devuelven 0 siempre,
# se aíslan en un subshell con `set +ex` para convivir con `set -e`/`set -x`).
# Discord ausente o fallido NO rompe Telegram ni el build.
#
# Override del destino:  export BUILD_NOTIFY_WEBHOOK="https://.../webhook/build-progress"
# Desactivar del todo:   export BUILD_NOTIFY_WEBHOOK=""

: "${BUILD_NOTIFY_WEBHOOK:=https://nochon.codice-progressio.online/webhook/build-progress}"

__nb_dir() { printf '/tmp/build-notify-%s.d' "${BUILD_RUN_ID:-}"; }

# Barra de texto plano. Args: step total
__nb_bar() {
    local step=$1 total=$2 slots=12 i filled pct bar=""
    [ "$total" -lt 1 ] && total=1
    [ "$step" -gt "$total" ] && step=$total
    [ "$step" -lt 0 ] && step=0
    filled=$(( step * slots / total ))
    pct=$(( step * 100 / total ))
    for ((i = 0; i < slots; i++)); do
        if [ "$i" -lt "$filled" ]; then bar="${bar}█"; else bar="${bar}░"; fi
    done
    printf '[%s] %d%% · %d/%d' "$bar" "$pct" "$step" "$total"
}

# Ruta al builder de embeds Discord (junto a este script).
__nb_discord_embed_py() {
    local here
    here="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"
    printf '%s/discord_progress_embed.py' "$here"
}

# Payload rico para Discord (embeds). Vacío si no hay python/estado.
__nb_discord_payload() {
    local dir py
    dir="$(__nb_dir)"
    py="$(__nb_discord_embed_py)"
    command -v python3 >/dev/null 2>&1 || return 0
    [ -f "$py" ] || return 0
    [ -d "$dir" ] || return 0
    python3 "$py" "$dir" 2>/dev/null || true
}

# Construye el cuerpo JSON {text, message_id, discord_message_id, discord?}.
# Args: text message_id discord_message_id [discord_json]
# discord_json opcional: objeto webhook (content+embeds) para Discord.
__nb_json() {
    local text="$1" mid="$2" dmid="$3" discord_json="${4:-}"
    if command -v python3 >/dev/null 2>&1; then
        text="$text" mid="$mid" dmid="$dmid" discord_json="$discord_json" python3 -c '
import os, json
payload = {
    "text": os.environ.get("text", ""),
    "message_id": os.environ.get("mid", ""),
    "discord_message_id": os.environ.get("dmid", ""),
}
raw = os.environ.get("discord_json") or ""
if raw.strip():
    try:
        payload["discord"] = json.loads(raw)
    except Exception:
        pass
print(json.dumps(payload, ensure_ascii=False))
'
    elif command -v jq >/dev/null 2>&1; then
        if [ -n "$discord_json" ]; then
            jq -n --arg t "$text" --arg m "$mid" --arg d "$dmid" --argjson disc "$discord_json" \
                '{text:$t,message_id:$m,discord_message_id:$d,discord:$disc}'
        else
            jq -n --arg t "$text" --arg m "$mid" --arg d "$dmid" \
                '{text:$t,message_id:$m,discord_message_id:$d}'
        fi
    else
        local esc=${text//\\/\\\\}; esc=${esc//\"/\\\"}; esc=${esc//$'\n'/\\n}
        printf '{"text":"%s","message_id":"%s","discord_message_id":"%s"}' "$esc" "$mid" "$dmid"
    fi
}

# Extrae un campo id de la respuesta del webhook (en cualquier nivel).
# Args: response_json field_name
__nb_parse_field() {
    local resp="$1" field="$2"
    if command -v python3 >/dev/null 2>&1; then
        resp="$resp" field="$field" python3 -c '
import os,json,re
r=os.environ["resp"]
field=os.environ["field"]
def find(o):
    if isinstance(o,dict):
        v=o.get(field)
        if isinstance(v,(int,str)) and str(v).strip() and str(v).strip().lower() not in ("none","null"):
            return str(v).strip()
        for x in o.values():
            f=find(x)
            if f: return f
    elif isinstance(o,list):
        for x in o:
            f=find(x)
            if f: return f
    return ""
try:
    print(find(json.loads(r)))
except Exception:
    m=re.search(r"\"" + re.escape(field) + r"\"\s*:\s*\"?([0-9A-Za-z_-]+)\"?", r)
    print(m.group(1) if m else "")
'
    else
        printf '%s' "$resp" | grep -oE "\"${field}\"[: ]*\"?[0-9A-Za-z_-]+" | grep -oE '[0-9A-Za-z_-]+$' | head -1
    fi
}

# Compat: message_id de Telegram (mismo contrato histórico).
__nb_parse_mid() {
    __nb_parse_field "$1" "message_id"
}

__nb_parse_discord_mid() {
    __nb_parse_field "$1" "discord_message_id"
}

__nb_post() {
    command -v curl >/dev/null 2>&1 || return 1
    # Write body to a temp file and use --data-binary @file so shell/quoting
    # never mangles UTF-8 embeds (emoji, backticks) on the wire.
    # 15s: dual Telegram+Discord embeds can exceed 8s under load on the n8n host.
    local body="$1" tmp
    tmp="$(mktemp 2>/dev/null || printf '/tmp/nb-post.%s.json' "$$")"
    printf '%s' "$body" >"$tmp" 2>/dev/null || { rm -f "$tmp" 2>/dev/null; return 1; }
    curl -s --max-time 15 -X POST "$BUILD_NOTIFY_WEBHOOK" \
        -H 'Content-Type: application/json; charset=utf-8' \
        --data-binary @"$tmp" 2>/dev/null
    local rc=$?
    rm -f "$tmp" 2>/dev/null || true
    return "$rc"
}

# Escapa caracteres que Telegram Markdown rompe si el nodo n8n trae parse_mode.
# Discord usa el payload `discord` (embeds) y no depende de este escape.
__nb_telegram_safe() {
    # Plain text for Telegram when parse_mode is HTML (escape <>& only).
    # Discord does not use this string for embeds.
    local s="$1"
    if command -v python3 >/dev/null 2>&1; then
        printf '%s' "$s" | python3 -c 'import sys; t=sys.stdin.read(); print(t.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;"), end="")'
    else
        s="${s//&/&amp;}"
        s="${s//</&lt;}"
        s="${s//>/&gt;}"
        printf '%s' "$s"
    fi
}

# Recorta texto de error para que quepa en Telegram (~4096) / Discord fields.
# Args: text [max_lines=35] [max_chars=1800]
__nb_clip_text() {
    local text="$1" max_lines="${2:-35}" max_chars="${3:-1800}"
    if [ -z "$text" ]; then
        return 0
    fi
    if command -v python3 >/dev/null 2>&1; then
        text="$text" max_lines="$max_lines" max_chars="$max_chars" python3 -c '
import os
t = os.environ.get("text", "").replace("\r\n", "\n").replace("\r", "\n").strip()
if not t:
    raise SystemExit
max_lines = int(os.environ.get("max_lines") or "35")
max_chars = int(os.environ.get("max_chars") or "1800")
lines = t.split("\n")
if len(lines) > max_lines:
    t = "…\n" + "\n".join(lines[-max_lines:])
if len(t) > max_chars:
    t = "…" + t[-(max_chars - 1):]
print(t, end="")
' 2>/dev/null || true
    else
        printf '%s' "$text" | tail -n "$max_lines"
    fi
}

# Últimas líneas del log de la etapa actual (stage.log) o del consola global.
__nb_log_tail() {
    local dir f
    dir="$(__nb_dir)"
    for f in "$dir/stage.log" "$dir/console.log"; do
        if [ -s "$f" ]; then
            __nb_clip_text "$(tail -n 40 "$f" 2>/dev/null || true)" 30 1600
            return 0
        fi
    done
    return 0
}

# Combina razón explícita (trap: exit+comando) con la cola del log de la etapa.
# Args: [explicit_reason]
__nb_compose_fail_reason() {
    local explicit="${1:-}" tail_txt
    tail_txt="$(__nb_log_tail)"
    if [ -n "$explicit" ] && [ -n "$tail_txt" ]; then
        printf '%s\n\n--- log ---\n%s' "$explicit" "$tail_txt"
    elif [ -n "$explicit" ]; then
        printf '%s' "$explicit"
    elif [ -n "$tail_txt" ]; then
        printf '%s' "$tail_txt"
    else
        printf '%s' "(sin detalle de error; revisa el log del job en n8n/CI)"
    fi
}

# Formatea segundos como "3m20s" o "1h 05m 03s". Args: seconds
__nb_fmt_duration() {
    local d="$1" h m s
    case "$d" in ''|*[!0-9]*) return 0 ;; esac
    h=$((d / 3600))
    m=$(( (d % 3600) / 60 ))
    s=$((d % 60))
    if [ "$h" -gt 0 ]; then
        printf '%dh %02dm %02ds' "$h" "$m" "$s"
    else
        printf '%dm%02ds' "$m" "$s"
    fi
}

# Segundos desde un archivo de marca de tiempo (epoch). Vacío si no hay.
# Args: path
__nb_seconds_since() {
    local f="$1" s now d
    [ -f "$f" ] || return 0
    s="$(cat "$f" 2>/dev/null || echo 0)"
    now="$(date +%s 2>/dev/null || echo 0)"
    case "$s$now" in *[!0-9]*) return 0 ;; esac
    d=$((now - s))
    [ "$d" -ge 0 ] || return 0
    printf '%s' "$d"
}

# Compone el texto completo del mensaje desde el estado en disco.
__nb_render() {

    local dir; dir="$(__nb_dir)"
    local title subtitle step total head bar out status label line err total_line
    title="$(cat "$dir/title" 2>/dev/null)"
    subtitle="$(cat "$dir/subtitle" 2>/dev/null)"
    step="$(cat "$dir/step" 2>/dev/null || echo 0)"
    total="$(cat "$dir/total" 2>/dev/null || echo 1)"
    if   [ -f "$dir/failed" ]; then head="❌ ${title} — falló"
    elif [ -f "$dir/skipped" ]; then head="⏭️ ${title} — omitido"
    elif [ -f "$dir/done" ];   then head="✅ ${title} — listo 🎉"
    else                            head="🏗️ ${title}"; fi
    [ -n "$subtitle" ] && head="${head}   ${subtitle}"
    bar="$(__nb_bar "$step" "$total")"
    out="${head}"$'\n'"${bar}"
    # Tiempo global del run (se conserva; no se resetea al cambiar de etapa).
    total_line="$(__nb_elapsed_total)"
    [ -n "$total_line" ] && out="${out}"$'\n'"${total_line}"
    if [ -s "$dir/stages" ]; then
        out="${out}"$'\n'
        while IFS= read -r line; do
            status="${line%% *}"; label="${line#* }"
            case "$status" in
                done)    out="${out}"$'\n'"✅ ${label}" ;;
                current) out="${out}"$'\n'"⏳ ${label}…$(__nb_elapsed)" ;;
                fail)    out="${out}"$'\n'"❌ ${label}" ;;
                skip)    out="${out}"$'\n'"⏭️ ${label}" ;;
                *)       out="${out}"$'\n'"⬜ ${label}" ;;
            esac
        done < "$dir/stages"
    fi
    # Al fallar, anexar la razón (comando + cola del log de la etapa).
    if [ -f "$dir/failed" ] && [ -s "$dir/error" ]; then
        err="$(cat "$dir/error" 2>/dev/null || true)"
        if [ -n "$err" ]; then
            out="${out}"$'\n'$'\n'"💥 Razón del error:"$'\n'"${err}"
        fi
    fi
    # Aviso de omitido (p.ej. release sin commits liberables): no es error.
    if [ -f "$dir/skipped" ] && [ -s "$dir/skip_reason" ]; then
        err="$(cat "$dir/skip_reason" 2>/dev/null || true)"
        if [ -n "$err" ]; then
            out="${out}"$'\n'$'\n'"ℹ️ Aviso:"$'\n'"${err}"
        fi
    fi
    # Telegram recibe texto "seguro"; Discord no usa este string para el body rico.
    __nb_telegram_safe "$out"
}

# Cronómetro de la etapa actual (" · ⏱ 3m20s"); vacío si no hay marca de inicio.
# Usa $dir/started (se reinicia en cada notify_step).
__nb_elapsed() {
    local dir d fmt
    dir="$(__nb_dir)"
    d="$(__nb_seconds_since "$dir/started")"
    [ -n "$d" ] || return 0
    fmt="$(__nb_fmt_duration "$d")"
    [ -n "$fmt" ] || return 0
    printf ' · ⏱ %s' "$fmt"
}

# Cronómetro global del run ("⏱ total 12m34s"). Prefer run_started; fallback a started
# por compatibilidad con runs viejos que solo tenían started.
__nb_elapsed_total() {
    local dir d fmt
    dir="$(__nb_dir)"
    if [ -f "$dir/run_started" ]; then
        d="$(__nb_seconds_since "$dir/run_started")"
    else
        d="$(__nb_seconds_since "$dir/started")"
    fi
    [ -n "$d" ] || return 0
    fmt="$(__nb_fmt_duration "$d")"
    [ -n "$fmt" ] || return 0
    printf '⏱ total %s' "$fmt"
}

# Cierra la etapa "current" marcándola con status (done|fail|skip) y congela su
# duración en el label, para que no se pierda al avanzar. Args: done|fail|skip
__nb_close_current() {
    local dir status="$1" tmp line st lbl elapsed
    dir="$(__nb_dir)"
    [ -f "$dir/stages" ] || return 0
    case "$status" in done|fail|skip) ;; *) status=done ;; esac
    elapsed="$(__nb_elapsed)"
    tmp="$dir/stages.tmp.$$"
    while IFS= read -r line || [ -n "${line:-}" ]; do
        [ -n "$line" ] || continue
        st="${line%% *}"
        lbl="${line#* }"
        if [ "$st" = "current" ]; then
            printf '%s %s%s\n' "$status" "$lbl" "$elapsed"
        else
            printf '%s\n' "$line"
        fi
    done < "$dir/stages" > "$tmp" && mv "$tmp" "$dir/stages"
}

# Discord id a enviar: "skip" si ya se desactivó; id guardado; o vacío (crear).
__nb_discord_mid_for_post() {
    local dir; dir="$(__nb_dir)"
    if [ -f "$dir/discord_disabled" ]; then
        printf 'skip'
        return 0
    fi
    cat "$dir/discord_message_id" 2>/dev/null || echo ""
}

# Renderiza y envía/edita el mensaje. Captura message_id (Telegram) y
# discord_message_id en el primer envío de cada destino.
# Telegram recibe `text` plano; Discord recibe `discord` (embeds) si se pudo generar.
__nb_send() {
    local dir; dir="$(__nb_dir)"
    [ -f "$dir/disabled" ] && return 0
    local text mid dmid disc resp newmid newdmid
    text="$(__nb_render)"
    mid="$(cat "$dir/message_id" 2>/dev/null || echo "")"
    dmid="$(__nb_discord_mid_for_post)"
    disc="$(__nb_discord_payload)"
    resp="$(__nb_post "$(__nb_json "$text" "$mid" "$dmid" "$disc")")"

    # Telegram: el primer envío debe devolver message_id o desactivamos todo el
    # notify (mismo comportamiento histórico — el build no depende de notificaciones).
    if [ -z "$mid" ]; then
        newmid="$(__nb_parse_mid "$resp")"
        if [ -n "$newmid" ]; then
            printf '%s' "$newmid" > "$dir/message_id"
        else
            touch "$dir/disabled"
            return 0
        fi
    fi

    # Discord: opcional. Si el relevo no devuelve id en el primer create, no
    # reintentamos en cada paso (evita flood de mensajes nuevos).
    if [ ! -f "$dir/discord_disabled" ]; then
        if [ ! -s "$dir/discord_message_id" ]; then
            newdmid="$(__nb_parse_discord_mid "$resp")"
            if [ -n "$newdmid" ] && [ "$newdmid" != "skip" ]; then
                printf '%s' "$newdmid" > "$dir/discord_message_id"
            else
                # Respuesta con discord_skipped / sin id → no insistir.
                touch "$dir/discord_disabled"
            fi
        fi
    fi
    return 0
}

# ---- Implementaciones (corren en subshell aislado) -------------------------

# Latido: reedita el mensaje cada N s (BUILD_NOTIFY_HEARTBEAT, def. 2) para que
# el cronómetro de la etapa avance y nunca se quede mudo en pasos largos.
__nb_heartbeat_loop() {
    local dir="$1" iv="${BUILD_NOTIFY_HEARTBEAT:-2}"
    while :; do
        sleep "$iv" || break
        [ -d "$dir" ] || break
        [ -f "$dir/done" ] && break
        [ -f "$dir/failed" ] && break
        [ -f "$dir/skipped" ] && break
        [ -f "$dir/disabled" ] && break
        __nb_send
    done
}

__nb_heartbeat_stop() {
    local dir; dir="$(__nb_dir)"
    [ -f "$dir/tick.pid" ] || return 0
    kill "$(cat "$dir/tick.pid" 2>/dev/null)" 2>/dev/null || true
    rm -f "$dir/tick.pid" 2>/dev/null || true
}

__nb_init_impl() {
    local dir; dir="$(__nb_dir)"
    mkdir -p "$dir" || return 0
    printf '%s' "${1:-Build}" > "$dir/title"
    printf '%s' "${3:-}"      > "$dir/subtitle"
    printf '%s' "${2:-1}"     > "$dir/total"
    printf '0'                > "$dir/step"
    : > "$dir/stages"
    # run_started: reloj global del build (nunca se resetea).
    # started: reloj de la etapa actual (se reinicia en cada notify_step).
    date +%s > "$dir/run_started" 2>/dev/null || true
    date +%s > "$dir/started" 2>/dev/null || true
    # Optional: reuse an existing Telegram/Discord message (n8n "Build iniciado")
    # so the progress bar EDITs that message instead of creating a second one.
    # Set BUILD_NOTIFY_SEED_MESSAGE_ID / BUILD_NOTIFY_SEED_DISCORD_MESSAGE_ID.
    if [ -n "${BUILD_NOTIFY_SEED_MESSAGE_ID:-}" ] && [ ! -s "$dir/message_id" ]; then
        printf '%s' "$BUILD_NOTIFY_SEED_MESSAGE_ID" > "$dir/message_id"
    fi
    if [ -n "${BUILD_NOTIFY_SEED_DISCORD_MESSAGE_ID:-}" ] && [ ! -s "$dir/discord_message_id" ]; then
        printf '%s' "$BUILD_NOTIFY_SEED_DISCORD_MESSAGE_ID" > "$dir/discord_message_id"
    fi
    __nb_send
    # Arranca el latido solo si el primer envío funcionó (mensaje capturado).
    if [ ! -f "$dir/disabled" ] && [ -s "$dir/message_id" ] && [ ! -f "$dir/tick.pid" ]; then
        ( __nb_heartbeat_loop "$dir" ) >/dev/null 2>&1 &
        echo $! > "$dir/tick.pid" 2>/dev/null || true
    fi
}

__nb_step_impl() {
    local dir label step
    dir="$(__nb_dir)"; label="$1"
    {
        flock 9
        # Congela duración de la etapa que termina; no toca run_started.
        __nb_close_current done
        printf 'current %s\n' "$label" >> "$dir/stages"
        step=$(( $(cat "$dir/step" 2>/dev/null || echo 0) + 1 ))
        printf '%s' "$step" > "$dir/step"
        date +%s > "$dir/started" 2>/dev/null || true
    } 9>"$dir/lock"
    __nb_send
}

__nb_done_impl() {
    local dir; dir="$(__nb_dir)"
    {
        flock 9
        __nb_close_current done
        cat "$dir/total" > "$dir/step" 2>/dev/null
        touch "$dir/done"
    } 9>"$dir/lock"
    __nb_heartbeat_stop
    __nb_send
}

__nb_fail_impl() {
    local dir label reason
    dir="$(__nb_dir)"; label="${1:-}"; reason="${2:-}"
    [ -f "$dir/failed" ] && return 0   # ya marcado (evita doble fallo padre/hijo)
    reason="$(__nb_compose_fail_reason "$reason")"
    {
        flock 9
        if grep -q '^current ' "$dir/stages" 2>/dev/null; then
            __nb_close_current fail
        elif [ -n "$label" ]; then
            printf 'fail %s\n' "$label" >> "$dir/stages"
        fi
        # Persistir razón para Telegram (__nb_render) y Discord (from_state_dir).
        printf '%s' "$reason" > "$dir/error"
        touch "$dir/failed"
    } 9>"$dir/lock"
    __nb_heartbeat_stop
    __nb_send
}

# Aviso (no error): omite el resto del pipeline (p.ej. nada que liberar).
# Cierra la etapa actual como "skip", marca done+skipped, opcional razón.
__nb_skip_impl() {
    local dir label reason
    dir="$(__nb_dir)"; label="${1:-}"; reason="${2:-}"
    [ -f "$dir/failed" ] && return 0
    [ -f "$dir/skipped" ] && return 0
    {
        flock 9
        if grep -q '^current ' "$dir/stages" 2>/dev/null; then
            __nb_close_current skip
        elif [ -n "$label" ]; then
            printf 'skip %s\n' "$label" >> "$dir/stages"
        fi
        if [ -n "$reason" ]; then
            printf '%s' "$reason" > "$dir/skip_reason"
        fi
        # done: el run terminó bien (no reintentar como fallo). skipped: UI de aviso.
        touch "$dir/skipped"
        touch "$dir/done"
        cat "$dir/total" > "$dir/step" 2>/dev/null || true
    } 9>"$dir/lock"
    __nb_heartbeat_stop
    __nb_send
}

# ---- API pública -----------------------------------------------------------

# notify_init "<title>" <total> ["<subtitle>"]
# Inicia la barra. Si ya hay un run heredado (BUILD_RUN_ID + dir), no hace nada.
notify_init() {
    [ -n "$BUILD_NOTIFY_WEBHOOK" ] || return 0
    if [ -n "${BUILD_RUN_ID:-}" ] && [ -d "/tmp/build-notify-${BUILD_RUN_ID:-}.d" ]; then
        return 0
    fi
    if [ -z "${BUILD_RUN_ID:-}" ]; then
        BUILD_RUN_ID="$(date +%s 2>/dev/null)-$$" || BUILD_RUN_ID="run-$$"
        export BUILD_RUN_ID
    fi
    ( set +exu; __nb_init_impl "$@" ) >/dev/null 2>&1 || true
    return 0
}

# notify_step "<label>"  — avanza un paso y marca la etapa como actual.
notify_step() {
    [ -n "$BUILD_NOTIFY_WEBHOOK" ] || return 0
    [ -n "${BUILD_RUN_ID:-}" ] && [ -d "/tmp/build-notify-${BUILD_RUN_ID:-}.d" ] || return 0
    ( set +exu; __nb_step_impl "$@" ) >/dev/null 2>&1 || true
    return 0
}

# notify_done  — marca todo hecho (barra al 100%).
notify_done() {
    [ -n "$BUILD_NOTIFY_WEBHOOK" ] || return 0
    [ -n "${BUILD_RUN_ID:-}" ] && [ -d "/tmp/build-notify-${BUILD_RUN_ID:-}.d" ] || return 0
    ( set +exu; __nb_done_impl ) >/dev/null 2>&1 || true
    return 0
}

# notify_fail ["<label>"] ["<reason>"]
# Marca la etapa actual como fallida y publica la razón (trap ERR o llamada
# explícita). Si reason va vacío, intenta rellenar con la cola de stage.log.
# Uso típico desde trap:
#   trap 'ec=$?; notify_fail "${CURRENT_STAGE:-build}" "exit ${ec} · ${BASH_COMMAND}"' ERR
notify_fail() {
    [ -n "$BUILD_NOTIFY_WEBHOOK" ] || return 0
    [ -n "${BUILD_RUN_ID:-}" ] && [ -d "/tmp/build-notify-${BUILD_RUN_ID:-}.d" ] || return 0
    ( set +exu; __nb_fail_impl "$@" ) >/dev/null 2>&1 || true
    return 0
}

# notify_skip ["<label>"] ["<reason>"]
# Cierra el run como omitido (aviso, no ❌). Uso: nada que liberar (release-guard 78).
notify_skip() {
    [ -n "$BUILD_NOTIFY_WEBHOOK" ] || return 0
    [ -n "${BUILD_RUN_ID:-}" ] && [ -d "/tmp/build-notify-${BUILD_RUN_ID:-}.d" ] || return 0
    ( set +exu; __nb_skip_impl "$@" ) >/dev/null 2>&1 || true
    return 0
}

# notify_stage_log
# Trunca y devuelve la ruta de stage.log del run actual (o /dev/null si no hay
# barra activa). Útil para redirigir/tee el output de una etapa antes de un
# comando que puede fallar.
notify_stage_log() {
    local dir log
    dir="$(__nb_dir)"
    if [ -z "${BUILD_RUN_ID:-}" ] || [ ! -d "$dir" ]; then
        printf '%s' "/dev/null"
        return 0
    fi
    log="$dir/stage.log"
    : > "$log" 2>/dev/null || true
    printf '%s' "$log"
    return 0
}

# notify_exec <cmd> [args...]
# Ejecuta el comando teando stdout+stderr a stage.log (sobrescrito). Devuelve
# el exit code del comando (no del tee). Con set -e / trap ERR, un fallo dispara
# notify_fail y la cola del log se adjunta como razón del error.
#
# Bajo `set -e` + `pipefail` (p.ej. release-build.sh) un pipeline fallido aborta
# antes de leer PIPESTATUS: desactivamos errexit solo alrededor del pipeline y
# restauramos el estado del caller.
notify_exec() {
    local log rc=0 had_e=0
    if [ "$#" -lt 1 ]; then
        return 2
    fi
    log="$(notify_stage_log)"
    if [ -n "$log" ] && [ "$log" != "/dev/null" ]; then
        case $- in *e*) had_e=1; set +e ;; esac
        "$@" 2>&1 | tee -a "$log"
        rc=${PIPESTATUS[0]}
        [ "$had_e" -eq 1 ] && set -e
        return "$rc"
    fi
    "$@"
}
