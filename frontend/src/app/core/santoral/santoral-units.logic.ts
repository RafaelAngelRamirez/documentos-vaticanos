/**
 * Pure santoral biography → reading units (no Angular).
 * Enables the same reader/narrator/progress path as corpus documents.
 *
 * documentId namespace: `santoral:{saintId}` — never collides with pack ids.
 */

export const SANTORAL_DOC_PREFIX = 'santoral:';

/** Minimal saint shape for materialization (aligned with SaintRecord). */
export interface SaintBioSource {
  id: string;
  name: string;
  displayName?: string;
  bio?: string;
  sourceUrl?: string;
  locale?: string;
  role?: string;
  years?: string;
  eraLabel?: string;
  era?: string;
  quote?: string;
  quoteSource?: string;
  themes?: string[];
  authorAliases?: string[];
}

/**
 * Narrative / glue tokens that flood the offline corpus when used as a
 * relatedness seed (e.g. “emperador”, “época” → half of Agustín).
 * Folded, no diacritics. Not a global search stopword list.
 */
export const SAINT_RELATED_SEED_NOISE: ReadonlySet<string> = new Set([
  // Function / glue (folded surfaces that still pass length ≥3)
  'del',
  'los',
  'las',
  'una',
  'uno',
  'unos',
  'unas',
  'por',
  'para',
  'con',
  'sin',
  'que',
  'sobre',
  'entre',
  'desde',
  'hasta',
  'hacia',
  'como',
  'cuando',
  'donde',
  'porque',
  'quien',
  'quienes',
  'cual',
  'cuales',
  'muy',
  'mas',
  'menos',
  'bien',
  'mal',
  'solo',
  'sola',
  'asi',
  'tambien',
  'entonces',
  'despues',
  'antes',
  'durante',
  'segun',
  'fue',
  'ser',
  'era',
  'son',
  'esta',
  'este',
  'estos',
  'estas',
  'ese',
  'esa',
  'esos',
  'esas',
  'aquel',
  'aquella',
  'sus',
  'mis',
  'nos',
  'les',
  'hay',
  'han',
  'has',
  'han',
  // Narrative / martyrology glue that floods patristic packs
  'actualmente',
  'ano',
  'anos',
  'año',
  'años',
  'altar',
  'beata',
  'beato',
  'capital',
  'ciudad',
  'condenado',
  'conocido',
  'conocida',
  'cristiano',
  'cristianos',
  'dia',
  'dias',
  'emperador',
  'emperadores',
  'epoca',
  'gran',
  'grande',
  'hermana',
  'hermano',
  'hija',
  'hijo',
  'historia',
  'hoy',
  'iglesia',
  'imperio',
  'joven',
  'jovenes',
  'llamado',
  'llamada',
  'lugar',
  'madre',
  'mes',
  'meses',
  'misma',
  'mismo',
  'muerte',
  'murio',
  'nacio',
  'nombre',
  'nueva',
  'nuevo',
  'obispo',
  'obispos',
  'otras',
  'otros',
  'padre',
  'papa',
  'parte',
  'pontifice',
  'primer',
  'primera',
  'pueblo',
  'reina',
  'restaurar',
  'rey',
  'roma',
  'romana',
  'romano',
  'san',
  'santa',
  'santo',
  'siglo',
  'tiempo',
  'tierra',
  'toda',
  'todas',
  'todo',
  'todos',
  'ultima',
  'ultimo',
  'vez',
  'veces',
  'vicario',
  'vida',
  'mundo',
  'volco',
  'volcó',
]);

/** Unit shape compatible with corpus Article (lector / narrador). */
export interface SaintReadingUnit {
  index_array: number;
  consecutivo: string;
  contenido: string;
}

export interface SaintDocumentMeta {
  id: string;
  title: string;
  shortTitle?: string;
  kind: 'saint-bio';
  locale?: string;
  sourceUrl?: string;
  author?: string;
  sourceNote?: string;
  bodyPath: string;
  indexPath: string;
  unitCount: number;
}

export interface SaintIndice {
  indice: { [key: string]: number[] };
  indice_por_punto: { [key: number]: number | null };
}

export interface SaintLoadedDocument {
  meta: SaintDocumentMeta;
  documento: SaintReadingUnit[];
  indice: SaintIndice;
}

