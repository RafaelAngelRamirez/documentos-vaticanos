/**
 * Búsqueda offline por estantes.
 *
 * Un paquete es un índice invertido compacto (tabla de obras + postings en
 * varint). La consulta suma el df de los paquetes presentes y ordena con
 * BM25. El texto del corpus no se reescribe: el archivo sale de index.json
 * y el tf se cuenta al leer el fragmento que se va a pintar.
 *
 * node: bash scripts/node-strip-types.sh src/app/core/search/shelf-search.logic.test.js
 */

import {
  familyKey,
  isAiEdition,
  listSearchUniverse,
  type LocaleMeta,
} from '../corpus/document-locale.logic';
import { foldToken, tokenizeFolded } from './semantic-search.logic';

/** Constituciones, decretos y declaraciones. En el corpus el kind es magisterium. */
export const VATICAN_II: ReadonlySet<string> = new Set([
  'aa',
  'ag',
  'cd',
  'dh',
  'dv',
  'ge',
  'gs',
  'im',
  'lg',
  'na',
  'ot',
  'pc',
  'po',
  'sc',
  'ur',
]);

export const SHELF_STORAGE_KEY = 'dv.search.shelves.v1';

export interface ShelfDef {
  id: string;
  label: string;
  /** Encendido si la persona no guardó otra cosa. */
  defaultOn: boolean;
  /** Si está puesto, el chip solo existe cuando ese paquete está instalado. */
  packageId?: string;
}

/**
 * Orden de columnas. Las exhortaciones y el otro magisterio existen y
 * arrancan apagados: si se suman a las encíclicas, la columna deja de serlo.
 */
export const SHELVES: readonly ShelfDef[] = [
  { id: 'catecismo', label: 'Catecismo', defaultOn: true },
  { id: 'codigo', label: 'Código', defaultOn: true },
  { id: 'concilio', label: 'Concilios', defaultOn: true },
  { id: 'enciclica', label: 'Encíclicas', defaultOn: true },
  { id: 'padres', label: 'Padres', defaultOn: true, packageId: 'padres' },
  { id: 'biblia', label: 'Biblia', defaultOn: true },
  { id: 'exhortacion', label: 'Exhortaciones', defaultOn: false },
  { id: 'magisterio', label: 'Magisterio', defaultOn: false },
];

export const DEFAULT_SHELVES: readonly string[] = SHELVES.filter(
  (s) => s.defaultOn && !s.packageId,
).map((s) => s.id);

/**
 * Lemas medidos. Cada forma es una clave ya plegada del índice.
 * No entra el prefijo: «comuni» arrastra comunidad y «hosti» arrastra hostis.
 */
export const LEMAS: Readonly<
  Record<string, Readonly<Record<string, readonly string[]>>>
> = {
  es: {
    eucaristia: [
      'eucaristica',
      'eucaristico',
      'eucaristicas',
      'eucaristicos',
      'eucaristias',
    ],
  },
  en: {
    eucharist: ['eucharistic'],
  },
  la: {
    eucharistia: ['eucharistiae', 'eucharisticum'],
  },
};

/** Medias de la sonda del 27 oct. Si un estante no se pudo leer, sirven de respaldo. */
export const MEASURED_AVG_TOKENS: Readonly<Record<string, number>> = {
  catecismo: 75.6,
  codigo: 74.7,
  concilio: 83.8,
  enciclica: 122.6,
  padres: 181.8,
};

/**
 * La biblia española no usa «eucaristía». Estas dos alternativas están
 * medidas; pan, sangre, cuerpo y altar no se añaden solos.
 */
export const BIBLE_ALTERNATIVES: Readonly<
  Record<string, Readonly<Record<string, readonly { term: string; units: number }[]>>>
> = {
  es: {
    eucaristia: [
      { term: 'cena', units: 9 },
      { term: 'caliz', units: 17 },
    ],
  },
};

const MAGIC = [0x44, 0x56, 0x49, 0x58]; // DVIX
const FORMAT_VERSION = 1;

export interface ShelfDoc {
  id: string;
  shelf: string;
  official: boolean;
  ai: boolean;
  unitCount: number;
}

export interface TermPostings {
  df: number;
  groups: { docOrdinal: number; units: number[] }[];
}

export interface ShelfPackage {
  version: number;
  locale: string;
  packageId: string;
  docCount: number;
  avgTokens: Record<string, number>;
  docs: ShelfDoc[];
  terms: Map<string, TermPostings>;
}

