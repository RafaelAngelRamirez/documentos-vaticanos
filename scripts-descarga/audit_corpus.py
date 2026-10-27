#!/usr/bin/env python3

from __future__ import annotations

import argparse
import hashlib
import html as html_lib
import json
import os
import re
import sys
import tempfile
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
DEFAULT_CORPUS = REPO / "documentos" / "corpus"

MOJI = re.compile(r"Ã.|â€.|ï¿½|\ufffd|Â[^\wÀ-ÿ]")
FTN_MARK = re.compile(r"\[_ftn\d+\]", re.I)
WS = re.compile(r"\s+")
P_NUM = re.compile(r"<p\b[^>]*>\s*(\d{1,4})\.", re.I)
FTN_HTML = re.compile(r"id=[\"']_ftn\d+|href=[\"']#_ftn\d+", re.I)
TAG = re.compile(r"(?is)<(script|style)\b.*?>.*?</\1>")
TAGS = re.compile(r"<[^>]+>")
INT_CONSEC = re.compile(r"\d+")
ES_WORD = re.compile(r"\b(que|de|la|el|los|las|del|en|por|con|una|su|se|no|al)\b", re.I)
EN_WORD = re.compile(r"\b(the|and|of|to|for|that|with|from|this)\b", re.I)
ARABIC = re.compile(r"[\u0600-\u06ff]")
CJK = re.compile(r"[\u4e00-\u9fff]")
DEVA = re.compile(r"[\u0900-\u097f]")
LATIN = re.compile(r"[A-Za-zÁÉÍÓÚáéíóúÑñÜü]")


def load_json(path: Path):
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def units_of(payload):
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in ("units", "articulos", "content"):
            if isinstance(payload.get(key), list):
                return payload[key]
    return []


def norm(text: str) -> str:
    return WS.sub(" ", (text or "").replace("\u00a0", " ")).strip()


def fold(text: str) -> str:
    return norm(text).lower()


class Finding:
    def __init__(self, kind: str, document_id: str, location: str, evidence: str, confidence: str):
        self.kind = kind
        self.document_id = document_id
        self.location = location
        self.evidence = evidence
        self.confidence = confidence

    def as_dict(self) -> dict:
        return {
            "kind": self.kind,
            "documentId": self.document_id,
            "location": self.location,
            "evidence": self.evidence,
            "confidence": self.confidence,
        }


def snippet(text: str, match: re.Match | None = None, limit: int = 90) -> str:
    raw = norm(text)
    if match is None:
        return raw[:limit]
    start = max(0, match.start() - 24)
    end = min(len(text), match.end() + 24)
    return norm(text[start:end])[:limit]


def script_counts(text: str) -> dict[str, int]:
    return {
        "latin": len(LATIN.findall(text)),
        "arabic": len(ARABIC.findall(text)),
        "cjk": len(CJK.findall(text)),
        "deva": len(DEVA.findall(text)),
    }


def expected_script(locale: str) -> str:
    if locale == "ar":
        return "arabic"
    if locale == "zh":
        return "cjk"
    if locale == "hi":
        return "deva"
    return "latin"


def numbering_findings(doc_id: str, units: list, kind: str = "") -> list[Finding]:
    ints = []
    for index, unit in enumerate(units):
        raw = str(unit.get("consecutivo") or "").strip()
        if INT_CONSEC.fullmatch(raw):
            ints.append((int(raw), index, raw))
    if len(ints) < 8 or len(ints) / max(len(units), 1) < 0.7:
        return []
    counts = Counter(number for number, _, _ in ints)
    findings = []
    dups = sorted(number for number, count in counts.items() if count > 1)
    if dups:
        shown = ", ".join(str(number) for number in dups[:12])
        findings.append(
            Finding(
                "numbering",
                doc_id,
                f"consecutivo repetido, {len(dups)} números",
                shown,
                "dudoso" if kind == "council" else "alta",
            )
        )
    present = set(counts)
    start, end = min(present), max(present)
    if start > 5:
        return findings
    missing = [number for number in range(start, end + 1) if number not in present]
    span = end - start + 1
    if not missing or span <= 0:
        return findings
    ratio = len(missing) / span
    confidence = "alta" if ratio <= 0.15 else "dudoso"
    if len(missing) == 1:
        confidence = "dudoso"
    if ratio > 0.4:
        return findings
    shown = ", ".join(str(number) for number in missing[:20])
    extra = "" if len(missing) <= 20 else f" y {len(missing) - 20} más"
    findings.append(
        Finding(
            "numbering",
            doc_id,
            f"huecos entre {start} y {end}",
            f"faltan {len(missing)} números: {shown}{extra}",
            confidence,
        )
    )
    return findings


