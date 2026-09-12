/**
 * Footnote harvest: attach vatican.va notes to body units, never as units.
 * Run: npx ts-node --transpile-only footnote_harvest.test.ts
 */
import fs from "fs";
import path from "path";
import { parseNumberedParagraphs } from "./src/adapters/generic_numbered.adapter";
import {
  collectFootnoteMap,
  collectFootnoteRefIds,
} from "./src/adapters/footnote_harvest";

const { parseHTML } = require("linkedom");

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

const FTN_HTML = `
<html><body>
<p>1. El buen pastor de tu santa grey <a href="#_ftn1" name="_ftnref1">[1]</a> guía.</p>
<p>2. Cf. nada aquí.</p>
<hr />
<p><b>Notas</b></p>
<p><a href="#_ftnref1" name="_ftn1">[1]</a> Cf. Conc. Ecum. Vat. II, Const. dogm. Lumen gentium, 18.</p>
</body></html>`;

const EDN_HTML = `
<html><body>
<p>1. Cosas y palabras transmitidas <a name="_ednref1" href="#_edn1">[1]</a>.</p>
<hr />
<p><b>Notas</b></p>
<p><a name="_edn1" href="#_ednref1">[1]</a> Constit. dogm. Dei Verbum, n. 8.</p>
</body></html>`;

const FN_HTML = `
<html><body>
<p>1. La Iglesia vive de la Eucaristía <a name="fnref1">(</a><a href="#fn1">1</a>).</p>
<p>2. Segundo párrafo sin nota.</p>
<hr width="45%" />
<p><a name="fn1">(</a><a href="#fnref1">1</a>) Const. dogm. Lumen gentium, sobre la Iglesia, 11.</p>
<p><a name="fn2">(</a><a href="#fnref2">2</a>) Conc. Ecum. Vat. II, Decr. Presbyterorum Ordinis, 5.</p>
</body></html>`;

{
  const parsed = parseNumberedParagraphs(FTN_HTML);
  assert(parsed.units.length === 2, `ftn unitCount 2, got ${parsed.units.length}`);
  assert(parsed.units[0].consecutivo === "1", "ftn §1");
  assert(
    (parsed.units[0].referencias || []).some((r) =>
      /Lumen gentium/.test(r.descripcion),
    ),
    "ftn note attached to §1",
  );
  assert(
    !(parsed.units[0].contenido || "").includes("[1]"),
    "ftn marker stripped from body",
  );
  assert(
    parsed.units.every((u) => !/Lumen gentium/.test(u.contenido)),
    "ftn apparatus is not a unit",
  );
}

{
  const parsed = parseNumberedParagraphs(EDN_HTML);
  assert(parsed.units.length === 1, `edn unitCount 1, got ${parsed.units.length}`);
  assert(
    (parsed.units[0].referencias || []).some((r) => /Dei Verbum/.test(r.descripcion)),
    "edn note attached",
  );
}

{
  const parsed = parseNumberedParagraphs(FN_HTML);
  assert(parsed.units.length === 2, `fn unitCount 2, got ${parsed.units.length}`);
  const refs = parsed.units[0].referencias || [];
  assert(
    refs.some((r) => /Lumen gentium/.test(r.descripcion)),
    `fn note attached, got ${JSON.stringify(refs)}`,
  );
  assert(
    !parsed.units.some((u) => u.consecutivo === "1" && /Presbyterorum/.test(u.contenido)),
    "orphan fn2 not a unit",
  );
  assert(!/\(\s*\)/.test(parsed.units[0].contenido), "EE empty () stripped");
}

{
  const { document } = parseHTML(FTN_HTML);
  const harvest = collectFootnoteMap(document.body);
  assert(harvest.map.get("1")?.includes("Lumen gentium"), "map has note 1");
  assert(harvest.skipParagraphs.size >= 1, "skips apparatus p");
  const bodyP = document.querySelector("p") as Element;
  const ids = collectFootnoteRefIds(bodyP);
  assert(ids[0] === "1", `body ref id 1, got ${ids.join(",")}`);
}

const eePath = path.join(__dirname, "fixtures/ee-es/source.html");
if (fs.existsSync(eePath)) {
  const html = fs.readFileSync(eePath, "utf8");
  const parsed = parseNumberedParagraphs(html);
  assert(
    parsed.units.length === 62,
    `ee-es unitCount stays 62, got ${parsed.units.length}`,
  );
  const withNotes = parsed.units.filter((u) => (u.referencias || []).length > 0);
  assert(withNotes.length >= 20, `ee-es harvested notes, got ${withNotes.length} units with refs`);
}

const pgPath = path.join(__dirname, "fixtures/pg-es/source.html");
if (fs.existsSync(pgPath)) {
  const html = fs.readFileSync(pgPath, "utf8");
  const parsed = parseNumberedParagraphs(html);
  assert(
    parsed.units.length === 74,
    `pg-es unitCount stays 74, got ${parsed.units.length}`,
  );
  const u1 = parsed.units.find((u) => u.consecutivo === "1");
  assert(
    (u1?.referencias || []).some((r) => /Ordenación episcopal|Lumen gentium/i.test(r.descripcion)),
    "pg-es §1 has harvested footnote",
  );
}

console.log("footnote_harvest.test.ts: ok");