export interface EncodeShelfPackageInput {
  locale: string;
  packageId: string;
  avgTokens: Record<string, number>;
  docs: ShelfDoc[];
  /** term → docOrdinal → unidades ascendentes. */
  terms: Map<string, Map<number, number[]>>;
}

export interface ShelfHit {
  documentId: string;
  unitIndex: number;
  shelf: string;
  official: boolean;
  ai: boolean;
  toc: boolean;
  score: number;
  via: 'palabra' | 'lema';
  matchedTerms: string[];
}

export interface ShelfCandidate {
  documentId: string;
  shelf: string;
  official: boolean;
  ai: boolean;
  unitIndex: number;
  matches: { term: string; via: 'palabra' | 'lema' }[];
}

export interface HydratedUnit {
  text: string;
  consecutivo?: string;
}

export { foldToken };

export function lemasDe(term: string, locale: string): string[] {
  const folded = foldToken(term);
  if (!folded) return [];
  const table = LEMAS[locale];
  const extra = table && table[folded] ? table[folded] : [];
  return [folded, ...extra];
}

/** Familia del lema, también si la persona escribió una forma y no la cabeza. */
export function expandQueryTerms(
  terms: readonly string[],
  locale: string,
): { term: string; via: 'palabra' | 'lema' }[] {
  const seen = new Map<string, 'palabra' | 'lema'>();
  const table = LEMAS[locale] || {};
  const reverse = new Map<string, string>();
  for (const [head, forms] of Object.entries(table)) {
    for (const form of forms) reverse.set(form, head);
  }
  for (const raw of terms) {
    const typed = foldToken(raw);
    if (!typed) continue;
    const head = table[typed] ? typed : reverse.get(typed);
    const family = head ? [head, ...(table[head] || [])] : [typed];
    for (const term of family) {
      const via: 'palabra' | 'lema' = term === typed ? 'palabra' : 'lema';
      const prev = seen.get(term);
      if (!prev || (prev === 'lema' && via === 'palabra')) seen.set(term, via);
    }
  }
  return [...seen.entries()].map(([term, via]) => ({ term, via }));
}

export function idf(nDocs: number, df: number): number {
  const n = nDocs > 0 ? nDocs : 1;
  const d = df > 0 ? df : 0;
  return Math.log(1 + (n - d + 0.5) / (d + 0.5));
}

export function bm25(
  tf: number,
  dl: number,
  avgdl: number,
  idfVal: number,
  k1 = 1.2,
  b = 0.75,
): number {
  const avg = avgdl > 0 ? avgdl : 1;
  const norm = 1 - b + b * ((dl > 0 ? dl : 1) / avg);
  const f = tf > 0 ? tf : 0;
  return (idfVal * (f * (k1 + 1))) / (f + k1 * norm);
}

export function tokenCount(text: string): number {
  return tokenizeFolded(foldToken(text)).length;
}

/**
 * Estante de una ficha del manifiesto.
 * Encíclica: la URL `/encyclicals/`, no la palabra en el título.
 * Concilio: kind council, o una familia del Vaticano II.
 */
export function shelfOf(meta: {
  id?: string;
  locale?: string | null;
  kind?: string | null;
  title?: string | null;
  sourceUrl?: string | null;
}): string {
  const url = String(meta?.sourceUrl || '').toLowerCase();
  const kind = meta?.kind;
  const family = familyKey(String(meta?.id || ''), meta?.locale);
  if (kind === 'catechism') return 'catecismo';
  if (kind === 'canon-law') return 'codigo';
  if (kind === 'council' || VATICAN_II.has(family)) return 'concilio';
  if (kind === 'patristic') return 'padres';
  if (kind === 'bible') return 'biblia';
  if (kind === 'magisterium') {
    if (url.includes('/encyclicals/')) return 'enciclica';
    if (url.includes('exhortations') || url.includes('esortazione')) {
      return 'exhortacion';
    }
    return 'magisterio';
  }
  return kind || 'otro';
}

export function packageIdForShelf(shelf: string): 'base' | 'padres' | null {
  if (shelf === 'padres') return 'padres';
  if (SHELVES.some((s) => s.id === shelf)) return 'base';
  return null;
}

export function termHasDigit(term: string): boolean {
  return /[0-9]/.test(term);
}

