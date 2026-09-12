/**
 * Extract citation-like windows from unit prose and turn them into
 * referencias.descripcion strings the existing resolver understands.
 *
 * Does not rewrite contenido. Caps + parseRefGroup keep OCR noise out.
 */

import {
  parseRefGroup,
  type BookIndex,
  type DocIndex,
  type ParsedAtom,
} from "./ref-parser";

export const HARVEST_KINDS = new Set([
  "magisterium",
  "catechism",
  "council",
  "canon-law",
]);

const MAX_NEW_PER_UNIT = 8;
const MAX_DESC = 80;

export function stripHtml(text: string): string {
  return String(text || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function foldDesc(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^(?:cf\.?|véase|vease)\s+/i, "")
    .replace(/[.]/g, "")
    .trim();
}

/** Candidate windows: parentheticals, cf. Book, ecclesial CODE N. */
export function extractCiteCandidateStrings(text: string): string[] {
  const plain = stripHtml(text);
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string) => {
    const t = raw.replace(/\s+/g, " ").trim();
    if (t.length < 4 || t.length > MAX_DESC) return;
    const k = foldDesc(t);
    if (!k || seen.has(k)) return;
    seen.add(k);
    out.push(t);
  };

  const reParens = /\(([^()]{3,80})\)/g;
  let m: RegExpExecArray | null;
  while ((m = reParens.exec(plain))) push(m[1]);

  const reCf =
    /\b(?:cf\.?|véase|vease)\s+\d{0,1}\s*[A-Za-zÁÉÍÓÚáéíóúñÑ.]{1,16}[.,]?\s+\d{1,3}(?:\s*[,:]\s*[\d.\-–—\s]{0,24})?/gi;
  while ((m = reCf.exec(plain))) push(m[0]);

  const reEcc =
    /\b(?:CIC|CEC|LG|GS|DV|SC|AA|AG|CD|OT|PC|PO|UR|NA|DH|GE|IM|CCEO|CDC|CDS|DS|HV|EN|FC|CA|VS|EV|EE|RM|NMI|PDV)\s+\d{1,4}[a-z]?\b/g;
  while ((m = reEcc.exec(plain))) push(m[0]);

  return out;
}

export function atomsAreResolvable(atoms: ParsedAtom[]): boolean {
  return atoms.some((a) => {
    if (a.kind === "bible") {
      const c = a.citation;
      return Boolean(c.bookSlug && (c.chapter > 0 || c.verseStart > 0 || c.verseOnly));
    }
    if (a.kind === "ecclesial") {
      return Boolean(a.citation.corpusDocId && a.citation.locator);
    }
    return false;
  });
}

export function harvestNewDescriptions(
  contenido: string,
  existing: Array<{ descripcion?: string }>,
  bookIndex: BookIndex,
  docIndex: DocIndex,
  maxNew = MAX_NEW_PER_UNIT,
): string[] {
  const have = new Set(
    (existing || [])
      .map((r) => foldDesc(String(r?.descripcion || "")))
      .filter(Boolean),
  );
  const added: string[] = [];
  for (const cand of extractCiteCandidateStrings(contenido)) {
    if (added.length >= maxNew) break;
    const key = foldDesc(cand);
    if (have.has(key)) continue;
    const atoms = parseRefGroup(cand, { bookIndex, docIndex });
    if (!atomsAreResolvable(atoms)) continue;
    have.add(key);
    added.push(cand);
  }
  return added;
}
