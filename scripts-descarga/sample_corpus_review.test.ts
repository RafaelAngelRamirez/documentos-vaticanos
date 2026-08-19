/**
 * Gating tests: sample size + 25% / 60% thresholds on the real judge.
 * Run: npx ts-node --transpile-only sample_corpus_review.test.ts
 */
import {
  SAMPLE_DAMAGE_FULL_REVIEW,
  OCR_ILLEGIBLE_REOCR,
  classifyUnitText,
  judgeSample,
  planSample,
  repairBrokenFootnoteTokens,
  sampleSizeFor,
  seededRng,
} from "./src/pipeline/sample_corpus_review";
import { OCR_GARBAGE_PLACEHOLDER } from "./src/pipeline/repair_ocr_noise";

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

function cleanProse(): string {
  return (
    "Grande es el Señor y muy digno de alabanza. Quien le busca le halla " +
    "si no se cierra el corazón a la verdad que ya resuena en lo íntimo."
  );
}

function ocrJunk(): string {
  return (
    "ÍNDICE GENERAL DE MATERIAS ........ oooonnnnnn ccoo onononic " +
    "........ ooooccc rrrnnnnnnnnnn 145 ........ ccoocioo 88"
  );
}

assert(sampleSizeFor(0) === 0, "empty pack sample size 0");
assert(sampleSizeFor(5) === 5, "tiny pack samples all units");
assert(sampleSizeFor(8) === 8, "min 8 when unitCount>=8");
assert(sampleSizeFor(100) === 8, "5% of 100 is 5 → clamped to 8");
assert(sampleSizeFor(400) === 20, "5% of 400 = 20");
assert(sampleSizeFor(2000) === 32, "cap at 32");

const p1 = planSample("cic-es", 100);
const p2 = planSample("cic-es", 100);
assert(
  p1.indices.join(",") === p2.indices.join(","),
  "plan is deterministic for same documentId",
);
assert(p1.indices[0] === 0, "includes start");
assert(p1.indices.includes(99), "includes end");
assert(p1.indices.includes(49) || p1.indices.includes(50), "includes mid");
assert(p1.sampleSize === 8, "sample size 8 for 100 units");

const other = planSample("lg-es", 100);
assert(
  other.indices.join(",") !== p1.indices.join(",") || other.indices.length === p1.indices.length,
  "different ids may differ; sizes still valid",
);

const rngA = seededRng("foo");
const rngB = seededRng("foo");
assert(rngA() === rngB(), "seededRng stable");

assert(classifyUnitText(cleanProse()) === "ok", "clean prose is ok");
assert(
  classifyUnitText(OCR_GARBAGE_PLACEHOLDER) === "ok",
  "reviewed TOC placeholder is ok",
);
assert(classifyUnitText("") === "ok", "empty slot is ok (not invented prose)");
assert(classifyUnitText("   ") === "ok", "whitespace slot is ok");
assert(
  classifyUnitText(
    "Ya desde la antigüedad se encuentra en los diversos pueblos una cierta percepción de aquella fuerza misteriosa y el conocimiento de la Suma Divinidad.",
  ) === "ok",
  "Spanish with 'conocimiento' is not residual-flagged",
);
assert(
  classifyUnitText("106. 参见。真理辉煌 ([+[0]+]), 116: AAS 85 ([+[1]+]), 1224。") ===
    "damaged_editorial",
  "broken footnote interpolation is damaged",
);
assertEq(
  repairBrokenFootnoteTokens("106. 参见。真理辉煌 ([+[0]+]), 116: AAS 85 ([+[1]+]), 1224。"),
  "106. 参见。真理辉煌, 116: AAS 85, 1224。",
  "repair strips [+[n]+] tokens and empty parens",
);
assertEq(
  repairBrokenFootnoteTokens(
    'el que no ama, no ha conocido a Dios" ( [+[0]+] ).',
    [{ descripcion: "1 Jn 4,8" }],
  ),
  'el que no ama, no ha conocido a Dios" (1 Jn 4,8).',
  "repair fills token from referencias.descripcion",
);
assert(
  classifyUnitText(
    repairBrokenFootnoteTokens(
      "106. 参见。字母编码。真理辉煌 ([+[0]+]), 116: AAS 85 ([+[1]+]), 1224。",
    ),
  ) === "ok",
  "repaired footnote unit is ok",
);
assert(classifyUnitText(ocrJunk()) === "ocr_illegible", "TOC junk is ocr_illegible");