/** El paquete de Padres tira las claves con dígito (ruido de OCR). El texto no se toca. */
export function keepIndexTerm(term: string, packageId: string): boolean {
  if (!term || term.includes('\n') || term.includes('\t') || term.includes('\r')) {
    return false;
  }
  if (packageId === 'padres' && termHasDigit(term)) return false;
  return true;
}

/**
 * Una edición por familia, oficial sobre estudio, y sin traducciones de
 * estudio: esas entran solo si se instala su paquete.
 */
export function docsForPackage<T extends LocaleMeta>(
  metas: readonly T[],
  locale: string,
  packageId: 'base' | 'padres',
): T[] {
  const universe = listSearchUniverse(metas, locale, false);
  return universe
    .filter((meta) => {
      if (isAiEdition(meta)) return false;
      return packageIdForShelf(shelfOf(meta)) === packageId;
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function visibleShelves(packageIds: readonly string[]): ShelfDef[] {
  return SHELVES.filter(
    (shelf) => !shelf.packageId || packageIds.includes(shelf.packageId),
  );
}

export function defaultEnabledShelves(packageIds: readonly string[]): string[] {
  return visibleShelves(packageIds)
    .filter((shelf) => shelf.defaultOn)
    .map((shelf) => shelf.id);
}

export function resolveEnabledShelves(
  raw: string | null | undefined,
  packageIds: readonly string[],
): string[] {
  if (raw == null || raw === '') return defaultEnabledShelves(packageIds);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return defaultEnabledShelves(packageIds);
  }
  if (!Array.isArray(parsed)) return defaultEnabledShelves(packageIds);
  const allowed = new Set(visibleShelves(packageIds).map((shelf) => shelf.id));
  return parsed.filter(
    (id): id is string => typeof id === 'string' && allowed.has(id),
  );
}

export function bibleAlternatives(
  locale: string,
  foldedQuery: string,
): readonly { term: string; units: number }[] {
  const table = BIBLE_ALTERNATIVES[locale];
  if (!table) return [];
  return table[foldedQuery] || [];
}

export function emptyShelfMessage(
  shelf: string,
  foldedQuery: string,
  locale: string,
  packageIds: readonly string[],
): { message: string; alternatives: readonly { term: string; units: number }[] } {
  if (shelf === 'padres' && !packageIds.includes('padres')) {
    return {
      message: 'Estas obras no están en el aparato.',
      alternatives: [],
    };
  }
  if (shelf === 'biblia') {
    return {
      message: 'No hay ninguna unidad.',
      alternatives: bibleAlternatives(locale, foldedQuery),
    };
  }
  return { message: 'No hay ninguna unidad.', alternatives: [] };
}

/** Una línea de índice no ocupa el lugar de un pasaje. */
export function looksLikeIndexUnit(text: string): boolean {
  const raw = String(text || '').replace(/\s+/g, ' ').trim();
  if (!raw) return true;
  if (/(?:\.{4,}|…{2,})/.test(raw) && raw.length < 500) return true;
  const folded = foldToken(raw);
  if (/^(indice|index|tabla|sumario)\b/.test(folded) && raw.length < 600) {
    return true;
  }
  return false;
}

function officialRank(hit: { official?: boolean; ai?: boolean }): number {
  if (hit.official === true && hit.ai !== true) return 0;
  if (hit.official === false || hit.ai === true) return 1;
  return 0;
}

function adjustedScore(hit: { score?: number; toc?: boolean }): number {
  const base = Number(hit.score) || 0;
  if (hit.toc) return base * 0.15;
  return base;
}

export interface RankedShelf<T> {
  shelf: string;
  picked: T[];
  available: number;
}

/**
 * Una columna por estante.
 * Primero las ediciones oficiales, después las de estudio.
 * Como mucho `maxPerDoc` pasajes del mismo documento.
 * Un estante sin aciertos queda vacío.
 */
export function rankShelves<T extends ShelfHit>(
  hits: readonly T[],
  opts: {
    maxPerDoc?: number;
    maxPerShelf?: number;
    shelves?: readonly string[];
  } = {},
): RankedShelf<T>[] {
  const maxPerDoc = opts.maxPerDoc == null ? 2 : opts.maxPerDoc;
  const maxPerShelf = opts.maxPerShelf == null ? 3 : opts.maxPerShelf;
  const shelves = opts.shelves || DEFAULT_SHELVES;
  const by = new Map<string, T[]>(shelves.map((shelf) => [shelf, []]));
  for (const hit of hits || []) {
    if (!hit || !by.has(hit.shelf)) continue;
    by.get(hit.shelf)!.push(hit);
  }
  const out: RankedShelf<T>[] = [];
  for (const shelf of shelves) {
    const raw = by.get(shelf) || [];
    const usable = raw.some((hit) => !hit.toc)
      ? raw.filter((hit) => !hit.toc)
      : raw;
    const ranked = usable.slice().sort((a, b) => {
      const ao = officialRank(a);
      const bo = officialRank(b);
      if (ao !== bo) return ao - bo;
      const as = adjustedScore(a);
      const bs = adjustedScore(b);
      if (bs !== as) return bs - as;
      const id = String(a.documentId || '').localeCompare(
        String(b.documentId || ''),
      );
      if (id !== 0) return id;
      return (a.unitIndex || 0) - (b.unitIndex || 0);
    });
    const seen = new Map<string, number>();
    const capped: T[] = [];
    for (const hit of ranked) {
      const id = hit.documentId || '';
      const n = seen.get(id) || 0;
      if (n >= maxPerDoc) continue;
      seen.set(id, n + 1);
      capped.push(hit);
    }
    out.push({
      shelf,
      picked: capped.slice(0, maxPerShelf),
      available: capped.length,
    });
  }
  return out;
}

export function columnasPorEstante<T extends ShelfHit>(
  hits: readonly T[],
  opts: {
    maxPerDoc?: number;
    maxPerShelf?: number;
    shelves?: readonly string[];
  } = {},
): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const column of rankShelves(hits, opts)) out[column.shelf] = column.picked;
  return out;
}

