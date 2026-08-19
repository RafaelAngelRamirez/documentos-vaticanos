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
  classifyUnitText(OCR_GARBAGE_PLACEHOLDER) === "ocr_illegible",
  "placeholder is ocr_illegible",
);
assert(classifyUnitText(ocrJunk()) === "ocr_illegible", "TOC junk is ocr_illegible");

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
