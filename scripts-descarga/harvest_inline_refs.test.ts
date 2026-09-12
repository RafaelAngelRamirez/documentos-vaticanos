/**
 * Harvest inline citation windows from prose.
 * Run: npx ts-node --transpile-only harvest_inline_refs.test.ts
 */
import bookCodes from "./models/data/book-codes.json";
import docCodesFile from "./models/data/doc-codes.json";
import {
  BookCodeEntry,
  DocCodeEntry,
  buildBookIndex,
  buildDocIndex,
} from "./src/refs/ref-parser";
import {
  extractCiteCandidateStrings,
  harvestNewDescriptions,
} from "./src/refs/harvest_inline";

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

const bookIndex = buildBookIndex(bookCodes as BookCodeEntry[]);
const docIndex = buildDocIndex(
  (docCodesFile as { documents: DocCodeEntry[] }).documents,
);

{
  const cands = extractCiteCandidateStrings(
    "La Iglesia vive de la Eucaristía (Mt 28, 20) y de LG 11.",
  );
  assert(cands.some((c) => /Mt/.test(c)), "parenthetical Mt");
  assert(cands.some((c) => /LG 11/.test(c)), "inline LG 11");
}

{
  const added = harvestNewDescriptions(
    "cf. Gn 1,26 y también (LG 16).",
    [],
    bookIndex,
    docIndex,
  );
  assert(added.length >= 1, "harvests at least one resolvable cite");
}

{
  const added = harvestNewDescriptions(
    "La Iglesia vive (Mt 28, 20) aquí.",
    [{ descripcion: "Mt 28, 20" }],
    bookIndex,
    docIndex,
  );
  assert(added.length === 0, "dedup existing descripcion");
}

{
  const added = harvestNewDescriptions(
    "El año (1992) y la (primera sección) no son citas.",
    [],
    bookIndex,
    docIndex,
  );
  assert(added.length === 0, "years/sections not harvested");
}

console.log("harvest_inline_refs.test.ts: ok");