export function corpusDf(
  packages: readonly ShelfPackage[],
  term: string,
): { n: number; df: number } {
  let n = 0;
  let df = 0;
  for (const pkg of packages) {
    n += pkg.docCount;
    df += pkg.terms.get(term)?.df || 0;
  }
  return { n, df };
}

export function collectCandidates(
  packages: readonly ShelfPackage[],
  query: readonly { term: string; via: 'palabra' | 'lema' }[],
  shelves: readonly string[],
): ShelfCandidate[] {
  const wanted = new Set(shelves);
  const byUnit = new Map<string, ShelfCandidate>();
  for (const pkg of packages) {
    for (const part of query) {
      const row = pkg.terms.get(part.term);
      if (!row) continue;
      for (const group of row.groups) {
        const doc = pkg.docs[group.docOrdinal];
        if (!doc || !wanted.has(doc.shelf)) continue;
        for (const unitIndex of group.units) {
          const key = `${doc.id}:${unitIndex}`;
          let slot = byUnit.get(key);
          if (!slot) {
            slot = {
              documentId: doc.id,
              shelf: doc.shelf,
              official: doc.official,
              ai: doc.ai,
              unitIndex,
              matches: [],
            };
            byUnit.set(key, slot);
          }
          if (!slot.matches.some((match) => match.term === part.term)) {
            slot.matches.push({ term: part.term, via: part.via });
          }
        }
      }
    }
  }
  return [...byUnit.values()];
}

