/**
 * Cheap stratified sampling + campaign thresholds (pure, no I/O).
 *
 * Sample: start + mid + end + seeded random. Size = min(32, max(8, 5% of units)).
 * Full review when damaged fraction of the sample > 25%.
 * Re-OCR only when OCR-illegible fraction ≥ 60% (sample or full scan).
 */

import {
  isGarbageUnit,
  isDualColumnShredUnit,
  OCR_GARBAGE_PLACEHOLDER,
} from "./repair_ocr_noise";

export const SAMPLE_DAMAGE_FULL_REVIEW = 0.25;
export const OCR_ILLEGIBLE_REOCR = 0.6;
export const SAMPLE_MAX = 32;
export const SAMPLE_MIN = 8;
export const SAMPLE_PCT = 0.05;

export type UnitVerdictKind = "ok" | "damaged_editorial" | "ocr_illegible";

export interface SampledUnit {
  unitIndex: number;
  kind: UnitVerdictKind;
}

export interface SamplePlan {
  documentId: string;
  unitCount: number;
  sampleSize: number;
  indices: number[];
}

export type ReviewDecision =
  | "sample-pass"
  | "full-review"
  | "reocr";

export interface SampleJudgement {
  documentId: string;
  unitCount: number;
  sampleSize: number;
  indices: number[];
  damagedCount: number;
  ocrIllegibleCount: number;
  editorialDamagedCount: number;
  damagedRate: number;
  ocrIllegibleRate: number;
  decision: ReviewDecision;
  needsFullReview: boolean;
  needsReocr: boolean;
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic mulberry32 from documentId. */
export function seededRng(documentId: string): () => number {
  let a = hashSeed(documentId) || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sampleSizeFor(unitCount: number): number {
  if (unitCount <= 0) return 0;
  if (unitCount < SAMPLE_MIN) return unitCount;
  const fivePct = Math.ceil(unitCount * SAMPLE_PCT);
  return Math.min(SAMPLE_MAX, Math.max(SAMPLE_MIN, fivePct));
}

/**
 * Stratified indices: first, middle, last, then unique random fills.
 * Always sorted ascending. Deterministic for a given documentId.
 */
export function planSample(documentId: string, unitCount: number): SamplePlan {
  const n = sampleSizeFor(unitCount);
  const picked = new Set<number>();
  if (unitCount <= 0) {
    return { documentId, unitCount, sampleSize: 0, indices: [] };
  }
  picked.add(0);
  picked.add(Math.floor((unitCount - 1) / 2));
  picked.add(unitCount - 1);
  const rng = seededRng(documentId);
  let guard = 0;
  while (picked.size < n && guard < unitCount * 20) {
    picked.add(Math.floor(rng() * unitCount));
    guard += 1;
  }
  if (picked.size < n) {
    for (let i = 0; i < unitCount && picked.size < n; i++) picked.add(i);
  }
  const indices = [...picked].sort((a, b) => a - b);
  return {
    documentId,
    unitCount,
    sampleSize: indices.length,
    indices,
  };
}

const UNICODE_LETTER = /\p{L}/gu;
const UNICODE_WORD = /\p{L}+/gu;
const CJK_LETTER =
  /\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Hangul}/gu;

function matchCount(re: RegExp, text: string): number {
  const m = text.match(re);
  return m ? m.length : 0;
}

/** Broken interpolation left in translated footnotes, e.g. `[+[0]+]`. */
const BROKEN_FOOTNOTE_TOKEN = /\[\+\[\d+\]\+\]/g;

export function repairBrokenFootnoteTokens(
  text: string,
  refs?: Array<{ descripcion?: string }>,
): string {
  const next = text.replace(/\[\+\[(\d+)\]\+\]/g, (_m, n: string) => {
    const d = refs?.[Number(n)]?.descripcion?.trim();
    return d || "";
  });
  return next
    .replace(/\(\s*\)/g, "")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/ +([,.;:])/g, "$1")
    .replace(/[ \t]{2,}/g, " ");
}