/** Stable synthetic document id for a saint biography. */
export function saintDocumentId(saintId: string): string {
  const id = String(saintId || '').trim();
  if (!id) return '';
  if (id.startsWith(SANTORAL_DOC_PREFIX)) return id;
  // Also accept already-encoded path segments (santoral%3A…)
  try {
    const decoded = decodeURIComponent(id);
    if (decoded.startsWith(SANTORAL_DOC_PREFIX) && decoded !== id) {
      return decoded;
    }
  } catch {
    /* ignore */
  }
  return `${SANTORAL_DOC_PREFIX}${id}`;
}

/** Extract saint id from `santoral:…` or null if not a saint doc. */
export function parseSaintDocumentId(
  documentId: string | undefined | null,
): string | null {
  let raw = String(documentId || '').trim();
  if (!raw) return null;
  try {
    // Path segments may arrive URI-encoded (santoral%3Aid).
    if (raw.includes('%')) raw = decodeURIComponent(raw);
  } catch {
    /* keep raw */
  }
  if (!raw.startsWith(SANTORAL_DOC_PREFIX)) return null;
  const id = raw.slice(SANTORAL_DOC_PREFIX.length).trim();
  return id || null;
}

export function isSaintDocumentId(
  documentId: string | undefined | null,
): boolean {
  return parseSaintDocumentId(documentId) != null;
}

/**
 * Cover / parent route for a reading documentId.
 * Corpus docs → `/documento/{id}`; saint bios → `/santoral/{saintId}`.
 * Used by lector «←» and BackService hierarchy (never land on a broken 2A).
 */
export function coverPathForDocumentId(
  documentId: string | undefined | null,
): string {
  const raw = String(documentId || '').trim();
  if (!raw) return '/biblioteca';
  const saintId = parseSaintDocumentId(raw);
  if (saintId) return `/santoral/${saintId}`;
  let decoded = raw;
  try {
    if (raw.includes('%')) decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }
  if (decoded.startsWith('papacy:')) {
    const popeId = decoded.slice('papacy:'.length).trim();
    if (popeId) return `/papas/${popeId}`;
  }
  return `/documento/${raw}`;
}

/** Angular `router.navigate` commands for the cover of a reading doc. */
export function coverNavCommandsForDocumentId(
  documentId: string | undefined | null,
): string[] {
  const raw = String(documentId || '').trim();
  if (!raw) return ['/biblioteca'];
  const saintId = parseSaintDocumentId(raw);
  if (saintId) return ['/santoral', saintId];
  let decoded = raw;
  try {
    if (raw.includes('%')) decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }
  if (decoded.startsWith('papacy:')) {
    const popeId = decoded.slice('papacy:'.length).trim();
    if (popeId) return ['/papas', popeId];
  }
  return ['/documento', raw];
}

/**
 * Parent path for app hierarchy (BackService / 7A).
 * Pure so tests and BackService share one source of truth.
 */
export function parentPathForAppUrl(url: string): string | null {
  const clean = String(url || '').split('?')[0].split('#')[0];
  const seg = clean.split('/').filter(Boolean);
  if (seg.length === 0 || clean === '/inicio') {
    return null;
  }

  const [a, b, c] = seg;

  if (a === 'leyendo' && b) {
    // `/leyendo/santoral:…` or `/leyendo/cic-es/punto/0` → cover of that doc
    return coverPathForDocumentId(b);
  }
  if (a === 'documento') {
    return '/biblioteca';
  }
  if (a === 'santoral' && b) {
    return '/santoral';
  }
  if (a === 'papas' && b) {
    return '/papas';
  }
  if (a === 'estudios' && c === 'editar') {
    return `/estudios/${b}`;
  }
  if (a === 'estudios' && b) {
    return '/estudios';
  }
  if (a === 'cuenta' && b === 'temas' && c) {
    return '/cuenta/temas';
  }
  if (a === 'cuenta' && b) {
    return '/cuenta';
  }
  if (a === 'padres' && b) {
    return '/padres';
  }
  if (a === 'doctores' && b) {
    return '/doctores';
  }
  if (a === 'admin' && b === 'revision' && c) {
    return '/admin/revision';
  }

  return '/inicio';
}

/**
 * Split biography plain text into stable reading units.
 * Primary split: blank-line paragraphs. Short/empty bios → single unit or [].
 * Indices are array order (unitIndex); consecutivo is human «§n».
 */