def local_doc_findings(meta: dict, units: list, text_hash: str, hashes: dict[str, list[str]]) -> list[Finding]:
    doc_id = meta["id"]
    findings = []
    declared = meta.get("unitCount")
    if isinstance(declared, int) and declared != len(units):
        findings.append(
            Finding(
                "truncated",
                doc_id,
                "manifest.unitCount",
                f"el manifest dice {declared} unidades y content.json tiene {len(units)}",
                "alta",
            )
        )
    empty = 0
    empty_unlabeled = 0
    empty_verse0 = 0
    missing_label = 0
    moji_count = 0
    moji_where = ""
    ftn_count = 0
    ftn_where = ""
    ref_count = 0
    en_units = 0
    long_units = 0
    letters = Counter()
    parts = []
    for index, unit in enumerate(units):
        if not isinstance(unit, dict):
            continue
        body = unit.get("contenido") or ""
        consec = unit.get("consecutivo")
        parts.append(norm(body))
        label = str(consec or "").strip()
        if not norm(body):
            biblia = unit.get("biblia") if isinstance(unit.get("biblia"), dict) else {}
            chapter = str(biblia.get("capitulo") or "")
            verse = biblia.get("versiculo")
            if chapter == "0" and verse in (0, "0"):
                empty_verse0 += 1
            elif label in ("", "no-encontrado"):
                empty_unlabeled += 1
            else:
                empty += 1
        if label in ("", "no-encontrado"):
            missing_label += 1
        match = MOJI.search(body)
        if match:
            moji_count += 1
            if not moji_where:
                moji_where = f"unidad {index} consecutivo {consec}: {snippet(body, match)}"
        if FTN_MARK.search(body):
            ftn_count += 1
            if not ftn_where:
                ftn_where = f"unidad {index} consecutivo {consec}: {snippet(body, FTN_MARK.search(body))}"
        for ref in unit.get("referencias") or []:
            if isinstance(ref, dict):
                ref_count += 1
        if len(body) > 180:
            long_units += 1
            if len(EN_WORD.findall(body)) >= 4 and len(ES_WORD.findall(body)) == 0:
                en_units += 1
        for key, count in script_counts(body).items():
            letters[key] += count
    if empty:
        findings.append(
            Finding(
                "truncated",
                doc_id,
                "contenido vacío",
                f"{empty} unidades sin texto",
                "alta" if empty >= 3 or empty == len(units) else "dudoso",
            )
        )
    if empty_unlabeled:
        findings.append(
            Finding(
                "truncated",
                doc_id,
                "contenido vacío y consecutivo no-encontrado",
                f"{empty_unlabeled} unidades sin texto",
                "dudoso",
            )
        )
    if empty_verse0:
        findings.append(
            Finding(
                "truncated",
                doc_id,
                "versículo 0,0 sin texto",
                f"{empty_verse0} unidades con capítulo 0 y versículo 0",
                "dudoso",
            )
        )
    if missing_label:
        findings.append(
            Finding(
                "numbering",
                doc_id,
                "consecutivo vacío o no-encontrado",
                f"{missing_label} unidades",
                "alta" if missing_label >= 3 else "dudoso",
            )
        )
    if moji_count:
        findings.append(
            Finding(
                "encoding",
                doc_id,
                f"{moji_count} unidades con mojibake o carácter de reemplazo",
                moji_where,
                "dudoso" if meta.get("translationProvenance") == "ai" else "alta",
            )
        )
    if ftn_count:
        findings.append(
            Finding(
                "footnote",
                doc_id,
                f"marcador [_ftn] en {ftn_count} unidades",
                ftn_where + (f". Referencias en el documento: {ref_count}." if ref_count == 0 else "."),
                "alta" if ref_count == 0 else "dudoso",
            )
        )
    findings.extend(numbering_findings(doc_id, units, str(meta.get("kind") or "")))
    locale = meta.get("locale") or ""
    if locale == "es" and long_units >= 8 and en_units / long_units >= 0.3:
        findings.append(
            Finding(
                "mixed-language",
                doc_id,
                "unidades largas en inglés dentro de un pack es",
                f"{en_units} de {long_units} unidades largas no tienen partículas españolas y sí inglesas",
                "dudoso",
            )
        )
    total_letters = sum(letters.values()) or 1
    wanted = expected_script(locale)
    if locale in ("ar", "zh", "hi") and letters[wanted] / total_letters < 0.4 and letters["latin"] / total_letters > 0.4:
        findings.append(
            Finding(
                "mixed-language",
                doc_id,
                f"locale {locale}",
                f"letras {wanted} {letters[wanted]}, latinas {letters['latin']}",
                "dudoso",
            )
        )
    if locale in ("es", "en", "la") and wanted == "latin":
        other = letters["arabic"] + letters["cjk"] + letters["deva"]
        if other / total_letters > 0.15 and other > 80:
            findings.append(
                Finding(
                    "mixed-language",
                    doc_id,
                    f"locale {locale}",
                    f"letras no latinas {other} de {total_letters}",
                    "dudoso",
                )
            )
    digest = hashlib.sha256("\n".join(parts).encode("utf-8")).hexdigest()
    hashes[digest].append(doc_id)
    return findings, digest, ref_count