/** Documentos a abrir: oficiales primero, y entre ellos los que más unidades traen. */
export function docsToHydrate(
  candidates: readonly ShelfCandidate[],
  maxPerShelf: number,
): string[] {
  const byShelf = new Map<string, Map<string, { official: boolean; n: number }>>();
  for (const hit of candidates) {
    let docs = byShelf.get(hit.shelf);
    if (!docs) {
      docs = new Map();
      byShelf.set(hit.shelf, docs);
    }
    const prev = docs.get(hit.documentId);
    if (prev) prev.n += 1;
    else docs.set(hit.documentId, { official: hit.official && !hit.ai, n: 1 });
  }
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const docs of byShelf.values()) {
    const ranked = [...docs.entries()].sort((a, b) => {
      const ao = a[1].official ? 0 : 1;
      const bo = b[1].official ? 0 : 1;
      if (ao !== bo) return ao - bo;
      if (b[1].n !== a[1].n) return b[1].n - a[1].n;
      return a[0].localeCompare(b[0]);
    });
    for (const [id] of ranked.slice(0, maxPerShelf)) {
      if (seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

function countTerm(tokens: readonly string[], term: string): number {
  let n = 0;
  for (const token of tokens) if (token === term) n += 1;
  return n;
}

export function scoreCandidates(
  candidates: readonly ShelfCandidate[],
  packages: readonly ShelfPackage[],
  texts: ReadonlyMap<string, HydratedUnit>,
): ShelfHit[] {
  const idfByTerm = new Map<string, number>();
  const avgByDoc = new Map<string, number>();
  for (const pkg of packages) {
    for (const doc of pkg.docs) {
      const measured = pkg.avgTokens[doc.shelf];
      avgByDoc.set(
        doc.id,
        measured && measured > 0
          ? measured
          : MEASURED_AVG_TOKENS[doc.shelf] || 80,
      );
    }
  }
  const out: ShelfHit[] = [];
  for (const hit of candidates) {
    const unit = texts.get(`${hit.documentId}:${hit.unitIndex}`);
    if (!unit) continue;
    const tokens = tokenizeFolded(foldToken(unit.text));
    const dl = tokens.length;
    let score = 0;
    const matched: string[] = [];
    let via: 'palabra' | 'lema' = 'lema';
    for (const match of hit.matches) {
      let idfVal = idfByTerm.get(match.term);
      if (idfVal == null) {
        const stats = corpusDf(packages, match.term);
        idfVal = idf(stats.n, stats.df);
        idfByTerm.set(match.term, idfVal);
      }
      const tf = Math.max(countTerm(tokens, match.term), 1);
      const weight = match.via === 'lema' ? 0.85 : 1;
      score += weight * bm25(tf, dl, avgByDoc.get(hit.documentId) || 80, idfVal);
      matched.push(match.term);
      if (match.via === 'palabra') via = 'palabra';
    }
    if (!(score > 0)) continue;
    out.push({
      documentId: hit.documentId,
      unitIndex: hit.unitIndex,
      shelf: hit.shelf,
      official: hit.official,
      ai: hit.ai,
      toc: looksLikeIndexUnit(unit.text),
      score,
      via,
      matchedTerms: matched,
    });
  }
  return out;
}

class ByteBuf {
  private buf = new Uint8Array(4096);
  private len = 0;

  private grow(extra: number): void {
    if (this.len + extra <= this.buf.length) return;
    let next = this.buf.length || 4096;
    while (next < this.len + extra) next *= 2;
    const copy = new Uint8Array(next);
    copy.set(this.buf.subarray(0, this.len));
    this.buf = copy;
  }

  u8(n: number): void {
    this.grow(1);
    this.buf[this.len++] = n & 0xff;
  }

  u16(n: number): void {
    this.u8(n & 0xff);
    this.u8((n >> 8) & 0xff);
  }

  u32(n: number): void {
    const tmp = new Uint8Array(4);
    new DataView(tmp.buffer).setUint32(0, n >>> 0, true);
    this.bytes(tmp);
  }

  f32(n: number): void {
    const tmp = new Uint8Array(4);
    new DataView(tmp.buffer).setFloat32(0, n, true);
    this.bytes(tmp);
  }

  bytes(arr: Uint8Array): void {
    this.grow(arr.length);
    this.buf.set(arr, this.len);
    this.len += arr.length;
  }

  str(value: string): void {
    const encoded = new TextEncoder().encode(value);
    if (encoded.length > 0xffff) throw new Error('cadena demasiado larga');
    this.u16(encoded.length);
    this.bytes(encoded);
  }

  varint(n: number): void {
    if (!Number.isInteger(n) || n < 0) throw new Error('varint');
    let rest = n;
    while (rest >= 0x80) {
      this.u8((rest & 0x7f) | 0x80);
      rest = Math.floor(rest / 128);
    }
    this.u8(rest);
  }

  finish(): Uint8Array {
    return this.buf.slice(0, this.len);
  }
}

class Reader {
  private i = 0;
  private view: DataView;
  private buf: Uint8Array;

  constructor(buf: Uint8Array) {
    this.buf = buf;
    this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  }

  u8(): number {
    if (this.i >= this.buf.length) throw new Error('fin de archivo');
    return this.buf[this.i++];
  }

  u16(): number {
    const n = this.u8() | (this.u8() << 8);
    return n;
  }

  u32(): number {
    if (this.i + 4 > this.buf.length) throw new Error('fin de archivo');
    const n = this.view.getUint32(this.i, true);
    this.i += 4;
    return n;
  }

  f32(): number {
    if (this.i + 4 > this.buf.length) throw new Error('fin de archivo');
    const n = this.view.getFloat32(this.i, true);
    this.i += 4;
    return n;
  }

  str(): string {
    const n = this.u16();
    if (this.i + n > this.buf.length) throw new Error('fin de archivo');
    const text = new TextDecoder().decode(this.buf.subarray(this.i, this.i + n));
    this.i += n;
    return text;
  }

  varint(): number {
    let result = 0;
    let shift = 0;
    for (;;) {
      const byte = this.u8();
      result += (byte & 0x7f) * 2 ** shift;
      if ((byte & 0x80) === 0) return result;
      shift += 7;
      if (shift > 35) throw new Error('varint largo');
    }
  }
}

export function encodeShelfPackage(input: EncodeShelfPackageInput): Uint8Array {
  const buf = new ByteBuf();
  for (const byte of MAGIC) buf.u8(byte);
  buf.u8(FORMAT_VERSION);
  buf.str(input.locale);
  buf.str(input.packageId);
  buf.u32(input.docs.length);
  const shelves = Object.keys(input.avgTokens).sort();
  buf.u16(shelves.length);
  for (const shelf of shelves) {
    buf.str(shelf);
    buf.f32(input.avgTokens[shelf] || 0);
  }
  buf.u32(input.docs.length);
  for (const doc of input.docs) {
    buf.str(doc.id);
    buf.str(doc.shelf);
    buf.u8((doc.official ? 1 : 0) | (doc.ai ? 2 : 0));
    buf.u32(doc.unitCount || 0);
  }
  const terms = [...input.terms.keys()].filter(Boolean).sort();
  buf.u32(terms.length);
  for (const term of terms) {
    const groups = input.terms.get(term);
    if (!groups) continue;
    const ordinals = [...groups.keys()].sort((a, b) => a - b);
    buf.str(term);
    buf.u32(ordinals.length);
    buf.varint(ordinals.length);
    for (const ordinal of ordinals) {
      const units = [...new Set(groups.get(ordinal) || [])]
        .filter((n) => Number.isInteger(n) && n >= 0)
        .sort((a, b) => a - b);
      buf.varint(ordinal);
      buf.varint(units.length);
      let prev = 0;
      for (const unit of units) {
        buf.varint(unit - prev);
        prev = unit;
      }
    }
  }
  return buf.finish();
}

export function decodeShelfPackage(raw: Uint8Array): ShelfPackage {
  const reader = new Reader(raw);
  for (const byte of MAGIC) {
    if (reader.u8() !== byte) throw new Error('no es un índice de estante');
  }
  const version = reader.u8();
  if (version !== FORMAT_VERSION) throw new Error('versión de índice desconocida');
  const locale = reader.str();
  const packageId = reader.str();
  const docCount = reader.u32();
  const shelfCount = reader.u16();
  const avgTokens: Record<string, number> = {};
  for (let i = 0; i < shelfCount; i++) {
    const shelf = reader.str();
    avgTokens[shelf] = reader.f32();
  }
  const declared = reader.u32();
  if (declared !== docCount) throw new Error('cabecera de obras inconsistente');
  const docs: ShelfDoc[] = [];
  for (let i = 0; i < docCount; i++) {
    const id = reader.str();
    const shelf = reader.str();
    const flags = reader.u8();
    const unitCount = reader.u32();
    docs.push({
      id,
      shelf,
      official: (flags & 1) === 1,
      ai: (flags & 2) === 2,
      unitCount,
    });
  }
  const termCount = reader.u32();
  const terms = new Map<string, TermPostings>();
  for (let i = 0; i < termCount; i++) {
    const term = reader.str();
    const df = reader.u32();
    const groupsN = reader.varint();
    const groups: { docOrdinal: number; units: number[] }[] = [];
    for (let g = 0; g < groupsN; g++) {
      const docOrdinal = reader.varint();
      const unitsN = reader.varint();
      const units: number[] = [];
      let prev = 0;
      for (let u = 0; u < unitsN; u++) {
        prev += reader.varint();
        units.push(prev);
      }
      groups.push({ docOrdinal, units });
    }
    terms.set(term, { df, groups });
  }
  return { version, locale, packageId, docCount, avgTokens, docs, terms };
}

export function postingUnitCount(
  pkg: ShelfPackage,
  term: string,
): { df: number; units: number; byShelf: Record<string, number> } {
  const row = pkg.terms.get(term);
  const byShelf: Record<string, number> = {};
  if (!row) return { df: 0, units: 0, byShelf };
  let units = 0;
  for (const group of row.groups) {
    const shelf = pkg.docs[group.docOrdinal]?.shelf || 'otro';
    byShelf[shelf] = (byShelf[shelf] || 0) + group.units.length;
    units += group.units.length;
  }
  return { df: row.df, units, byShelf };
}
