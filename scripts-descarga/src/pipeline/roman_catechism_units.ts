/**
 * Clean OCR / plain Latin (or Spanish) Roman Catechism text into corpus units.
 *
 * Consecutivo hierarchy matches CIC footnotes:
 *   "Catecismo Romano, 1,2,2" → consecutivo "1.2.2"
 *   Prefacio sections → "pref.N"
 *
 * OCR is expected noisy (Archive.org DjVuTXT); we rejoin hyphens, drop chrome,
 * and split on numbered questions under PARS / CAPUT headings.
 */

import type { TrasnportData } from "../../models/transport_data.model";
import {
  rejoinHyphenation,
  softNormalizeWithOcrPunct,
  stripPdfChrome,
} from "./plain_text_units";
import { collapseSpacedLetters } from "./repair_ocr_noise";

const PARS_RE =
  /^PARS\s+(PRIMA|SECUNDA|TERTIA|QUARTA|I|II|III|IV)\b\.?/i;
const CAPUT_RE =
  /^(?:CAPUT|CAP\.?)\s*([IVXLC1-9]+|[ILV]+)\b\.?/i;
const SECTION_RE = /^(\d{1,3})\.\s+(\S[\s\S]*)$/;
const PREF_RE = /^(?:PR[AÆE]FATIO|PREFACIO|PROOEMIUM|PROEMIUM)\b/i;

const PARS_NUM: Record<string, number> = {
  prima: 1,
  i: 1,
  "1": 1,
  secunda: 2,
  ii: 2,
  "2": 2,
  tertia: 3,
  iii: 3,
  "3": 3,
  quarta: 4,
  iv: 4,
  "4": 4,
};

/** Common OCR Roman numeral repairs for CAPUT headers. */
function normalizeRomanToken(raw: string): string {
  let t = raw.toUpperCase().replace(/[^IVXLC0-9]/g, "");
  // CAPUT IL / I. → I
  t = t.replace(/^IL$/i, "I").replace(/^I\.?$/, "I");
  t = t.replace(/^IIL$/i, "III").replace(/^II\.?$/, "II");
  t = t.replace(/^VIL$/i, "VII").replace(/^VIL$/i, "VII");
  t = t.replace(/^VIIL$/i, "VIII");
  t = t.replace(/^IXL$/i, "IX");
  t = t.replace(/^XL$/i, "X");
  // digit forms
  if (/^\d+$/.test(t)) return t;
  return t;
}

function romanToInt(r: string): number {
  const s = normalizeRomanToken(r);
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  const map: Record<string, number> = {
    I: 1,
    V: 5,
    X: 10,
    L: 50,
    C: 100,
  };
  let n = 0;
  let prev = 0;
  for (let i = s.length - 1; i >= 0; i--) {
    const v = map[s[i]] ?? 0;
    if (v < prev) n -= v;
    else n += v;
    prev = v;
  }
  return n || 0;
}

/**
 * Aggressive OCR cleanup for Archive.org DjVuTXT of Catechismus Romanus.
 */