def html_text(page: str) -> str:
    stripped = TAG.sub(" ", page)
    stripped = TAGS.sub(" ", stripped)
    return fold(html_lib.unescape(stripped))


def compare_html(meta: dict, units: list, page: str, ref_count: int) -> list[Finding]:
    doc_id = meta["id"]
    findings = []
    plain = html_text(page)
    if len(plain) < 400:
        findings.append(
            Finding(
                "official-mismatch",
                doc_id,
                meta.get("sourceUrl") or "",
                "la página oficial devolvió poco texto, no se pudo contrastar el cuerpo",
                "dudoso",
            )
        )
        return findings
    samples = []
    for index, unit in enumerate(units):
        if not isinstance(unit, dict):
            continue
        body = fold(unit.get("contenido") or "")
        if len(body) < 60:
            continue
        samples.append((index, unit.get("consecutivo"), body[:80]))
    if len(samples) > 12:
        step = len(samples) / 12
        samples = [samples[int(i * step)] for i in range(12)]
    if samples:
        hits = sum(1 for _, _, sample in samples if sample in plain)
        ratio = hits / len(samples)
        if ratio < 0.8:
            missed = next((item for item in samples if item[2] not in plain), None)
            evidence = f"{hits} de {len(samples)} muestras aparecen en la página"
            if missed:
                evidence += f". No está: unidad {missed[0]} consecutivo {missed[1]} «{missed[2][:70]}»"
            findings.append(
                Finding(
                    "official-mismatch",
                    doc_id,
                    meta.get("sourceUrl") or "",
                    evidence,
                    "alta" if ratio <= 0.4 and meta.get("translationProvenance") == "official" else "dudoso",
                )
            )
    nums = [int(value) for value in P_NUM.findall(page)]
    corpus_nums = []
    for unit in units:
        if isinstance(unit, dict) and INT_CONSEC.fullmatch(str(unit.get("consecutivo") or "").strip()):
            corpus_nums.append(int(unit["consecutivo"]))
    if len(nums) >= 5 and corpus_nums:
        missing = sorted(set(nums) - set(corpus_nums))
        if len(missing) >= 3 and len(missing) / len(set(nums)) > 0.15:
            shown = ", ".join(str(number) for number in missing[:15])
            findings.append(
                Finding(
                    "truncated",
                    doc_id,
                    "párrafos numerados de la fuente",
                    f"la página tiene {len(set(nums))} números y faltan {len(missing)} en el corpus: {shown}",
                    "alta" if meta.get("translationProvenance") == "official" else "dudoso",
                )
            )
    ftn = len(FTN_HTML.findall(page))
    if ftn >= 5 and ref_count == 0:
        findings.append(
            Finding(
                "footnote",
                doc_id,
                meta.get("sourceUrl") or "",
                f"la página tiene {ftn} anclas de nota y el corpus tiene 0 referencias",
                "dudoso",
            )
        )
    return findings


def fetch_page(url: str, cache: Path) -> str | None:
    digest = hashlib.sha256(url.encode("utf-8")).hexdigest()
    cached = cache / digest
    if cached.exists():
        return cached.read_text(encoding="utf-8", errors="replace")
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "documentos-vaticanos-audit/1.0"},
    )
    try:
        with urllib.request.urlopen(request, timeout=25) as response:
            raw = response.read()
            charset = response.headers.get_content_charset() or "utf-8"
    except Exception as exc:
        print(f"fetch fail {url}: {exc}", file=sys.stderr)
        return None
    if not charset or charset.lower() == "utf-8":
        meta = re.search(br"charset=[\"']?([\w-]+)", raw[:4000], re.I)
        if meta:
            charset = meta.group(1).decode("ascii", "ignore")
    try:
        text = raw.decode(charset, "replace")
    except LookupError:
        text = raw.decode("utf-8", "replace")
    cache.mkdir(parents=True, exist_ok=True)
    cached.write_text(text, encoding="utf-8")
    return text


