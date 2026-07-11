/**
 * Minimal unit tests for ref-parser.
 * Run: npx ts-node --transpile-only ref_parser.test.ts
 */
import bookCodes from "./models/data/book-codes.json";
import docCodesFile from "./models/data/doc-codes.json";
import {
  BookCodeEntry,
  DocCodeEntry,
  buildBookIndex,
  buildDocIndex,
  isNoise,
  normalizeAbbr,
  parseBibleCitation,
  parseEcclesialCitation,
  parseRefGroup,
} from "./src/refs/ref-parser";

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

const index = buildBookIndex(bookCodes as BookCodeEntry[]);
const docIndex = buildDocIndex(
  (docCodesFile as { documents: DocCodeEntry[] }).documents,
);

// normalizeAbbr
assert(normalizeAbbr("1 Tm") === "1tm", "normalize 1 Tm");
assert(normalizeAbbr("Gén.") === "gen", "normalize Gén.");
assert(normalizeAbbr("1 Cor") === "1cor", "normalize 1 Cor");
assert(normalizeAbbr("Rm") === "rm", "normalize Rm");

// isNoise
assert(isNoise("1992") === true, "1992 is noise");
assert(isNoise("primera sección") === true, "primera sección is noise");
assert(isNoise("Mt 10,32") === false, "Mt is not noise");

// parseBibleCitation cases
{
  const c = parseBibleCitation("Mt 10,32", index);
  assert(c?.bookSlug === "evangelio segun san mateo", "Mt → mateo");
  assert(c?.chapter === 10 && c?.verseStart === 32, "Mt 10,32 coords");
}
{
  const c = parseBibleCitation("cf. Gn 1,26-28", index);
  assert(c?.bookSlug === "genesis", "Gn → genesis");
  assert(c?.cf === true, "cf flag");
  assert(c?.verseStart === 26 && c?.verseEnd === 28, "Gn range");
}
{
  const c = parseBibleCitation("1Tm 2,3-4", index);
  assert(c?.bookSlug === "primera carta a timoteo", "1Tm");
  assert(c?.chapter === 2 && c?.verseStart === 3 && c?.verseEnd === 4, "1Tm range");
}
{
  const c = parseBibleCitation("1 Tm 2,3-4", index);
  assert(c?.bookSlug === "primera carta a timoteo", "1 Tm spaced");
}
{
  const c = parseBibleCitation("Rom 10,9", index);
  assert(c?.bookSlug === "carta a los romanos", "Rom → romanos");
  assert(c?.chapter === 10 && c?.verseStart === 9, "Rom coords");
}
{
  const c = parseBibleCitation("Gn 1,4.10.12", index);
  assert(c?.verseStart === 4, "verse list primary");
  assert(JSON.stringify(c?.verses) === JSON.stringify([4, 10, 12]), "verse list");
}
{
  const c = parseBibleCitation("Hch 4,12", index);
  assert(c?.bookSlug === "hechos de los apostoles", "Hch");
}
{
  const c = parseBibleCitation("cf. Judas 3", index);
  assert(c?.bookSlug === "carta de san judas", "Judas");
  assert(c?.verseOnly === true && c?.verseStart === 3, "Judas verse-only");
}

// parseRefGroup multi + noise
{
  const atoms = parseRefGroup("cf. 1 Co 13, 12; 2 Co 5, 6-8", index);
  assert(atoms.length === 2, "two atoms");
  assert(atoms[0].kind === "bible" && atoms[1].kind === "bible", "both bible");
  if (atoms[0].kind === "bible" && atoms[1].kind === "bible") {
    assert(atoms[0].citation.bookSlug.includes("corintios"), "1 Co");
    assert(atoms[1].citation.bookSlug.includes("corintios"), "2 Co");
  }
}
{
  const atoms = parseRefGroup("1992", index);
  assert(atoms[0]?.kind === "noise", "1992 group noise");
}
{
  const atoms = parseRefGroup("primera sección", index);
  assert(atoms[0]?.kind === "noise", "sección noise");
}
{
  // book carry-forward
  const atoms = parseRefGroup("Hb 11,40; 12,2", index);
  assert(atoms.length === 2, "carry two");
  assert(atoms[1].kind === "bible", "carry bible");
  if (atoms[1].kind === "bible") {
    assert(atoms[1].citation.bookSlug === "carta a los hebreos", "carry book");
    assert(atoms[1].citation.chapter === 12 && atoms[1].citation.verseStart === 2, "carry coords");
  }
}

console.log("ref_parser.test.ts: all asserts passed");

// ALL-CAPS magisterial docs must not resolve as bible
{
  const atoms = parseRefGroup("CT 18", index);
  assert(atoms[0]?.kind !== "bible", "CT 18 is not Cantar");
}
{
  const atoms = parseRefGroup("AG 2", index);
  assert(atoms[0]?.kind !== "bible", "AG 2 is not Ageo");
}
{
  const atoms = parseRefGroup("RM 23", index);
  assert(atoms[0]?.kind !== "bible", "RM 23 is not Romanos");
}
// Mixed-case bible abbreviations still work
{
  const atoms = parseRefGroup("Rm 10,9", index);
  assert(atoms[0]?.kind === "bible", "Rm still bible");
}
{
  const atoms = parseRefGroup("Ct 8,6", index);
  assert(atoms[0]?.kind === "bible", "Ct still bible");
}
{
  const atoms = parseRefGroup("cf. Mt 5-6", index);
  assert(atoms[0]?.kind === "bible", "Mt chapter range");
  if (atoms[0].kind === "bible") {
    assert(atoms[0].citation.chapter === 5, "Mt 5-6 starts ch5");
  }
}

console.log("ref_parser.test.ts: extended asserts passed");

// --- multi-document / ecclesial ---
{
  const c = parseEcclesialCitation("LG 16", docIndex);
  assert(c?.code === "LG" && c?.locator === "16", "LG 16 ecclesial");
}
{
  const c = parseEcclesialCitation("CIC 1992", docIndex);
  assert(c?.code === "CIC" && c?.corpusDocId === "cic-es", "CIC → cic-es");
}
{
  // Must NOT steal Marcos
  const c = parseEcclesialCitation("Mc 16,20", docIndex);
  assert(c === null, "Mc mixed-case is not Marialis cultus");
  const b = parseBibleCitation("Mc 16,20", index);
  assert(b?.bookSlug?.includes("marcos"), "Mc → Marcos bible");
}
{
  const atoms = parseRefGroup("LG 16; Mt 5,3", {
    bookIndex: index,
    docIndex,
  });
  assert(atoms[0].kind === "ecclesial", "LG first");
  assert(atoms[1].kind === "bible", "Mt second");
}
{
  const atoms = parseRefGroup("Mt 28,19-20; Mc 16,20", {
    bookIndex: index,
    docIndex,
  });
  assert(
    atoms.every((a) => a.kind === "bible"),
    "Mt+Mc both bible",
  );
}
{
  const atoms = parseRefGroup("LG 56; cf. 61", {
    bookIndex: index,
    docIndex,
  });
  assert(atoms[0].kind === "ecclesial" && atoms[0].citation.locator === "56", "LG 56");
  assert(
    atoms[1].kind === "ecclesial" &&
      atoms[1].citation.code === "LG" &&
      atoms[1].citation.locator === "61",
    "carry LG to 61",
  );
}
console.log("ref_parser.test.ts: multi-doc asserts passed");
