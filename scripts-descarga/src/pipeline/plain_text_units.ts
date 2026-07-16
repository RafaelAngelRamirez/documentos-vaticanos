/**
 * Convert cleaned plain text into TransportData units for the corpus pipeline.
 * Used for patristic (and other offline) sources that are not HTML scrapes.
 */

import type { TrasnportData } from "../../models/transport_data.model";
import { repairOcrPunctuation } from "./repair_ocr_punctuation";

export type PlainSplitMode =
  | "paragraphs"
  | "roman-chapters"
  | "numbered-sections"
  | "lines"
  /** Council canons: "Canon 1", "Can. I", "CANON II", etc. */
  | "canons"
  /** Session / sessionem headings for long council acta */
  | "sessions";

export interface PlainTextParseOptions {
  mode?: PlainSplitMode;
  /** Drop units shorter than this (after trim). Default 20. */
  minLength?: number;
  /** If true, consecutivo is sequential "1"…"n". Default true. */
  sequentialConsecutivo?: boolean;
  /**
   * When mode is numbered-sections, also treat lines like
   * "CATEQUESIS III" / "LIBRO I" as section breaks (heading unit).
   */
  captureHeadings?: boolean;
  /**
   * Max characters per unit; longer chunks are sentence-split.
   * 0 disables. Default 2500.
   */
  maxUnitLength?: number;
}

const DEFAULTS: Required<PlainTextParseOptions> = {
  mode: "paragraphs",
  minLength: 20,
  sequentialConsecutivo: true,
  captureHeadings: true,
  maxUnitLength: 2500,
};

const ROMAN_CHAPTER =
  /(?=^(?:[IVXLCDM]+)\.\s+\S)/m;

const NUMBERED_PARA =
  /(?=^\d{1,3}\.\s+\S)/m;

const HEADING_LINE =
  /^(?:PROCATEQUESIS|CATEQUESIS\s+[IVXLCDM0-9]+|LIBRO\s+[IVXLCDM0-9]+|HOMIL[ÍI]A\s+\d+|SERM[ÓO]N\s+\d+|CARTA\s+\d+|CAP[ÍI]TULO\s+[IVXLCDM0-9]+)\b.*$/im;

/** Start of a council canon or session block (lookahead for split). */
const CANON_START =
  /(?=^(?:Canon|Canones|Can\.?|CANON|CANONES|Sessio|Session|SESSIO|SESSION)\s+\S)/im;

/** Session / sessio headings in long acta. */
const SESSION_START =
  /(?=^(?:Sessio|Session|SESSIO|SESSION)\s+\S)/im;

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/** Join PDF hyphenation at line breaks: "pala-\nbra" → "palabra". */
export function rejoinHyphenation(text: string): string {
  return text.replace(/(\p{L})-\n(\p{L})/gu, "$1$2");
}