def duplicate_findings(hashes: dict[str, list[str]], lengths: dict[str, int]) -> list[Finding]:
    findings = []
    for digest, ids in hashes.items():
        if len(ids) < 2:
            continue
        longest = max(lengths.get(doc_id, 0) for doc_id in ids)
        confidence = "alta" if longest >= 400 else "dudoso"
        findings.append(
            Finding(
                "duplicate",
                ids[0],
                "mismo texto normalizado",
                "también en " + ", ".join(ids[1:]),
                confidence,
            )
        )
    return findings


def broken_ref_findings(refs: list[tuple], index: dict[str, dict]) -> list[Finding]:
    grouped = defaultdict(list)
    for src, consec, target, punto in refs:
        info = index.get(target)
        if info is None:
            grouped[("missing", target)].append((src, consec, punto))
            continue
        punto_s = str(punto or "").strip()
        if not punto_s:
            grouped[("empty", src)].append((src, consec, target))
            continue
        if punto_s in info["consecutivos"]:
            continue
        if INT_CONSEC.fullmatch(punto_s):
            number = int(punto_s)
            if 0 <= number < info["count"] or 1 <= number <= info["count"]:
                continue
        grouped[("range", src)].append((src, consec, f"{target}:{punto_s}"))
    findings = []
    for (kind, key), places in grouped.items():
        sample = places[0]
        if kind == "missing":
            findings.append(
                Finding(
                    "broken-ref",
                    sample[0],
                    f"idDocumento ausente {key}",
                    f"{len(places)} enlaces. Ejemplo: {sample[0]} consecutivo {sample[1]} idPunto {sample[2]}",
                    "alta",
                )
            )
        elif kind == "empty":
            findings.append(
                Finding(
                    "broken-ref",
                    key,
                    "idPunto vacío",
                    f"{len(places)} enlaces. Ejemplo consecutivo {sample[1]} hacia {sample[2]}",
                    "alta",
                )
            )
        else:
            findings.append(
                Finding(
                    "broken-ref",
                    key,
                    "idPunto fuera de rango",
                    f"{len(places)} enlaces. Ejemplo consecutivo {sample[1]} {sample[2]}",
                    "dudoso",
                )
            )
    return findings


