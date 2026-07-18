/**
 * Unit tests for roman_catechism_units (real shipped functions).
 * Run: npx ts-node --transpile-only roman_catechism_units.test.ts
 */
import {
  cleanRomanCatechismOcr,
  isLabeledUnitDump,
  labeledUnitsToTransport,
  romanCatechismToUnits,
  transportToLabeledDump,
} from "./src/pipeline/roman_catechism_units";

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

// Minimal Latin-like fixture (no OCR garbage)
const FIXTURE = `
PARS PRIMA.

DE FIDE ET SYMBOLO FIDEI

CAPUT I.

1. Quid sit Fides hoc loco, et quae ejus ad salutem necessitas.
Sed quoniam in divinis litteris multiplex est Fidei significatio; nos hic de ea loquimur, cujus vi omnino assentimur iis, quae tradita sunt divinitus. Hanc autem ad salutem consequendam esse necessariam, nemo jure dubitabit.

2. Quomodo fides definitur.
Fides est virtus theologica qua Deo revelanti firmiter assentimur. Haec doctrina in Ecclesia catholica semper tradita est.

CAPUT II.

1. De primo Symboli Articulo.
Credo in Deum Patrem omnipotentem, creatorem caeli et terrae. Hic articulus fundamentum est totius fidei christianae.

PARS SECUNDA.

CAPUT I.

1. De Sacramentis in genere.
Sacramentum est signum sensibile gratiae invisibilis, a Christo institutum ad sanctificationem hominum.
`;

{
  const units = romanCatechismToUnits(FIXTURE, { minLength: 20 });
  assert(units.length >= 4, `expected >=4 units, got ${units.length}`);
  const ids = units.map((u) => u.consecutivo);
  assert(ids.includes("1.1.1"), `has 1.1.1 got ${ids.join(",")}`);
  assert(ids.includes("1.1.2"), `has 1.1.2`);
  assert(ids.includes("1.2.1"), `has 1.2.1`);
  assert(ids.includes("2.1.1"), `has 2.1.1`);
  const u111 = units.find((u) => u.consecutivo === "1.1.1")!;
  assert(/Fides/i.test(u111.contenido), "1.1.1 contains Fides");
  assert(!/binary|�/.test(u111.contenido), "no binary garbage");
}

// OCR cleanup: CAPUT IL → CAPUT I, hyphen rejoin
{
  const ocr = `
junk front matter
page 3

PARS PRIMA.
TOC only CAPUT I. skip this early

something

PARS PRIMA.

CAPUT IL.

1. Quid sit Fi-
des hoc loco.
Sed quoniam in divinis litteris multiplex est Fidei significatio et longa explicatio ad finem perducitur.
`;
  const cleaned = cleanRomanCatechismOcr(ocr);
  assert(/CAPUT I\./i.test(cleaned), "OCR CAPUT IL fixed");
  assert(/Fides hoc loco/i.test(cleaned), "hyphen rejoined");
  const units = romanCatechismToUnits(cleaned, { minLength: 20 });
  assert(units.length >= 1, "at least one unit from OCR sample");
  assert(
    units.some((u) => u.consecutivo.startsWith("1.1")),
    "part.chapter section from OCR",
  );
}

// Labeled dump (Spanish regenerable path)
{
  const dump = `1.1.1
Qué sea la Fe en este lugar y su necesidad para la salvación. Texto de estudio.

1.1.2
Cuándo y por qué causa fueron transmitidos los doce artículos.

2.1.1
De los Sacramentos en general.
`;
  assert(isLabeledUnitDump(dump) === true, "detect labeled dump");
  const units = labeledUnitsToTransport(dump);
  assert(units.length === 3, `labeled 3 units got ${units.length}`);
  assert(units[0].consecutivo === "1.1.1", "first id 1.1.1");
  assert(units[1].consecutivo === "1.1.2", "second id");
  assert(units[2].consecutivo === "2.1.1", "third id");
  assert(/Fe/.test(units[0].contenido), "body kept");
  assert(!/^u\d+$/.test(units[0].consecutivo), "not synthetic uN");

  const round = labeledUnitsToTransport(transportToLabeledDump(units));
  assert(round.length === 3, "round-trip count");
  assert(round[0].consecutivo === "1.1.1", "round-trip id");
}

// Real clean ES file when present (shipped path)
{
  const fs = require("fs") as typeof import("fs");
  const path = require("path") as typeof import("path");
  const esClean = path.resolve(
    __dirname,
    "../documentos/magisterium-source/clean/catecismo-romano-es.txt",
  );
  if (fs.existsSync(esClean)) {
    const raw = fs.readFileSync(esClean, "utf8");
    assert(isLabeledUnitDump(raw), "shipped ES clean is labeled dump");
    const units = labeledUnitsToTransport(raw, { minLength: 0 });
    assert(
      units.length >= 1000,
      `shipped ES clean yields >=1000 units, got ${units.length}`,
    );
    assert(
      units.every((u) => !/^u\d+$/i.test(u.consecutivo)),
      "no synthetic uN ids in shipped ES dump",
    );
    assert(
      units.some((u) => u.consecutivo === "1.1.1"),
      "contains 1.1.1",
    );
  }
}

console.log("OK: roman_catechism_units.test.ts passed");