export function bioToReadingUnits(
  bio: string | undefined | null,
): SaintReadingUnit[] {
  const text = String(bio || '')
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .trim();
  if (!text) return [];

  let parts = text
    .split(/\n\s*\n+/)
    .map((p) => p.replace(/[ \t]+\n/g, '\n').trim())
    .filter((p) => p.length > 0);

  // Single huge blob with only single newlines: group by blank-ish lines already
  // failed — fall back to line groups of ~3–5 non-empty lines.
  if (parts.length === 1 && text.length > 1200) {
    const lines = text
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length >= 4) {
      const chunkSize = Math.max(2, Math.min(5, Math.ceil(lines.length / 12)));
      parts = [];
      for (let i = 0; i < lines.length; i += chunkSize) {
        parts.push(lines.slice(i, i + chunkSize).join('\n'));
      }
    }
  }

  // Still one very long paragraph: soft-split on sentence ends for narrator UX.
  if (parts.length === 1 && parts[0].length > 1800) {
    const sentences = parts[0]
      .split(/(?<=[.!?…])\s+(?=[A-ZÁÉÍÓÚÜÑ¿¡«"'])/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (sentences.length >= 3) {
      const group = Math.max(2, Math.ceil(sentences.length / 8));
      parts = [];
      for (let i = 0; i < sentences.length; i += group) {
        parts.push(sentences.slice(i, i + group).join(' '));
      }
    }
  }

  return parts.map((contenido, index_array) => ({
    index_array,
    consecutivo: `§${index_array + 1}`,
    contenido,
  }));
}

/** Build search / punto index from units. */
export function buildSaintIndice(units: SaintReadingUnit[]): SaintIndice {
  const indice: { [key: string]: number[] } = {};
  const indice_por_punto: { [key: number]: number | null } = {};
  for (const u of units) {
    const key = u.consecutivo || String(u.index_array);
    if (!indice[key]) indice[key] = [];
    indice[key].push(u.index_array);
    indice_por_punto[u.index_array] = u.index_array + 1;
  }
  return { indice, indice_por_punto };
}

export function saintDisplayTitle(saint: SaintBioSource): string {
  return (saint.displayName || saint.name || saint.id || '').trim();
}

/**
 * Materialize a saint biography as a LoadedDocument-compatible structure
 * for the real reader path (`/leyendo/santoral:{id}/punto/:n`).
 */
export function saintToReadingDocument(
  saint: SaintBioSource,
): SaintLoadedDocument | null {
  if (!saint?.id) return null;
  const units = bioToReadingUnits(saint.bio);
  // Allow empty bio → still openable as one empty unit so CTA is not a trap.
  const documento =
    units.length > 0
      ? units
      : [
          {
            index_array: 0,
            consecutivo: '§1',
            contenido:
              'No hay biografía disponible en el pack offline para este santo.',
          },
        ];
  const title = saintDisplayTitle(saint);
  const id = saintDocumentId(saint.id);
  const meta: SaintDocumentMeta = {
    id,
    title,
    shortTitle: title.length > 28 ? title.slice(0, 26) + '…' : title,
    kind: 'saint-bio',
    locale: saint.locale || 'es',
    sourceUrl: saint.sourceUrl,
    author: title,
    sourceNote: 'Biografía del santoral offline (no es documento magisterial).',
    bodyPath: `santoral/synthetic/${saint.id}`,
    indexPath: `santoral/synthetic/${saint.id}.index`,
    unitCount: documento.length,
  };
  return {
    meta,
    documento,
    indice: buildSaintIndice(documento),
  };
}

/**
 * Whether cover CTA should say «Continuar la lectura».
 * Same semantics as documento-detalle: progress for this doc with unitIndex > 0.
 */
export function canContinueSaintReading(
  lastRead: { documentId?: string; unitIndex?: number } | null | undefined,
  saintIdOrDocId: string,
): boolean {
  if (!lastRead || typeof lastRead.unitIndex !== 'number') return false;
  if (lastRead.unitIndex <= 0) return false;
  const want = saintDocumentId(
    parseSaintDocumentId(saintIdOrDocId) || saintIdOrDocId,
  );
  const got = String(lastRead.documentId || '');
  return got === want;
}

/**
 * Fold token like corpus search (keep ñ; strip other diacritics).
 * Local copy so this module stays free of semantic-search imports.
 */
function foldSeedToken(raw: string): string {
  return String(raw || '')
    .normalize('NFD')
    .replace(
      /([^n\u0300-\u036f]|n(?!\u0303(?![\u0300-\u036f])))[\u0300-\u036f]+/gi,
      '$1',
    )
    .normalize()
    .toLowerCase()
    .replace(/[,"\.«»“”:;!¡¿?—']/gi, '')
    .replace(/[-\(\)\*\/`‘–…\[\]]/gi, ' ')
    .trim();
}

function tokenizeSeedText(text: string): string[] {
  const folded = foldSeedToken(text);
  if (!folded) return [];
  return folded.split(/\s+/).map((t) => t.trim()).filter((t) => t.length >= 2);
}

/**
 * Distinctive anchors from a saint bio for relatedness seeds.
 * Drops narrative noise so short martyrologies do not match half the pack.
 */
export function distinctiveTermsFromSaintBio(
  bio: string | undefined | null,
  maxTerms = 8,
): string[] {
  const tokens = tokenizeSeedText(String(bio || '').replace(/\s+/g, ' '));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tok of tokens) {
    if (out.length >= maxTerms) break;
    if (/^\d+$/.test(tok)) continue;
    if (SAINT_RELATED_SEED_NOISE.has(tok)) continue;
    // Prefer substance: drop 2–3 letter glue left after noise filter.
    if (tok.length < 4) continue;
    if (seen.has(tok)) continue;
    seen.add(tok);
    out.push(tok);
  }
  return out;
}

/**
 * Seed for related-units on saint cover.
 * Identity + themes + distinctive bio anchors — not the full prose dump
 * (that produced false “Relacionados” from common history words).
 */
export function relatedSeedForSaint(saint: SaintBioSource): string {
  const title = saintDisplayTitle(saint);
  const role = String(saint.role || '').trim();
  const themes = Array.isArray(saint.themes)
    ? saint.themes.map((t) => String(t || '').trim()).filter(Boolean).join(' ')
    : '';
  // Name tokens without san/santa noise (title still kept as phrase for UX).
  const nameBits = tokenizeSeedText(
    [saint.name, saint.displayName, ...(saint.authorAliases || [])]
      .filter(Boolean)
      .join(' '),
  ).filter((t) => !SAINT_RELATED_SEED_NOISE.has(t) && t.length >= 3);
  const bioTerms = distinctiveTermsFromSaintBio(saint.bio, 8);
  const anchors = Array.from(new Set([...nameBits, ...bioTerms])).join(' ');
  const seed = [title, role, themes, anchors].filter(Boolean).join('. ');
  // Too thin → empty so the panel can hide instead of noise.
  const substance = tokenizeSeedText(seed).filter(
    (t) => !SAINT_RELATED_SEED_NOISE.has(t) && t.length >= 3,
  );
  if (substance.length < 2) return '';
  return seed;
}

/** Simple TOC rows from units (first line of each paragraph as title). */
export function tocFromSaintUnits(
  units: SaintReadingUnit[],
  maxEntries = 24,
): { num: string; title: string; unitIndex: number }[] {
  const cap = Math.max(1, maxEntries);
  // Prefer landmarks: first unit + every Nth for long bios
  if (units.length <= cap) {
    return units.map((u) => ({
      num: u.consecutivo.replace(/^§/, '') || String(u.index_array + 1),
      title: tocTitleFromContent(u.contenido),
      unitIndex: u.index_array,
    }));
  }
  const step = Math.ceil(units.length / cap);
  const out: { num: string; title: string; unitIndex: number }[] = [];
  for (let i = 0; i < units.length && out.length < cap; i += step) {
    const u = units[i];
    out.push({
      num: u.consecutivo.replace(/^§/, '') || String(u.index_array + 1),
      title: tocTitleFromContent(u.contenido),
      unitIndex: u.index_array,
    });
  }
  // Always include last
  const last = units[units.length - 1];
  if (out[out.length - 1]?.unitIndex !== last.index_array) {
    out.push({
      num: last.consecutivo.replace(/^§/, '') || String(last.index_array + 1),
      title: tocTitleFromContent(last.contenido),
      unitIndex: last.index_array,
    });
  }
  return out;
}

function tocTitleFromContent(contenido: string): string {
  const line = String(contenido || '')
    .split(/\n/)
    .map((l) => l.trim())
    .find(Boolean);
  if (!line) return '…';
  const clean = line.replace(/\s+/g, ' ');
  return clean.length > 72 ? clean.slice(0, 70) + '…' : clean;
}