def scan(corpus: Path, fetch_limit: int, cache: Path) -> dict:
    manifest = load_json(corpus / "manifest.json")
    documents = manifest["documents"]
    findings: list[Finding] = []
    hashes: dict[str, list[str]] = defaultdict(list)
    lengths: dict[str, int] = {}
    index: dict[str, dict] = {}
    refs = []
    ref_counts = {}
    loaded = {}
    ai = 0
    official = 0
    seen_ids = Counter()
    for meta in documents:
        seen_ids[meta["id"]] += 1
        if meta.get("translationProvenance") == "ai":
            ai += 1
        elif meta.get("translationProvenance") == "official":
            official += 1
    dup_ids = [doc_id for doc_id, count in seen_ids.items() if count > 1]
    for doc_id in dup_ids:
        findings.append(
            Finding("duplicate", doc_id, "manifest", f"el id aparece {seen_ids[doc_id]} veces", "alta")
        )
    for nth, meta in enumerate(documents, start=1):
        if nth % 100 == 0:
            print(f"audit {nth}/{len(documents)}", file=sys.stderr)
        body = corpus / meta["bodyPath"]
        if not body.exists():
            findings.append(
                Finding("truncated", meta["id"], meta.get("bodyPath") or "", "no está el content.json", "alta")
            )
            continue
        try:
            payload = load_json(body)
        except json.JSONDecodeError as exc:
            findings.append(Finding("encoding", meta["id"], str(body), f"JSON inválido: {exc}", "alta"))
            continue
        units = [unit for unit in units_of(payload) if isinstance(unit, dict)]
        doc_findings, _digest, ref_count = local_doc_findings(meta, units, "", hashes)
        findings.extend(doc_findings)
        lengths[meta["id"]] = sum(len(unit.get("contenido") or "") for unit in units)
        consecutivos = {str(unit.get("consecutivo") or "").strip() for unit in units}
        index[meta["id"]] = {"count": len(units), "consecutivos": consecutivos}
        ref_counts[meta["id"]] = ref_count
        loaded[meta["id"]] = (meta, units)
        for index_unit, unit in enumerate(units):
            for ref in unit.get("referencias") or []:
                if not isinstance(ref, dict):
                    continue
                local = ref.get("local")
                if not isinstance(local, dict):
                    continue
                target = local.get("idDocumento") or ""
                if not target:
                    continue
                refs.append((meta["id"], unit.get("consecutivo"), target, local.get("idPunto")))
    findings.extend(duplicate_findings(hashes, lengths))
    findings.extend(broken_ref_findings(refs, index))
    fetched = 0
    fetch_errors = 0
    if fetch_limit > 0:
        candidates = []
        flagged = {item.document_id for item in findings if item.kind in ("truncated", "numbering", "encoding", "footnote")}
        for meta in documents:
            url = meta.get("sourceUrl") or ""
            if "vatican.va" not in url or not re.search(r"\.html?$", url, re.I):
                continue
            if meta.get("translationProvenance") == "ai":
                continue
            if meta["id"] not in loaded:
                continue
            priority = 0 if meta["id"] in flagged else 1
            candidates.append((priority, -(meta.get("unitCount") or 0), meta["id"], meta))
        candidates.sort()
        for _priority, _count, _doc_id, meta in candidates[:fetch_limit]:
            page = fetch_page(meta["sourceUrl"], cache)
            fetched += 1
            if page is None:
                fetch_errors += 1
                findings.append(
                    Finding(
                        "official-mismatch",
                        meta["id"],
                        meta["sourceUrl"],
                        "no se pudo descargar la fuente en este pase",
                        "dudoso",
                    )
                )
                continue
            meta_loaded, units = loaded[meta["id"]]
            findings.extend(compare_html(meta_loaded, units, page, ref_counts.get(meta["id"], 0)))
    return {
        "documents": len(documents),
        "ai": ai,
        "official": official,
        "fetched": fetched,
        "fetchErrors": fetch_errors,
        "findings": [item.as_dict() for item in findings],
    }


def render_markdown(result: dict, corpus: Path) -> str:
    findings = result["findings"]
    by_kind = Counter(item["kind"] for item in findings)
    by_conf = Counter(item["confidence"] for item in findings)
    lines = [
        "# Auditoría del corpus descargado",
        "",
        f"Medido con `scripts-descarga/audit_corpus.py` sobre `{corpus}`.",
        f"Documentos en el manifest: {result['documents']}. Procedencia oficial: {result['official']}. Traducción generada: {result['ai']}.",
        "Las traducciones generadas no se tratan como texto dañado. Su página de origen no es una copia del pack.",
        f"Páginas oficiales consultadas en este pase: {result['fetched']}. Fallos de descarga: {result['fetchErrors']}.",
        "Un hallazgo dudoso queda para revisión humana. El script no reescribe texto.",
        "",
        "| tipo | hallazgos |",
        "|---|---:|",
    ]
    for kind, count in sorted(by_kind.items(), key=lambda item: (-item[1], item[0])):
        lines.append(f"| {kind} | {count} |")
    lines.append("")
    lines.append(f"Confianza alta: {by_conf.get('alta', 0)}. Dudosos: {by_conf.get('dudoso', 0)}.")
    lines.append("")
    lines.append("## Hallazgos")
    lines.append("")
    order = {"alta": 0, "dudoso": 1}
    shown = sorted(findings, key=lambda item: (order.get(item["confidence"], 9), item["kind"], item["documentId"]))
    if not shown:
        lines.append("Ningún hallazgo con las reglas de este script.")
    for item in shown:
        lines.append(
            f"- `{item['documentId']}` · {item['kind']} · {item['confidence']}. "
            f"Ubicación: {item['location']}. Evidencia: {item['evidence']}"
        )
    lines.append("")
    return "\n".join(lines)