export function classifyUnitText(text: string): UnitVerdictKind {
  const t = (text || "").trim();
  // Empty slots and reviewed TOC placeholders are not presented as prose.
  if (!t || t === OCR_GARBAGE_PLACEHOLDER) return "ok";
  if (isGarbageUnit(t) || isDualColumnShredUnit(t)) {
    return "ocr_illegible";
  }
  // Residual-body heuristic matches Spanish "conocimiento" ([oncrim]{8,});
  // do not treat it as a sense verdict.
  if (t.includes("\uFFFD") && t.length > 20) return "ocr_illegible";
  if (/\[\+\[\d+\]\+\]/.test(t)) return "damaged_editorial";

  const letters = matchCount(UNICODE_LETTER, t);
  const words = t.match(UNICODE_WORD) || [];
  const cjk = matchCount(CJK_LETTER, t);
  const nonSpace = t.replace(/\s/g, "").length || 1;
  const letterRatio = letters / nonSpace;

  // CJK-dominant lines do not use spaces as word boundaries; "few words"
  // would false-positive every Chinese paragraph. Use density + diversity.
  if (letters > 0 && cjk >= letters * 0.4) {
    if (t.length > 40 && letterRatio < 0.35) return "damaged_editorial";
    const uniqueCjk = new Set(t.match(CJK_LETTER) || []);
    if (cjk > 30 && uniqueCjk.size <= 2) return "damaged_editorial";
    return "ok";
  }

  // Spaced scripts (Latin, Arabic, Devanagari, …): long run with almost
  // no word breaks is a shred, not prose.
  if (t.length > 40 && letters > 20 && words.length <= 2) {
    return "damaged_editorial";
  }
  if (t.length > 40 && letters === 0) return "ocr_illegible";
  return "ok";
}

export function judgeSample(
  documentId: string,
  unitTexts: string[],
  options?: { scanAll?: boolean },
): SampleJudgement {
  const unitCount = unitTexts.length;
  const plan = options?.scanAll
    ? {
        documentId,
        unitCount,
        sampleSize: unitCount,
        indices: unitTexts.map((_, i) => i),
      }
    : planSample(documentId, unitCount);

  let damagedCount = 0;
  let ocrIllegibleCount = 0;
  let editorialDamagedCount = 0;
  for (const i of plan.indices) {
    const kind = classifyUnitText(unitTexts[i] || "");
    if (kind === "ok") continue;
    damagedCount += 1;
    if (kind === "ocr_illegible") ocrIllegibleCount += 1;
    else editorialDamagedCount += 1;
  }

  const den = plan.indices.length || 1;
  const damagedRate = damagedCount / den;
  const ocrIllegibleRate = ocrIllegibleCount / den;
  const needsReocr = ocrIllegibleRate >= OCR_ILLEGIBLE_REOCR;
  const needsFullReview =
    !options?.scanAll && damagedRate > SAMPLE_DAMAGE_FULL_REVIEW;
  let decision: ReviewDecision = "sample-pass";
  if (needsReocr) decision = "reocr";
  else if (needsFullReview || (options?.scanAll && damagedRate > SAMPLE_DAMAGE_FULL_REVIEW)) {
    decision = "full-review";
  }

  return {
    documentId,
    unitCount,
    sampleSize: plan.indices.length,
    indices: plan.indices,
    damagedCount,
    ocrIllegibleCount,
    editorialDamagedCount,
    damagedRate: Math.round(damagedRate * 10000) / 10000,
    ocrIllegibleRate: Math.round(ocrIllegibleRate * 10000) / 10000,
    decision,
    needsFullReview,
    needsReocr,
  };
}

/** Estimate pack OK-rate from a full heuristic scan (cheap campaign metric). */
export function heuristicOkRate(unitTexts: string[]): number {
  if (!unitTexts.length) return 1;
  let ok = 0;
  for (const t of unitTexts) {
    if (classifyUnitText(t) === "ok") ok += 1;
  }
  return ok / unitTexts.length;
}
