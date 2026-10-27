#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import tempfile
import unicodedata
from collections import defaultdict
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
DEFAULT_CORPUS = REPO / "documentos" / "corpus"
DOC_CODES = REPO / "scripts-descarga" / "models" / "data" / "doc-codes.json"
BOOK_CODES = REPO / "scripts-descarga" / "models" / "data" / "book-codes.json"
SOURCES = REPO / "scripts-descarga" / "config" / "sources.json"

NOISE_EXACT = {
    "ibid",
    "ibidem",
    "ib",
    "op cit",
    "loc cit",
    "passim",
    "primera parte",
    "segunda parte",
    "tercera parte",
    "cuarta parte",
    "el simbolo",
    "los mandamientos",
    "el padre nuestro",
    "filioque",
}

AUTHOR_PREFIX = re.compile(
    r"^(?:(?:cf|cfr|vide|ver|tambien|vease)\.?\s+)*"
    r"(?:(?:"
    r"(?:santo|san|beato|santa)\s+[a-z]+(?:\s+(?:de|del|la|el))?(?:\s+[a-z]+){0,5}"
    r"|(?:pio|leon|juan pablo|benedicto xvi|benedicto|francisco|pablo vi|pablo|"
    r"gregorio|juan xxiii|juan|inocencio|sixto)"
    r"(?:\s+[ivx0-9]+)?"
    r")\s*,\s+)+",
    re.I,
)

DOC_TYPE = re.compile(
    r"^(?:carta\s+enc(?:iclica|\.)|enc(?:iclica|\.)|"
    r"exhortacion\s+apostolica|"
    r"constitucion(?:\s+(?:dogmatica|pastoral|apostolica))?|"
    r"motu\s+proprio|carta\s+apostolica|mensaje\s+radiofonico|"
    r"bula|decreto|declaracion)\s*[:.]?\s+",
    re.I,
)

INLINE_CUE = re.compile(
    r"cf\.|cfr\.|vide\s|"
    r"enc[ií]clica|exhortaci[oó]n apost[oó]lica|"
    r"constituci[oó]n(?:\s+(?:dogm[aá]tica|pastoral|apost[oó]lica))?|"
    r"motu proprio|carta apost[oó]lica|"
    r"Summa theologiae|Adversus haereses|Traditio apostolica|"
    r"De civitate Dei|Didach(?:e|é)|Epistula ad ",
    re.I,
)

BARE_WORK = re.compile(
    r"^(?:summa theologiae|adversus haereses|traditio apostolica|de civitate dei|"
    r"didache|confessiones|pastor de hermas|epistula ad [a-z]+)\b"
)

LOCATOR_ONLY = re.compile(r"[\d\s,.\-;:]+")
DATE_NOISE = re.compile(
    r"^\d{1,2}\s+(?:de\s+)?(?:enero|febrero|marzo|abril|mayo|junio|julio|"
    r"agosto|septiembre|octubre|noviembre|diciembre)(?:\s+\d{2,4})?$"
)