def self_test() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        corpus = root / "corpus"
        doc = corpus / "documents" / "roto-es"
        doc.mkdir(parents=True)
        units = [
            {"consecutivo": "1", "contenido": "Texto limpio de la iglesia en español que sigue un buen rato para la muestra oficial.", "referencias": []},
            {"consecutivo": "2", "contenido": "Mojibake Ã¡ en esta unidad.", "referencias": []},
            {"consecutivo": "4", "contenido": "Salto de numeración " + ("palabra " * 40), "referencias": [{"local": {"idDocumento": "no-esta", "idPunto": "1"}}]},
            {"consecutivo": "5", "contenido": "Nota [_ftn1] sin cuerpo.", "referencias": []},
            {"consecutivo": "6", "contenido": "The church and the faith of the people from this land with that hope.", "referencias": []},
            {"consecutivo": "7", "contenido": "Otro párrafo español de la iglesia y de la fe del Moyen Âge que el pueblo guarda por años.", "referencias": []},
            {"consecutivo": "8", "contenido": "Sigue el texto de la iglesia y de la oración que el pueblo reza en la tarde.", "referencias": []},
            {"consecutivo": "9", "contenido": "Cierra el texto de la iglesia y de la misión que el pueblo vive en la ciudad.", "referencias": []},
        ]
        (doc / "content.json").write_text(json.dumps(units), encoding="utf-8")
        twin = corpus / "documents" / "copia-es"
        twin.mkdir(parents=True)
        (twin / "content.json").write_text(json.dumps(units), encoding="utf-8")
        manifest = {
            "documents": [
                {
                    "id": "roto-es",
                    "title": "Roto",
                    "locale": "es",
                    "kind": "magisterium",
                    "bodyPath": "documents/roto-es/content.json",
                    "unitCount": 3,
                    "sourceUrl": "https://www.vatican.va/example.html",
                    "translationProvenance": "official",
                },
                {
                    "id": "copia-es",
                    "title": "Copia",
                    "locale": "es",
                    "kind": "magisterium",
                    "bodyPath": "documents/copia-es/content.json",
                    "unitCount": 8,
                    "sourceUrl": "https://www.vatican.va/example-2.html",
                    "translationProvenance": "official",
                },
            ]
        }
        (corpus / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
        result = scan(corpus, 0, root / "cache")
        kinds = Counter(item["kind"] for item in result["findings"])
        assert kinds["encoding"] >= 1, kinds
        encoding = [item for item in result["findings"] if item["kind"] == "encoding"]
        assert all("Âge" not in item["evidence"] for item in encoding), encoding
        assert kinds["numbering"] >= 1, kinds
        assert kinds["truncated"] >= 1, kinds
        assert kinds["footnote"] >= 1, kinds
        assert kinds["broken-ref"] >= 1, kinds
        assert kinds["duplicate"] >= 1, kinds
        page = """
        <html lang="es"><body>
        <p>1. Texto limpio de la iglesia en español que sigue un buen rato para la muestra oficial.</p>
        <p>2. Este párrafo oficial no está en el corpus de la misma forma.</p>
        <p>3. Tercer párrafo oficial ausente del pack descargado por completo.</p>
        <p>4. Salto de numeración que sí coincide con el corpus en su inicio y sigue.</p>
        <p>10. Párrafo diez que el corpus no copió.</p>
        <p>11. Párrafo once que el corpus no copió.</p>
        <p>12. Párrafo doce que el corpus no copió.</p>
        <a id="_ftn1" href="#_ftnref1">nota</a>
        <a id="_ftn2" href="#_ftnref2">nota</a>
        <a id="_ftn3" href="#_ftnref3">nota</a>
        <a id="_ftn4" href="#_ftnref4">nota</a>
        <a id="_ftn5" href="#_ftnref5">nota</a>
        </body></html>
        """
        compared = compare_html(manifest["documents"][0], units, page, 0)
        assert any(item.kind == "truncated" for item in compared), [item.as_dict() for item in compared]
        print("self-test ok", dict(kinds))


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Audita el corpus descargado.")
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--markdown", type=Path)
    parser.add_argument("--json", type=Path)
    parser.add_argument("--fetch", type=int, default=0)
    parser.add_argument("--cache", type=Path, default=Path("/tmp/dv-audit-html"))
    args = parser.parse_args(argv)
    if args.self_test:
        self_test()
        return 0
    corpus = Path(os.environ.get("CORPUS_ROOT", DEFAULT_CORPUS))
    result = scan(corpus, args.fetch, args.cache)
    if args.json:
        args.json.parent.mkdir(parents=True, exist_ok=True)
        args.json.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    text = render_markdown(result, corpus)
    if args.markdown:
        args.markdown.parent.mkdir(parents=True, exist_ok=True)
        args.markdown.write_text(text, encoding="utf-8")
        print(f"wrote {args.markdown} findings {len(result['findings'])}", file=sys.stderr)
    else:
        sys.stdout.write(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