function cleanZh(): string {
  return (
    "天主是伟大的，应当受到赞美。寻找他的人若不以心门关闭真理，" +
    "便能在内心深处听见那已经回响的声音。"
  );
}
function cleanAr(): string {
  return (
    "عظيم هو الرب ومستحق كل تسبيح. من يطلبه يجده إن لم يغلق قلبه " +
    "عن الحق الذي يتردد في داخله."
  );
}
function cleanHi(): string {
  return (
    "प्रभु महान हैं और स्तुति के योग्य हैं। जो उन्हें खोजता है वह उन्हें पाता है " +
    "यदि वह सत्य के लिए अपना हृदय बंद न करे।"
  );
}
// Long single-token shreds (no Latin letters) — must not sample-pass as OK.
const zhRepeatShred = "的的的的的的的的的的的的的的的的的的的的的的的的的的的的的的的的的的的的";
const arShred = "سسسسسسسسسسسسسسسسسسسسسسسسسسسسسسسسسسسسسسسسسسسسسسسسسس";
const hiShred = "कककककककककककककककककककककककककककककककककककककककककककककककककक";
const zhPunctSoup =
  "··············，，，。。。！！！！··············？？？？········";

assert(classifyUnitText(cleanZh()) === "ok", "clean Chinese prose is ok");
assert(classifyUnitText(cleanAr()) === "ok", "clean Arabic prose is ok");
assert(classifyUnitText(cleanHi()) === "ok", "clean Hindi prose is ok");
assert(
  classifyUnitText(zhRepeatShred) === "damaged_editorial",
  `CJK repeat shred is damaged got ${classifyUnitText(zhRepeatShred)}`,
);
assert(
  classifyUnitText(arShred) === "damaged_editorial",
  `Arabic shred is damaged got ${classifyUnitText(arShred)}`,
);
assert(
  classifyUnitText(hiShred) === "damaged_editorial",
  `Hindi shred is damaged got ${classifyUnitText(hiShred)}`,
);
assert(
  classifyUnitText(zhPunctSoup) !== "ok",
  `CJK punct soup is not ok got ${classifyUnitText(zhPunctSoup)}`,
);

{
  const eight = [
    zhRepeatShred,
    zhRepeatShred,
    zhRepeatShred,
    cleanZh(),
    cleanZh(),
    cleanZh(),
    cleanZh(),
    cleanZh(),
  ];
  const j = judgeSample("fixture-zh", eight);
  assert(j.damagedCount === 3, `zh: 3 damaged got ${j.damagedCount}`);
  assert(j.needsFullReview, "zh: CJK shreds trigger full-review");
  assert(!j.needsReocr, "zh: editorial shreds do not request re-OCR");
  assert(j.decision === "full-review", `zh: full-review got ${j.decision}`);
}

{
  const eight = [
    arShred,
    arShred,
    arShred,
    cleanAr(),
    cleanAr(),
    cleanAr(),
    cleanAr(),
    cleanAr(),
  ];
  const j = judgeSample("fixture-ar", eight);
  assert(j.damagedCount === 3, `ar: 3 damaged got ${j.damagedCount}`);
  assert(j.decision === "full-review", `ar: full-review got ${j.decision}`);
  assert(!j.needsReocr, "ar: no reocr under 60% OCR");
}