def fold(value: str) -> str:
    text = unicodedata.normalize("NFD", value or "")
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = text.lower().replace("\u00a0", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return text


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


class Catalog:
    def __init__(self, corpus: Path, doc_codes: Path, book_codes: Path, sources: Path):
        self.corpus = corpus
        manifest = load_json(corpus / "manifest.json")
        self.docs = manifest["documents"]
        self.ids = {doc["id"] for doc in self.docs}
        self.titles = {}
        self.short_by_code = {}
        for doc in self.docs:
            title = fold(doc.get("title") or "")
            short = fold(doc.get("shortTitle") or "")
            if len(title) >= 8:
                self.titles.setdefault(title, doc["id"])
            if len(short) >= 6:
                self.titles.setdefault(short, doc["id"])
            code = (doc.get("shortTitle") or "").strip()
            if code:
                self.short_by_code.setdefault(code.upper(), doc["id"])
        self.long_titles = [title for title in self.titles if len(title) >= 12]
        self.alias_owned = {
            "de civitate dei": "agustin-16-ciudad-de-dios-1-es",
            "confessiones": "agustin-02-confesiones-es",
            "enarratio in psalmum": "agustin-19-enarraciones-salmos-1-es",
            "epistula ad diognetum": "carta-diogneto-es",
            "de trinitate": "agustin-05-de-trinitate-es",
        }

        coded = load_json(doc_codes)["documents"]
        self.by_code = {entry["code"]: entry for entry in coded}
        aliases = []
        for entry in coded:
            names = [entry["code"], entry.get("title") or "", *(entry.get("aliases") or [])]
            for name in names:
                folded = fold(name)
                if folded:
                    aliases.append((folded, entry))
        aliases.sort(key=lambda item: len(item[0]), reverse=True)
        self.aliases = aliases

        books = []
        for book in load_json(book_codes):
            for alias in book.get("aliases") or []:
                folded = fold(alias)
                if len(folded) >= 2:
                    books.append(folded)
        self.book_aliases = sorted(set(books), key=len, reverse=True)

        self.sources = []
        self.source_by_code = {}
        self.source_by_id = {}
        self.source_by_title = {}
        if sources.exists():
            for source in load_json(sources).get("sources") or []:
                self.sources.append(source)
                if source.get("docCode"):
                    self.source_by_code[source["docCode"]] = source
                if source.get("corpusDocId"):
                    self.source_by_id[source["corpusDocId"]] = source
                title = fold(source.get("title") or "")
                if len(title) >= 8:
                    self.source_by_title[title] = source

        self.catalog_by_code = {}
        self.catalog_by_title = {}
        catalog_path = REPO / "documentos" / "registry" / "source-catalog.json"
        if not catalog_path.exists():
            catalog_path = corpus.parent / "registry" / "source-catalog.json"
        if catalog_path.exists():
            for family in load_json(catalog_path).get("families") or []:
                if family.get("docCode"):
                    self.catalog_by_code[family["docCode"]] = family
                title = fold(family.get("title") or "")
                if len(title) >= 8:
                    self.catalog_by_title[title] = family

    def match_code(self, raw: str):
        folded = fold(raw)
        if not folded:
            return None
        for alias, entry in self.aliases:
            if len(alias) <= 4:
                if re.search(
                    rf"(?<![a-z0-9]){re.escape(alias)}(?![a-z0-9])\s*[,.]?\s*\d",
                    folded,
                ):
                    return entry
            elif alias in folded:
                return entry
        return None

    def in_corpus_code(self, entry) -> bool:
        doc_id = entry.get("corpusDocId")
        if doc_id and doc_id in self.ids:
            return True
        code = entry.get("code") or ""
        if code.upper() in self.short_by_code:
            return True
        return False

    def owns_title(self, title: str) -> bool:
        candidates = [title]
        shortened = re.sub(
            r"^(?:en forma de motu proprio|motu proprio|carta apostolica)\s+",
            "",
            title,
        )
        shortened = re.split(r"\s+(?:del|of|dated)\b", shortened, maxsplit=1)[0].strip()
        if shortened and shortened != title:
            candidates.append(shortened)
        for candidate in candidates:
            owned_id = self.alias_owned.get(candidate)
            if owned_id and owned_id in self.ids:
                return True
            if len(candidate) < 12:
                continue
            for known in self.long_titles:
                plain = known.replace('"', "").replace("'", "")
                if candidate in plain or plain in candidate:
                    return True
        return False

    def scripture(self, raw: str) -> bool:
        folded = fold(raw)
        if re.search(r"enciclica|exhortacion|constitucion|summa|epistula|adversus|motu proprio", folded):
            return False
        for alias in self.book_aliases:
            if re.search(rf"(?<![a-z0-9]){re.escape(alias)}\s*\d", folded):
                return True
        return False


def extract_work(raw: str, catalog: Catalog):
    text = (raw or "").strip()
    if not text:
        return None
    folded = fold(text)
    if folded in NOISE_EXACT or DATE_NOISE.match(folded) or LOCATOR_ONLY.fullmatch(folded):
        return None
    if catalog.scripture(text):
        return ("scripture", None)
    known = catalog.match_code(text)
    if known:
        return ("code", known)
    stripped = AUTHOR_PREFIX.sub("", folded)
    had_author = stripped != folded
    typed = DOC_TYPE.sub("", stripped)
    had_type = typed != stripped
    title = re.split(r"\s+\d|[,(;:]|\(", typed, maxsplit=1)[0]
    title = title.strip(" .;:\"'")
    if title in {"en forma de motu proprio", "motu proprio", "carta apostolica"}:
        return None
    if re.match(r"^de (?:leon|pio|juan|benedicto|francisco|pablo)\b", title):
        return None
    if title in NOISE_EXACT or DATE_NOISE.match(title) or len(title) < 8:
        return None
    if not had_author and not had_type:
        if not BARE_WORK.match(title):
            return None
    if catalog.titles.get(title) or catalog.owns_title(title):
        return ("present-title", title)
    return ("title", title)


class Tally:
    def __init__(self):
        self.count = 0
        self.examples = []
        self.places = []
        self.via_ref = 0
        self.via_inline = 0

    def add(self, raw: str, doc_id: str, consec, unit_index: int, via: str):
        self.count += 1
        if via == "ref":
            self.via_ref += 1
        else:
            self.via_inline += 1
        sample = re.sub(r"\s+", " ", raw).strip()[:160]
        if sample and sample not in self.examples and len(self.examples) < 4:
            self.examples.append(sample)
        if len(self.places) < 6:
            self.places.append(
                {
                    "documentId": doc_id,
                    "consecutivo": consec,
                    "unitIndex": unit_index,
                }
            )


def official_url(catalog: Catalog, kind: str, payload) -> tuple[str | None, str | None]:
    source = None
    family = None
    title = None
    code = None
    if kind == "code":
        code = payload["code"]
        title = fold(payload.get("title") or "")
        source = catalog.source_by_code.get(code) or catalog.source_by_id.get(payload.get("corpusDocId") or "")
        family = catalog.catalog_by_code.get(code)
    elif kind == "title":
        title = payload
        source = catalog.source_by_title.get(title)
        family = catalog.catalog_by_title.get(title)
    elif kind == "missing-id":
        source = catalog.source_by_id.get(payload)
    if source and source.get("seedUrls"):
        return source["seedUrls"][0], source.get("id")
    if family:
        for locale in family.get("locales") or []:
            if locale.get("locale") == "es" and locale.get("url"):
                return locale["url"], None
        if family.get("hubUrl"):
            return family["hubUrl"], None
    return None, source.get("id") if source else None


def can_download(catalog: Catalog, kind: str, payload) -> tuple[bool, str | None]:
    source = None
    if kind == "code":
        source = catalog.source_by_code.get(payload["code"]) or catalog.source_by_id.get(
            payload.get("corpusDocId") or ""
        )
    elif kind == "title":
        source = catalog.source_by_title.get(payload)
    elif kind == "missing-id":
        source = catalog.source_by_id.get(payload)
    if not source:
        return False, None
    script = source.get("legacyScript")
    adapter = source.get("adapter")
    how = script or adapter or source.get("id")
    return True, how


def family_of(label: str, examples: list[str]) -> str:
    blob = fold(label + " " + " ".join(examples))
    if any(word in blob for word in ("summa", "epistula", "adversus", "traditio", "confesion", "didache")):
        return "padres o escolastica"
    if any(word in blob for word in ("concilio", "trento", "nicea", "calcedonia", "lateran")):
        return "concilio"
    if any(word in blob for word in ("catecismo", "catechism")):
        return "catecismo"
    if any(word in blob for word in ("canon", "codigo")):
        return "derecho"
    if any(word in blob for word in ("misal", "liturgia", "pontifical")):
        return "liturgia"
    if any(word in blob for word in ("enciclica", "exhortacion", "constitucion", "motu", "carta apostolica", "bula")):
        return "magisterio"
    return "otro"


def scan(catalog: Catalog, limit_docs: int | None = None):
    missing = defaultdict(Tally)
    present_unlinked = 0
    scripture_hits = 0
    broken_targets = defaultdict(Tally)
    docs_seen = 0
    ref_seen = 0
    documents = catalog.docs if limit_docs is None else catalog.docs[:limit_docs]
    root = catalog.corpus
    for meta in documents:
        docs_seen += 1
        if docs_seen % 100 == 0:
            print(f"scan {docs_seen}/{len(documents)}", file=sys.stderr)
        body = root / meta["bodyPath"]
        if not body.exists():
            alt = root / "documents" / meta["id"] / "content.json"
            body = alt if alt.exists() else body
        if not body.exists():
            continue
        try:
            payload = load_json(body)
        except json.JSONDecodeError as exc:
            print(f"json {meta['id']}: {exc}", file=sys.stderr)
            continue
        for index, unit in enumerate(units_of(payload)):
            if not isinstance(unit, dict):
                continue
            consec = unit.get("consecutivo")
            keys_here = set()
            for ref in unit.get("referencias") or []:
                if not isinstance(ref, dict):
                    continue
                ref_seen += 1
                local = ref.get("local") if isinstance(ref.get("local"), dict) else None
                if local:
                    target = local.get("idDocumento") or ""
                    if target and target not in catalog.ids:
                        broken_targets[("missing-id", target)].add(
                            ref.get("descripcion") or target,
                            meta["id"],
                            consec,
                            index,
                            "ref",
                        )
                work = extract_work(ref.get("descripcion") or "", catalog)
                if work is None:
                    continue
                kind, payload_work = work
                if kind == "scripture":
                    scripture_hits += 1
                    continue
                if kind in ("code", "present-title"):
                    if kind == "code" and not catalog.in_corpus_code(payload_work):
                        key = ("code", payload_work["code"])
                    elif kind == "present-title":
                        present_unlinked += 0 if local else 1
                        continue
                    else:
                        present_unlinked += 0 if local else 1
                        continue
                else:
                    key = ("title", payload_work)
                if key in keys_here:
                    continue
                keys_here.add(key)
                missing[key].add(ref.get("descripcion") or "", meta["id"], consec, index, "ref")
            contenido = unit.get("contenido") or ""
            if not contenido or "cf" not in contenido.lower() and "enc" not in contenido.lower() and "Summa" not in contenido and "Epistula" not in contenido:
                continue
            for match in INLINE_CUE.finditer(contenido):
                span = contenido[match.start() : match.start() + 180]
                if "ordeno que" in fold(span):
                    continue
                work = extract_work(span, catalog)
                if work is None:
                    continue
                kind, payload_work = work
                if kind == "scripture":
                    scripture_hits += 1
                    continue
                if kind == "code":
                    if catalog.in_corpus_code(payload_work):
                        continue
                    key = ("code", payload_work["code"])
                elif kind == "present-title":
                    continue
                else:
                    key = ("title", payload_work)
                if key in keys_here:
                    continue
                keys_here.add(key)
                missing[key].add(span, meta["id"], consec, index, "inline")
    return {
        "docs_seen": docs_seen,
        "ref_seen": ref_seen,
        "scripture_hits": scripture_hits,
        "present_unlinked": present_unlinked,
        "missing": missing,
        "broken_targets": broken_targets,
    }


def label_of(catalog: Catalog, kind: str, payload) -> str:
    if kind == "code":
        entry = catalog.by_code.get(payload) or {}
        return entry.get("title") or payload
    if kind == "missing-id":
        return payload
    return payload


def rows_from(catalog: Catalog, bucket: dict) -> list[dict]:
    rows = []
    for (kind, payload), tally in bucket.items():
        url, source_id = official_url(catalog, kind, catalog.by_code.get(payload) if kind == "code" else payload)
        downloadable, how = can_download(
            catalog,
            kind,
            catalog.by_code.get(payload) if kind == "code" else payload,
        )
        title = label_of(catalog, kind, payload)
        family = family_of(title, tally.examples)
        if kind == "code":
            coded_kind = (catalog.by_code.get(payload) or {}).get("kind")
            if coded_kind == "magisterium":
                family = "magisterio"
            elif coded_kind in ("catechism", "bible", "council", "canon-law", "patristic"):
                family = coded_kind
        rows.append(
            {
                "kind": kind,
                "key": payload if kind != "code" else payload,
                "title": title,
                "count": tally.count,
                "viaRef": tally.via_ref,
                "viaInline": tally.via_inline,
                "family": family,
                "downloadable": downloadable,
                "downloadVia": how,
                "sourceId": source_id,
                "officialUrl": url,
                "examples": tally.examples,
                "places": tally.places,
            }
        )
    rows.sort(key=lambda row: (-row["count"], row["title"]))
    return rows


def render_markdown(result: dict, rows: list[dict], broken: list[dict], corpus: Path) -> str:
    lines = [
        "# Corpus faltante citado",
        "",
        f"Medido con `scripts-descarga/measure_cited_gaps.py` sobre `{corpus}`.",
        f"Documentos leídos: {result['docs_seen']}. Referencias estructuradas vistas: {result['ref_seen']}.",
        f"Citas con forma bíblica, no contadas como obra faltante: {result['scripture_hits']}.",
        f"Citas a una obra que ya está en el corpus y no traían enlace local: {result['present_unlinked']}.",
        "",
        "Una fila es una obra, no una nota al pie. El conteo suma cada aparición en `referencias` y en el texto cuando la frase tiene forma de cita.",
        "La columna de descarga dice si `scripts-descarga/config/sources.json` o un script legado ya pueden bajarla, sin añadir entradas nuevas.",
        "La URL oficial sale del registro o del catálogo. Si no hay URL, queda sin comprobar.",
        "",
        f"Obras distintas que no están en la descarga: {len(rows)}. Apariciones: {sum(row['count'] for row in rows)}.",
        "",
        "| veces | obra | familia | descarga actual | fuente |",
        "|---:|---|---|---|---|",
    ]
    for row in rows:
        how = "sí, " + (row["downloadVia"] or row["sourceId"] or "registro") if row["downloadable"] else "no"
        url = row["officialUrl"] or "sin URL comprobada"
        title = row["title"].replace("|", "/")
        lines.append(f"| {row['count']} | {title} | {row['family']} | {how} | {url} |")
    lines.extend(["", "## Ejemplos de las obras más citadas", ""])
    for row in rows[:25]:
        place = row["places"][0] if row["places"] else {}
        where = ""
        if place:
            where = f" Ejemplo en `{place.get('documentId')}` consecutivo {place.get('consecutivo')}."
        sample = row["examples"][0] if row["examples"] else ""
        lines.append(f"- {row['title']} ({row['count']}).{where} Texto: \"{sample}\".")
    lines.extend(
        [
            "",
            "## Enlaces locales a un id que no está en el corpus",
            "",
            f"Ids distintos: {len(broken)}. Apariciones: {sum(row['count'] for row in broken)}.",
            "",
        ]
    )
    if not broken:
        lines.append("Ningún `referencias[].local.idDocumento` apuntó a un id ausente del manifest.")
    else:
        lines.extend(
            [
                "| veces | id ausente | descarga actual | ejemplo |",
                "|---:|---|---|---|",
            ]
        )
        for row in broken[:80]:
            place = row["places"][0] if row["places"] else {}
            example = f"{place.get('documentId')} / {place.get('consecutivo')}"
            how = "sí" if row["downloadable"] else "no"
            lines.append(f"| {row['count']} | {row['title']} | {how} | {example} |")
    lines.append("")
    return "\n".join(lines)


def build_fixture(root: Path):
    corpus = root / "corpus"
    doc_dir = corpus / "documents" / "lg-es"
    doc_dir.mkdir(parents=True)
    (doc_dir / "content.json").write_text(
        json.dumps(
            [
                {
                    "consecutivo": "1",
                    "contenido": "cf. León XIII, Carta enc. Libertas praestantissimum. Y otra vez.",
                    "referencias": [
                        {"descripcion": "cf León XIII, Carta enc. Libertas praestantissimum"},
                        {"descripcion": "cf. Mc 16,15", "local": {"idDocumento": "bible-es", "idPunto": "1"}},
                        {
                            "descripcion": "cf. Lumen gentium 8",
                            "local": {"idDocumento": "lg-es", "idPunto": "8"},
                        },
                        {
                            "descripcion": "Santo Tomás de Aquino, Summa theologiae, 2-2, q. 64, a. 7",
                        },
                    ],
                },
                {
                    "consecutivo": "2",
                    "contenido": "San Ignacio de Antioquía, Epistula ad Trallianos 3,1 queda en el cuerpo.",
                    "referencias": [
                        {
                            "descripcion": "obra fantasma",
                            "local": {"idDocumento": "no-esta-es", "idPunto": "3"},
                        }
                    ],
                },
            ]
        ),
        encoding="utf-8",
    )
    manifest = {
        "documents": [
            {
                "id": "lg-es",
                "title": "Lumen gentium",
                "shortTitle": "LG",
                "bodyPath": "documents/lg-es/content.json",
                "kind": "magisterium",
                "locale": "es",
            }
        ]
    }
    (corpus / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    return corpus


def self_test() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        corpus = build_fixture(Path(tmp))
        catalog = Catalog(corpus, DOC_CODES, BOOK_CODES, SOURCES)
        result = scan(catalog)
        rows = rows_from(catalog, result["missing"])
        titles = {row["title"] for row in rows}
        assert any("libertas" in row["title"].lower() for row in rows), rows
        assert any("summa theologiae" in row["title"] for row in rows), rows
        assert any("epistula ad trallianos" in row["title"] for row in rows), titles
        assert "carta enc" not in titles, rows
        assert "obra fantasma" not in titles, rows
        assert not any(row["title"] == "Lumen gentium" for row in rows), rows
        libertas = next(row for row in rows if "libertas" in row["title"].lower())
        assert libertas["count"] >= 1, libertas
        assert libertas["downloadable"] is True, libertas
        assert libertas["officialUrl"].startswith("https://www.vatican.va/"), libertas
        broken = rows_from(catalog, result["broken_targets"])
        assert any(row["title"] == "no-esta-es" for row in broken), broken
        assert result["scripture_hits"] >= 1, result
        catalog.long_titles.append("fides et ratio (14 de septiembre de 1998)")
        assert catalog.owns_title("fides et ratio")
        assert catalog.owns_title("summa theologiae") is False
        print("self-test ok", {row["title"]: row["count"] for row in rows})


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Mide obras citadas que no están descargadas.")
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--markdown", type=Path)
    parser.add_argument("--json", type=Path)
    parser.add_argument("--limit-docs", type=int)
    parser.add_argument("--top", type=int, default=0, help="Si es mayor que 0, recorta la tabla.")
    args = parser.parse_args(argv)
    if args.self_test:
        self_test()
        return 0
    corpus = Path(os.environ.get("CORPUS_ROOT", DEFAULT_CORPUS))
    catalog = Catalog(corpus, DOC_CODES, BOOK_CODES, SOURCES)
    result = scan(catalog, args.limit_docs)
    rows = rows_from(catalog, result["missing"])
    broken = rows_from(catalog, result["broken_targets"])
    if args.top:
        rows = rows[: args.top]
    payload = {
        "corpus": str(corpus),
        "docsSeen": result["docs_seen"],
        "refsSeen": result["ref_seen"],
        "scriptureHits": result["scripture_hits"],
        "presentUnlinked": result["present_unlinked"],
        "missingWorks": len(rows) if not args.top else "truncated",
        "missing": rows,
        "brokenTargets": broken,
    }
    if args.json:
        args.json.parent.mkdir(parents=True, exist_ok=True)
        args.json.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    text = render_markdown(result, rows if not args.top else rows, broken, corpus)
    if args.markdown:
        args.markdown.parent.mkdir(parents=True, exist_ok=True)
        args.markdown.write_text(text, encoding="utf-8")
        print(f"wrote {args.markdown}", file=sys.stderr)
    else:
        sys.stdout.write(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