export function cleanRomanCatechismOcr(raw: string): string {
  let t = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Drop obvious front-matter until first real PARS PRIMA body block
  // Prefer the second/later "PARS PRIMA" when TOC exists first.
  const parsHits = [...t.matchAll(/^PARS\s+PRIMA\b/gim)];
  if (parsHits.length >= 2 && parsHits[1].index != null) {
    t = t.slice(parsHits[1].index);
  } else if (parsHits.length === 1 && parsHits[0].index != null) {
    // keep from first if only one
    const idx = parsHits[0].index;
    // if very early with little content before, use it; else still use it
    t = t.slice(idx);
  }

  t = stripPdfChrome(t);
  t = rejoinHyphenation(t);

  // Drop lines that are mostly OCR litter (only punctuation / single chars)
  const lines = t.split("\n");
  const kept: string[] = [];
  for (const line of lines) {
    const s = line.trim();
    if (!s) {
      kept.push("");
      continue;
    }
    // pure ornaments
    if (/^[~\-–—_=.'`“”"«»•·,;:|*+]+$/.test(s)) continue;
    if (/^[A-Za-z]\s+([A-Za-z]\s+){2,}[A-Za-z]?$/.test(s)) continue; // spaced letters
    if (s.length <= 2 && !/^\d+$/.test(s)) continue;
    // page headers like "DE PRIMO SYMB. ARTIC. 15"
    if (/^DE\s+PRIMO\.?\s+SYMB/i.test(s) && s.length < 40) continue;
    kept.push(line);
  }
  t = kept.join("\n");

  t = collapseSpacedLetters(t);
  t = softNormalizeWithOcrPunct(t);

  // Fix frequent CAPUT OCR: "CAPUT IL" → "CAPUT I."
  t = t.replace(/^CAPUT\s+IL\b\.?/gim, "CAPUT I.");
  t = t.replace(/^CAP\.\s*IL\b\.?/gim, "CAP. I.");
  t = t.replace(/^CAPUT\s+IIL\b\.?/gim, "CAPUT III.");
  t = t.replace(/^CAPUT\s+VIL\b\.?/gim, "CAPUT VII.");
  t = t.replace(/^CAPUT\s+VIIL\b\.?/gim, "CAPUT VIII.");

  return t.trim();
}

export interface RomanCatechismParseOptions {
  /** Minimum body length for a unit (default 30). */
  minLength?: number;
  /** Max unit chars before soft sentence split (0 = off). Default 3000. */
  maxUnitLength?: number;
}

/**
 * Parse cleaned Roman Catechism text into TransportData units.
 */
export function romanCatechismToUnits(
  cleanedText: string,
  options: RomanCatechismParseOptions = {},
): TrasnportData[] {
  const minLength = options.minLength ?? 30;
  const maxUnitLength = options.maxUnitLength ?? 3000;

  const text = cleanedText.replace(/\r\n/g, "\n");
  // Split into blocks on blank lines after normalizing
  const lines = text.split("\n");

  let part = 0;
  let chapter = 0;
  let section = 0;
  let inPreface = false;
  let pendingTitle = "";
  const units: TrasnportData[] = [];

  let buf: string[] = [];

  const flushSection = (forceConsec?: string) => {
    const body = buf.join(" ").replace(/\s+/g, " ").trim();
    buf = [];
    if (body.length < minLength) return;
    let consec =
      forceConsec ??
      (inPreface
        ? `pref.${section || units.length + 1}`
        : part > 0 && chapter > 0 && section > 0
          ? `${part}.${chapter}.${section}`
          : part > 0 && chapter > 0
            ? `${part}.${chapter}`
            : part > 0
              ? `${part}`
              : `u${units.length + 1}`);

    let contenido = pendingTitle
      ? `${pendingTitle}\n\n${body}`
      : body;
    pendingTitle = "";

    if (maxUnitLength > 0 && contenido.length > maxUnitLength) {
      // soft split long units keeping same consecutivo suffix
      const chunks = splitLong(contenido, maxUnitLength);
      chunks.forEach((chunk, i) => {
        units.push({
          consecutivo: i === 0 ? consec : `${consec}.${i + 1}`,
          contenido: chunk,
          referencias: [],
        });
      });
    } else {
      units.push({
        consecutivo: consec,
        contenido,
        referencias: [],
      });
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    if (!line) continue;

    const parsM = line.match(PARS_RE);
    if (parsM) {
      flushSection();
      inPreface = false;
      const key = parsM[1].toLowerCase();
      part = PARS_NUM[key] ?? romanToInt(parsM[1]);
      chapter = 0;
      section = 0;
      pendingTitle = `PARS ${parsM[1].toUpperCase()}`;
      continue;
    }

    if (PREF_RE.test(line) && part === 0) {
      flushSection();
      inPreface = true;
      part = 0;
      chapter = 0;
      section = 0;
      pendingTitle = line;
      continue;
    }

    const capM = line.match(CAPUT_RE);
    if (capM) {
      flushSection();
      inPreface = false;
      chapter = romanToInt(capM[1]);
      section = 0;
      // Include rest of line as title if present
      const rest = line.replace(CAPUT_RE, "").replace(/^\.\s*/, "").trim();
      pendingTitle = rest
        ? `CAPUT ${normalizeRomanToken(capM[1])}. ${rest}`
        : `CAPUT ${normalizeRomanToken(capM[1])}`;
      continue;
    }

    const secM = line.match(SECTION_RE);
    if (secM) {
      flushSection();
      section = parseInt(secM[1], 10);
      buf.push(secM[2]);
      continue;
    }

    // Heading-only DE … lines under a chapter
    if (/^DE\s+\S/i.test(line) && line.length < 120 && buf.length === 0) {
      pendingTitle = pendingTitle
        ? `${pendingTitle}\n${line}`
        : line;
      continue;
    }

    buf.push(line);
  }
  flushSection();

  // Ensure unique consecutivos
  const seen = new Map<string, number>();
  for (const u of units) {
    const n = (seen.get(u.consecutivo) ?? 0) + 1;
    seen.set(u.consecutivo, n);
    if (n > 1) u.consecutivo = `${u.consecutivo}~${n}`;
  }

  return units.filter((u) => u.contenido.trim().length >= minLength);
}

function splitLong(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const out: string[] = [];
  let rest = text;
  while (rest.length > max) {
    let cut = rest.lastIndexOf(". ", max);
    if (cut < max * 0.4) cut = rest.lastIndexOf(" ", max);
    if (cut < max * 0.3) cut = max;
    out.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) out.push(rest);
  return out;
}

/**
 * Labeled unit dump format used for Spanish twins and re-import:
 *
 *   1.1.1
 *   body paragraph…
 *
 *   1.1.2
 *   next body…
 *
 * Consecutivo is a lone line matching hierarchical ids (digits/dots/~pref).
 * This is the regenerable ES path — do NOT re-run PARS/CAPUT OCR parsing on it.
 */
const LABELED_ID_RE =
  /^(?:pref\.\d+|u\d+(?:\.\d+)?|[\d]+(?:\.[\d]+)*(?:~\d+)?)$/i;

export function isLabeledUnitDump(text: string): boolean {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let labeled = 0;
  let checked = 0;
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    checked++;
    if (LABELED_ID_RE.test(t)) labeled++;
    if (checked >= 40) break;
  }
  // ES dumps start with many consecutivo lines among first content lines
  return labeled >= 3 && labeled / Math.max(checked, 1) >= 0.15;
}

export function labeledUnitsToTransport(
  text: string,
  options: { minLength?: number } = {},
): TrasnportData[] {
  const minLength = options.minLength ?? 0;
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const units: TrasnportData[] = [];
  let currentId: string | null = null;
  let buf: string[] = [];

  const flush = () => {
    if (!currentId) {
      buf = [];
      return;
    }
    const contenido = buf.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    if (contenido.length >= minLength || minLength === 0) {
      // Keep empty-ish only if minLength 0 (caller may fill later)
      units.push({
        consecutivo: currentId,
        contenido,
        referencias: [],
      });
    }
    currentId = null;
    buf = [];
  };

  for (const line of lines) {
    const t = line.trimEnd();
    const id = t.trim();
    if (LABELED_ID_RE.test(id) && !id.includes(" ")) {
      // New unit id line
      flush();
      currentId = id;
      continue;
    }
    if (currentId != null) {
      buf.push(t);
    }
  }
  flush();
  return units;
}

/** Serialize units back to labeled dump (for clean/*-es.txt). */
export function transportToLabeledDump(units: TrasnportData[]): string {
  return units
    .map((u) => `${u.consecutivo}\n${(u.contenido || "").trim()}`)
    .join("\n\n")
    .trim() + "\n";
}