/** Collapse runs of spaces; keep paragraph breaks. */
export function softNormalize(text: string): string {
  return normalizeNewlines(text)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/**
 * softNormalize + mechanical OCR punctuation spacing repair.
 * Prefer for OCR/PDF-derived clean texts before unit split / import.
 */
export function softNormalizeWithOcrPunct(text: string): string {
  return softNormalize(repairOcrPunctuation(text));
}

/**
 * Remove common PDF chrome (page numbers alone, "PÁGINA ABIERTA", journal footers).
 * Conservative — only drop obvious noise lines.
 */
export function stripPdfChrome(text: string): string {
  let t = normalizeNewlines(text);
  // multi-line chrome (e.g. "PÁGINA\nABIERTA")
  t = t.replace(/PÁGINA\s*\n\s*ABIERTA/gi, "");
  t = t.replace(/PÁGINA\s+ABIERTA[^\n]*/gi, "");
  const lines = t.split("\n");
  const out: string[] = [];
  for (const line of lines) {
    const s = line.trim();
    if (!s) {
      out.push("");
      continue;
    }
    if (/^PÁGINA\s*ABIERTA/i.test(s)) continue;
    if (/^IGLESIA\s+VIVA/i.test(s)) continue;
    if (/^ISSN\./i.test(s)) continue;
    if (/^Nª\s+\d+/i.test(s)) continue;
    if (/^pp\.\s*\d+/i.test(s)) continue;
    if (/^©\s/i.test(s)) continue;
    if (/iviva\.org/i.test(s)) continue;
    // lone page number
    if (/^\d{1,4}$/.test(s)) continue;
    // "124 [237] iviva.org" style
    if (/^\d+\s*\[\d+\]/.test(s)) continue;
    // Gredos/BAC running headers that are just the author name on a line
    if (/^BIBLIOTECA CL[ÁA]SICA GREDOS/i.test(s)) continue;
    out.push(line);
  }
  return out.join("\n");
}

/**
 * If a chunk is very long, split on sentence boundaries to keep reader units manageable.
 */
export function capUnitLength(chunks: string[], maxLen = 2500): string[] {
  const out: string[] = [];
  for (const chunk of chunks) {
    if (chunk.length <= maxLen) {
      out.push(chunk);
      continue;
    }
    // Prefer split on ". " followed by capital / digit
    const sentences = chunk.split(/(?<=[.!?…»"])\s+(?=[A-ZÁÉÍÓÚÜÑ¿¡\d«"])/);
    let buf = "";
    for (const s of sentences) {
      if (!buf) {
        buf = s;
      } else if (buf.length + 1 + s.length <= maxLen) {
        buf = `${buf} ${s}`;
      } else {
        out.push(buf.trim());
        buf = s;
      }
    }
    if (buf.trim()) out.push(buf.trim());
  }
  return out;
}

function toUnits(
  chunks: string[],
  minLength: number,
  sequential: boolean,
): TrasnportData[] {
  const units: TrasnportData[] = [];
  let n = 0;
  for (const raw of chunks) {
    const contenido = softNormalize(raw);
    if (contenido.length < minLength) continue;
    n += 1;
    // Prefer leading "12. " as consecutivo when sequential is off or when present
    const m = contenido.match(/^(\d+)\.\s+/);
    const consecutivo =
      sequential || !m ? String(n) : m[1];
    units.push({
      consecutivo,
      contenido,
      referencias: [],
    });
  }
  return units;
}

function splitParagraphs(text: string): string[] {
  return softNormalize(text)
    .split(/\n\s*\n+/)
    .map((p) => p.replace(/\n/g, " ").trim())
    .filter(Boolean);
}

/**
 * Split on Roman chapter headers: "I. EXORDIO", "XI. EPÍLOGO".
 * First chunk before the first header is kept if substantial (front matter).
 */
function splitRomanChapters(text: string): string[] {
  const t = softNormalize(text);
  const parts = t.split(ROMAN_CHAPTER);
  const chunks: string[] = [];
  for (const p of parts) {
    const cleaned = p.trim();
    if (!cleaned) continue;
    // Prefer paragraph split inside each chapter
    const paras = splitParagraphs(cleaned);
    if (paras.length === 0) continue;
    // Merge very short trailing fragments into previous
    for (const para of paras) {
      chunks.push(para);
    }
  }
  return chunks;
}

/**
 * Split on numbered paragraphs "1. …" and optional section headings.
 */
function splitNumberedSections(text: string, captureHeadings: boolean): string[] {
  let t = softNormalize(text);
  // Insert blank lines before headings so they become their own units
  if (captureHeadings) {
    t = t
      .split("\n")
      .map((line) => {
        if (HEADING_LINE.test(line.trim())) {
          return `\n\n${line.trim()}\n\n`;
        }
        return line;
      })
      .join("\n");
  }
  t = softNormalize(t);
  const byNumber = t.split(NUMBERED_PARA);
  const chunks: string[] = [];
  for (const part of byNumber) {
    const cleaned = part.trim();
    if (!cleaned) continue;
    // If part has multiple blank-line paragraphs without numbers, keep them
    if (!/^\d+\.\s/.test(cleaned) && cleaned.includes("\n\n")) {
      chunks.push(...splitParagraphs(cleaned));
    } else {
      chunks.push(cleaned.replace(/\n/g, " ").replace(/\s+/g, " ").trim());
    }
  }
  return chunks;
}

/**
 * Split on "Canon 1" / "Can. I" / "CANON II" blocks.
 * Leading material before the first canon (e.g. Symbolum) is kept as its own unit(s).
 */
function splitCanons(text: string): string[] {
  const t = softNormalize(text);
  const parts = t.split(CANON_START);
  const chunks: string[] = [];
  for (const part of parts) {
    const cleaned = part.trim();
    if (!cleaned) continue;
    // Canon body may still have blank-line paragraphs; keep as one unit per canon
    // unless the front matter (no "Canon" header) is multi-paragraph.
    if (
      /^(?:Canon|Canones|Can\.?|CANON|CANONES|Sessio|Session)\s+/i.test(cleaned)
    ) {
      chunks.push(cleaned.replace(/\n+/g, " ").replace(/\s+/g, " ").trim());
    } else {
      // Prefatory symbol / intro: one unit per blank-line paragraph
      chunks.push(...splitParagraphs(cleaned));
    }
  }
  return chunks;
}

/**
 * Split on Sessio / Session N headings; fall back to paragraphs inside.
 */
function splitSessions(text: string): string[] {
  const t = softNormalize(text);
  const parts = t.split(SESSION_START);
  const chunks: string[] = [];
  for (const part of parts) {
    const cleaned = part.trim();
    if (!cleaned) continue;
    if (/^(?:Sessio|Session)\s+/i.test(cleaned)) {
      chunks.push(cleaned.replace(/\n+/g, " ").replace(/\s+/g, " ").trim());
    } else {
      chunks.push(...splitParagraphs(cleaned));
    }
  }
  return chunks;
}

/**
 * Prefer consecutivo from "Canon 6" / "1." when present.
 */
function toUnitsWithLabels(
  chunks: string[],
  minLength: number,
  sequential: boolean,
  mode: PlainSplitMode,
): TrasnportData[] {
  if (mode !== "canons") {
    return toUnits(chunks, minLength, sequential);
  }
  const units: TrasnportData[] = [];
  let n = 0;
  for (const raw of chunks) {
    const contenido = softNormalize(raw);
    if (contenido.length < minLength) continue;
    n += 1;
    const canonM = contenido.match(
      /^(?:Canon|Canones|Can\.?|CANON|CANONES)\s+([IVXLCDM]+|\d+)\b/i,
    );
    const sessM = contenido.match(
      /^(?:Sessio|Session)\s+([IVXLCDM]+|\d+|[^\s:]+)/i,
    );
    const numM = contenido.match(/^(\d+)\.\s+/);
    let consecutivo: string;
    if (!sequential && canonM) {
      consecutivo = canonM[1];
    } else if (!sequential && sessM) {
      consecutivo = sessM[1];
    } else if (!sequential && numM) {
      consecutivo = numM[1];
    } else if (canonM) {
      const label = canonM[1];
      consecutivo = /^\d+$/.test(label) ? label : String(n);
    } else {
      consecutivo = String(n);
    }
    units.push({
      consecutivo,
      contenido,
      referencias: [],
    });
  }
  return units;
}

/**
 * Parse cleaned plain text into corpus units.
 */
export function plainTextToUnits(
  text: string,
  options: PlainTextParseOptions = {},
): TrasnportData[] {
  const opts = { ...DEFAULTS, ...options };
  let prepared = stripPdfChrome(text);
  prepared = rejoinHyphenation(prepared);
  prepared = softNormalize(prepared);
  // Mechanical OCR punct fix after soft normalize so unit contenido is cleaner
  prepared = repairOcrPunctuation(prepared);
  prepared = softNormalize(prepared);

  let chunks: string[];
  switch (opts.mode) {
    case "roman-chapters":
      chunks = splitRomanChapters(prepared);
      break;
    case "numbered-sections":
      chunks = splitNumberedSections(prepared, opts.captureHeadings);
      break;
    case "canons":
      chunks = splitCanons(prepared);
      break;
    case "sessions":
      chunks = splitSessions(prepared);
      break;
    case "lines":
      chunks = prepared.split("\n").map((l) => l.trim()).filter(Boolean);
      break;
    case "paragraphs":
    default:
      chunks = splitParagraphs(prepared);
      break;
  }

  if (opts.maxUnitLength > 0) {
    chunks = capUnitLength(chunks, opts.maxUnitLength);
  }

  return toUnitsWithLabels(
    chunks,
    opts.minLength,
    opts.sequentialConsecutivo,
    opts.mode,
  );
}
