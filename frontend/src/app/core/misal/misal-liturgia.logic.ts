/**
 * Misal / liturgia pack helpers (IGMR + Paul VI Missale Romanum APC).
 * Pure functions — no Angular DI; safe for Node structural tests.
 *
 * Full altar Missal propers are NOT on vatican.va as free HTML; we ship only
 * free texts (IGMR + 1969 constitution) with stable documentIds.
 */

/** Corpus id prefixes for missal-related packs (≠ rm-es Redemptoris Missio). */
export const MISAL_IGMR_PREFIX = 'igmr-';
export const MISAL_APC_PREFIX = 'missale-romanum-apc-';

export interface MisalDocMeta {
  id: string;
  title?: string;
  shortTitle?: string;
  locale?: string;
  unitCount?: number;
  sourceUrl?: string;
  sourceNote?: string;
  kind?: string;
}

/** True when meta is an IGMR / GIRM pack. */
export function isIgmrDocument(meta: MisalDocMeta | null | undefined): boolean {
  if (!meta?.id) return false;
  return (
    meta.id.startsWith(MISAL_IGMR_PREFIX) ||
    /^igmr[-_]/i.test(meta.id)
  );
}

/** True when meta is the 1969 Missale Romanum apostolic constitution pack. */
export function isMissaleRomanumApcDocument(
  meta: MisalDocMeta | null | undefined,
): boolean {
  if (!meta?.id) return false;
  return meta.id.startsWith(MISAL_APC_PREFIX);
}

/** Any shipped missal-related free text from vatican.va (IGMR or APC). */
export function isMisalLiturgiaDocument(
  meta: MisalDocMeta | null | undefined,
): boolean {
  return isIgmrDocument(meta) || isMissaleRomanumApcDocument(meta);
}

/**
 * List missal packs present in a catalog (manifest documents).
 * Filters unitCount > 0 so empty shells never surface.
 */
export function listMisalLiturgiaDocuments(
  docs: MisalDocMeta[] | null | undefined,
): MisalDocMeta[] {
  if (!docs?.length) return [];
  return docs.filter(
    (d) => isMisalLiturgiaDocument(d) && (d.unitCount ?? 0) > 0,
  );
}

/** Prefer order when content locale is missing for a family. */
const LOCALE_FALLBACK = [
  'es',
  'en',
  'la',
  'it',
  'fr',
  'pt',
  'de',
  'zh',
  'hi',
  'ar',
];

function localeOf(meta: MisalDocMeta): string {
  if (meta.locale) return meta.locale.toLowerCase();
  const m = meta.id.match(/-([a-z]{2})$/i);
  return m ? m[1].toLowerCase() : '';
}

/**
 * Pick one document from a family by preferred content locale + fallbacks.
 */
export function pickPreferredMisalDoc(
  family: MisalDocMeta[],
  preferredLocale: string,
): MisalDocMeta | null {
  if (!family.length) return null;
  const pref = (preferredLocale || 'es').toLowerCase();
  const byLoc = new Map(family.map((d) => [localeOf(d), d]));
  if (byLoc.has(pref)) return byLoc.get(pref)!;
  for (const loc of LOCALE_FALLBACK) {
    if (byLoc.has(loc)) return byLoc.get(loc)!;
  }
  return family[0];
}

/**
 * Primary entry for Inicio / calendar: prefer IGMR for the user's content
 * locale; if none, fall back to any APC pack.
 */
export function pickPrimaryMisalEntry(
  docs: MisalDocMeta[] | null | undefined,
  preferredLocale: string,
): MisalDocMeta | null {
  const all = listMisalLiturgiaDocuments(docs);
  if (!all.length) return null;
  const igmr = all.filter(isIgmrDocument);
  const apc = all.filter(isMissaleRomanumApcDocument);
  return (
    pickPreferredMisalDoc(igmr, preferredLocale) ||
    pickPreferredMisalDoc(apc, preferredLocale)
  );
}

/**
 * Secondary entry (constitution) when primary is IGMR — same locale preference.
 * Returns null if no APC pack or if primary is already APC.
 */
export function pickSecondaryMisalEntry(
  docs: MisalDocMeta[] | null | undefined,
  preferredLocale: string,
  primary: MisalDocMeta | null,
): MisalDocMeta | null {
  if (!primary || isMissaleRomanumApcDocument(primary)) return null;
  const apc = listMisalLiturgiaDocuments(docs).filter(
    isMissaleRomanumApcDocument,
  );
  return pickPreferredMisalDoc(apc, preferredLocale);
}

/** Human eyebrow for product UI (Spanish chrome default). */
export function misalBlockTitle(): string {
  return 'Misal y liturgia';
}

/** Short blurb under the block title. */
export function misalBlockLede(): string {
  return 'Instrucción general del Misal Romano y constitución Missale Romanum (textos libres de vatican.va).';
}

/** CTA label for opening the pack cover / reader. */
export function misalReadCtaLabel(meta: MisalDocMeta | null): string {
  if (!meta) return 'Leer';
  if (isIgmrDocument(meta)) return 'Leer la IGMR';
  return 'Leer la constitución';
}

/** Listen CTA (same as other fichas). */
export function misalListenCtaLabel(): string {
  return '▶ Escuchar';
}