// (a) ≤25% damaged → sample-pass, no full-review
{
  const units = Array.from({ length: 40 }, () => cleanProse());
  units[0] = ocrJunk(); // 1 of 8 stratified may or may not include 0 — force via scanAll? 
  // Build texts so sample indices 0 is junk, rest clean: judge uses plan.
  // For a deterministic fixture, pass 40 clean and overwrite only sample slots
  // we control by using scanAll=false on 8-unit pack (samples all).
  const eight = [
    cleanProse(),
    cleanProse(),
    ocrJunk(),
    cleanProse(),
    cleanProse(),
    cleanProse(),
    cleanProse(),
    cleanProse(),
  ];
  const j = judgeSample("fixture-a", eight);
  assert(j.sampleSize === 8, "a: samples all 8");
  assert(j.damagedCount === 1, `a: 1 damaged got ${j.damagedCount}`);
  assert(j.damagedRate <= SAMPLE_DAMAGE_FULL_REVIEW, "a: rate ≤25%");
  assert(j.decision === "sample-pass", `a: sample-pass got ${j.decision}`);
  assert(!j.needsFullReview, "a: no full-review");
  assert(!j.needsReocr, "a: no reocr");
}

// (b) >25% damaged → full-review
{
  const eight = [
    ocrJunk(),
    ocrJunk(),
    ocrJunk(),
    cleanProse(),
    cleanProse(),
    cleanProse(),
    cleanProse(),
    cleanProse(),
  ];
  const j = judgeSample("fixture-b", eight);
  assert(j.damagedCount === 3, `b: 3 damaged got ${j.damagedCount}`);
  assert(j.damagedRate > SAMPLE_DAMAGE_FULL_REVIEW, "b: rate >25%");
  assert(j.needsFullReview, "b: full-review");
  assert(j.ocrIllegibleRate < OCR_ILLEGIBLE_REOCR, "b: OCR <60%");
  assert(j.decision === "full-review", `b: decision full-review got ${j.decision}`);
  assert(!j.needsReocr, "b: no reocr");
}

// (c) ≥60% OCR-illegible → reocr
{
  const eight = [
    ocrJunk(),
    ocrJunk(),
    ocrJunk(),
    ocrJunk(),
    ocrJunk(),
    cleanProse(),
    cleanProse(),
    cleanProse(),
  ];
  const j = judgeSample("fixture-c", eight);
  assert(j.ocrIllegibleCount >= 5, `c: ≥5 OCR got ${j.ocrIllegibleCount}`);
  assert(j.ocrIllegibleRate >= OCR_ILLEGIBLE_REOCR, "c: rate ≥60%");
  assert(j.needsReocr, "c: needs reocr");
  assert(j.decision === "reocr", `c: decision reocr got ${j.decision}`);
}

// (d) 30% editorial damage, OCR <60% → full-review, NOT reocr
{
  const editorial =
    "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
  const eight = [
    editorial,
    editorial,
    editorial,
    cleanProse(),
    cleanProse(),
    cleanProse(),
    cleanProse(),
    cleanProse(),
  ];
  // 3/8 = 37.5% if classified damaged_editorial
  const kinds = eight.map(classifyUnitText);
  const editorialN = kinds.filter((k) => k === "damaged_editorial").length;
  const ocrN = kinds.filter((k) => k === "ocr_illegible").length;
  assert(
    editorialN === 3 && ocrN === 0,
    `d: 3 editorial 0 ocr (got editorial=${editorialN} ocr=${ocrN} kinds=${kinds.join(",")})`,
  );
  const j = judgeSample("fixture-d", eight);
  assert(j.damagedRate > SAMPLE_DAMAGE_FULL_REVIEW, "d: damaged >25%");
  assert(j.ocrIllegibleRate < OCR_ILLEGIBLE_REOCR, "d: OCR <60%");
  assert(j.decision === "full-review", `d: full-review not reocr got ${j.decision}`);
  assert(!j.needsReocr, "d: must not request re-OCR");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
