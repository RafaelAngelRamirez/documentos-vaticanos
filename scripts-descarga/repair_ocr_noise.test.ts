/**
 * Unit tests for OCR noise cleanup (a) spaced letters + (b) garbage units.
 * Run: npx ts-node --transpile-only repair_ocr_noise.test.ts
 */
import {
  OCR_GARBAGE_PLACEHOLDER,
  collapseSpacedLetters,
  isGarbageUnit,
  isResidualBodyNoise,
  repairOcrNoiseUnit,
  repairOcrSpacedText,
  scoreDocumentGarbage,
  scoreGarbageUnit,
  scoreSpacedLetters,
} from "./src/pipeline/repair_ocr_noise";
import { repairOcrPunctuation } from "./src/pipeline/repair_ocr_punctuation";

let passed = 0;
let failed = 0;

function assert(cond: unknown, msg: string): void {
  if (!cond) {
    failed += 1;
    console.error(`FAIL: ${msg}`);
    return;
  }
  passed += 1;
  console.log(`ok  ${msg}`);
}

function assertEq(actual: string, expected: string, msg: string): void {
  if (actual !== expected) {
    failed += 1;
    console.error(
      `FAIL: ${msg}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`,
    );
    return;
  }
  passed += 1;
  console.log(`ok  ${msg}`);
}

// --- (a) Spaced-letter collapse ---
assertEq(
  collapseSpacedLetters("DE LA H I S T O R I A, Y DEL"),
  "DE LA HISTORIA, Y DEL",
  "collapse HISTORIA",
);
assertEq(
  collapseSpacedLetters("BARBADO V I E J O, O. P.,"),
  "BARBADO VIEJO, O. P.,",
  "collapse VIEJO",
);
assertEq(
  collapseSpacedLetters("U N I V E R S I D A D"),
  "UNIVERSIDAD",
  "collapse UNIVERSIDAD",
);
assertEq(
  collapseSpacedLetters("t i e r r a y a r r a s t r a d o"),
  "tierra y arrastrado",
  "collapse lowercase spaced words",
);
assertEq(
  collapseSpacedLetters("ÍNDICE G E N E R A L D E CONCEPTOS"),
  "ÍNDICE GENERAL DE CONCEPTOS",
  "collapse + split glued particle DE",
);
assertEq(
  collapseSpacedLetters("La fe es el fundamento de la salvación."),
  "La fe es el fundamento de la salvación.",
  "good prose unchanged by collapse",
);
assertEq(
  collapseSpacedLetters("J. R. R. Tolkien"),
  "J. R. R. Tolkien",
  "initials with periods not collapsed as spaced letters",
);
assertEq(
  collapseSpacedLetters("que.dista el sol; es.decir art.cit"),
  "que.dista el sol; es.decir art.cit",
  "internal periods not joined by collapse",
);

// compose with punct repair still join-safe
assertEq(
  repairOcrSpacedText("DE LA H I S T O R I A , Y DEL"),
  "DE LA HISTORIA, Y DEL",
  "spaced + punct compose",
);
assert(
  repairOcrPunctuation("que.dista").includes("que.dista"),
  "punct repair still preserves que.dista",
);
assert(
  repairOcrSpacedText("es.decir, mueran").includes("es.decir"),
  "spaced path preserves es.decir",
);
assert(
  repairOcrSpacedText("art.cit p.194").includes("art.cit"),
  "spaced path preserves art.cit",
);

{
  const m = scoreSpacedLetters("H I S T O R I A and U N I V E R S I D A D");
  assert(m.spacedLetterRuns === 2, `score spaced runs=2 got ${m.spacedLetterRuns}`);
  assert(m.spacedLetterChars === 8 + 11, `score spaced chars got ${m.spacedLetterChars}`);
}

// --- (b) Garbage TOC / leader noise ---
const tocGarbage =
  "INDICE GENERAL Págs. INTRODUCCIÓN 3 ID Fausto cooicnonnnnnnoncnnonononanncononnoncon ..ooonconicininnionicononcorann 87";
assert(isGarbageUnit(tocGarbage), "TOC leader garbage classified");
assert(scoreGarbageUnit(tocGarbage).score >= 5, "TOC garbage score ≥5");

const tocGarbage2 =
  "2. ¿En qué consiste aceptar el evangelio?... ooonininnionininiononios 87 3. La respuesta ..occocconicinicnnionorererncor 99";
assert(isGarbageUnit(tocGarbage2), "dotted-leader ooon garbage classified");

// good prose must NOT be garbage
const goodProse =
  "Dios es bueno y misericordioso. La fe es el fundamento de la salvación y de la esperanza cristiana.";
assert(!isGarbageUnit(goodProse), "good prose is not garbage");
assertEq(collapseSpacedLetters(goodProse), goodProse, "good prose not gutted by collapse");

// citation list should not be treated as TOC garbage
const citations =
  "Ps 18,6. lo 1,10. 1 Tim 1,15. Ps 40,5. Ps 4,3. Ps 72,9. Mt 11,29.";
assert(!isGarbageUnit(citations), "bible citation list not garbage");

// --- repairOcrNoiseUnit: exclude keeps slot via placeholder ---
{
  const r = repairOcrNoiseUnit(tocGarbage);
  assert(r.excludedGarbage === true, "unit marked excludedGarbage");
  assertEq(r.contenido, OCR_GARBAGE_PLACEHOLDER, "garbage → placeholder");
  assert(r.changed === true, "exclusion counts as changed");
}
{
  const r = repairOcrNoiseUnit("DE LA H I S T O R I A");
  assert(r.excludedGarbage === false, "spaced header not excluded as garbage");
  assertEq(r.contenido, "DE LA HISTORIA", "spaced header collapsed");
  assert(r.collapsedSpaced === true, "collapsedSpaced flag");
}
{
  const r = repairOcrNoiseUnit(goodProse);
  assert(r.changed === false, "good prose unit unchanged");
  assertEq(r.contenido, goodProse, "good prose content stable");
}

// document metrics for re-OCR queue
{
  const m = scoreDocumentGarbage([
    goodProse,
    tocGarbage,
    "H I S T O R I A",
    citations,
  ]);
  assert(m.units === 4, "doc metrics units");
  assert(m.garbageUnits >= 1, "doc metrics finds garbage");
  assert(m.spacedLetterRuns >= 1, "doc metrics finds spaced runs");
  assert(m.residualScore > 0, "residualScore ranks queue");
}

// residual body noise (re-OCR queue) — garbled soup, not good prose
{
  // Low-vowel consonant soup (not TOC junk runs) typical of failed OCR pages
  const soup = Array(12)
    .fill("bcdfghjkl npqstvwxz bdfghjkl pqstvwxz bdfghjkl")
    .join(" ");
  assert(isResidualBodyNoise(soup) === true, "garbled soup is residual body noise");
  assert(isResidualBodyNoise(goodProse) === false, "good prose not residual body noise");
  assert(
    isResidualBodyNoise(OCR_GARBAGE_PLACEHOLDER) === false,
    "placeholder not counted as body noise",
  );
}

// idempotent placeholder
{
  const once = repairOcrNoiseUnit(tocGarbage).contenido;
  const twice = repairOcrNoiseUnit(once).contenido;
  assertEq(once, twice, "placeholder exclusion idempotent");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
