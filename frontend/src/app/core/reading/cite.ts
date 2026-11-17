/**
 * One place in a book: a pack id plus a unit index.
 * The consecutive label is display copy. It is not an address.
 */

export type DocumentId =
  | { readonly kind: 'corpus'; readonly id: string }
  | { readonly kind: 'santoral'; readonly saintId: string }
  | { readonly kind: 'papacy'; readonly popeId: string };

/** Integer ≥ 0 in canonical form. Only parseUnitIndex builds this. */
export type UnitIndex = number & { readonly __brand: 'UnitIndex' };

export interface Cite {
  readonly documentId: DocumentId;
  readonly unitIndex: UnitIndex;
}

export interface ResumeDisplay {
  readonly title: string;
  readonly unitCount: number;
  readonly label?: string;
}

export interface ResumeCard {
  readonly cite: Cite;
  readonly display: ResumeDisplay;
  readonly updatedAt: string;
}

export type Arrival =
  | { readonly kind: 'cite'; readonly cite: Cite }
  | { readonly kind: 'redirect'; readonly cite: Cite }
  | { readonly kind: 'invalid' };

const SLUG = /^[a-z0-9][a-z0-9-]*$/;
const CANON_INT = /^(0|[1-9][0-9]*)$/;
const STACK_CAP = 32;

export const LEGACY_READING_KEYS = [
  'document_id',
  'article_selected',
  'actual_index',
] as const;

export function clearLegacyReadingKeys(
  storage: { removeItem(key: string): void } | null | undefined,
): void {
  if (!storage) return;
  for (const key of LEGACY_READING_KEYS) {
    try {
      storage.removeItem(key);
    } catch {
      // private mode
    }
  }
}

export function parseDocumentId(raw: string | null | undefined): DocumentId | null {
  if (raw == null) return null;
  let decoded = String(raw).trim();
  if (!decoded) return null;
  if (decoded.includes('%')) {
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      return null;
    }
  }
  if (decoded.startsWith('santoral:')) {
    const saintId = decoded.slice('santoral:'.length).trim();
    return saintId ? { kind: 'santoral', saintId } : null;
  }
  if (decoded.startsWith('papacy:')) {
    const popeId = decoded.slice('papacy:'.length).trim();
    return popeId ? { kind: 'papacy', popeId } : null;
  }
  if (!SLUG.test(decoded)) return null;
  return { kind: 'corpus', id: decoded };
}

export function documentIdKey(id: DocumentId): string {
  if (id.kind === 'corpus') return id.id;
  if (id.kind === 'santoral') return `santoral:${id.saintId}`;
  return `papacy:${id.popeId}`;
}

export function sameDocument(a: DocumentId, b: DocumentId): boolean {
  return documentIdKey(a) === documentIdKey(b);
}

/** Pack id only. A title or shortTitle never selects a document. */
export function matchesPackId(metaId: string, query: string): boolean {
  return metaId === query;
}

export function parseUnitIndex(
  raw: number | string | null | undefined,
): UnitIndex | null {
  if (typeof raw === 'number') {
    if (!Number.isInteger(raw) || raw < 0 || !Number.isSafeInteger(raw)) {
      return null;
    }
    return raw as UnitIndex;
  }
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  if (!CANON_INT.test(text)) return null;
  const n = Number(text);
  if (!Number.isSafeInteger(n) || n < 0) return null;
  return n as UnitIndex;
}

export function cite(documentId: DocumentId, unitIndex: UnitIndex): Cite {
  return { documentId, unitIndex };
}

export function sameCite(
  a: Cite | null | undefined,
  b: Cite | null | undefined,
): boolean {
  if (!a || !b) return false;
  return sameDocument(a.documentId, b.documentId) && a.unitIndex === b.unitIndex;
}

export function readingCommands(place: Cite): string[] {
  return ['leyendo', documentIdKey(place.documentId), 'u', String(place.unitIndex)];
}

/**
 * Where the opened unit is, relative to the viewport.
 * `pending` — not scrolled into place yet, or not in the DOM.
 * `visible` — at least one pixel is on screen.
 * `hidden` — painted, then scrolled fully out of view.
 */
export type PinView = 'pending' | 'visible' | 'hidden';

/**
 * While the opened unit is still pinned, the route unit stays the address.
 * After that unit has left the screen, the spy unit is the address:
 * the URL and the resume card both follow it.
 */
export function unitToSave(
  routeUnit: UnitIndex | null,
  spiedUnit: UnitIndex,
  pinHeld: boolean,
): UnitIndex {
  if (pinHeld && routeUnit != null) return routeUnit;
  return spiedUnit;
}

/**
 * A window refill reports the unit on screen now.
 * The index that opened the book must not replace the route afterwards.
 */
export function unitToReportAfterFill(
  visibleUnit: UnitIndex,
  focusUnit: UnitIndex,
): UnitIndex {
  void focusUnit;
  return visibleUnit;
}

/**
 * While the opened unit is pending or still on screen, a scroll spy must
 * not move the address to an earlier or a later unit. Once that unit has
 * left the viewport, the spy wins and the pin is dropped by the caller.
 * No pin: the spied unit is the address.
 */
export function adoptSpiedUnit(
  pinned: UnitIndex | null,
  spied: UnitIndex,
  pinView: PinView,
): UnitIndex | null {
  if (pinned != null && pinView !== 'hidden') return null;
  return spied;
}

/** True when `url` is any reader route, including a legacy point segment. */
export function isReaderUrl(url: string): boolean {
  const path = url.split(/[?#]/)[0];
  let decoded = path;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    // keep the raw path
  }
  return decoded === '/leyendo' || decoded.startsWith('/leyendo/');
}

export function resumeUnitFor(
  card: ResumeCard | null,
  documentId: DocumentId,
): UnitIndex {
  if (
    card &&
    sameDocument(card.cite.documentId, documentId) &&
    card.cite.unitIndex > 0
  ) {
    return card.cite.unitIndex;
  }
  return 0 as UnitIndex;
}

export function parseResumeCard(raw: string | null | undefined): ResumeCard | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const row = parsed as Record<string, unknown>;
  const documentId = row['documentId'];
  const unitIndex = row['unitIndex'];
  const titleRaw = row['title'];
  const unitCountRaw = row['unitCount'];
  const labelRaw = row['label'];
  const updatedRaw = row['updatedAt'];
  const id = parseDocumentId(typeof documentId === 'string' ? documentId : null);
  const unit = parseUnitIndex(
    typeof unitIndex === 'number' || typeof unitIndex === 'string'
      ? unitIndex
      : null,
  );
  if (!id || unit == null) return null;
  const title = typeof titleRaw === 'string' ? titleRaw : '';
  const unitCount =
    typeof unitCountRaw === 'number' &&
    Number.isInteger(unitCountRaw) &&
    unitCountRaw >= 0
      ? unitCountRaw
      : 0;
  const label =
    typeof labelRaw === 'string' && labelRaw.length > 0 ? labelRaw : undefined;
  const updatedAt = typeof updatedRaw === 'string' ? updatedRaw : '';
  return {
    cite: cite(id, unit),
    display: label ? { title, unitCount, label } : { title, unitCount },
    updatedAt,
  };
}

export function serializeResumeCard(card: ResumeCard): string {
  return JSON.stringify({
    documentId: documentIdKey(card.cite.documentId),
    title: card.display.title,
    unitIndex: card.cite.unitIndex,
    unitCount: card.display.unitCount,
    label: card.display.label,
    updatedAt: card.updatedAt,
  });
}

export function pushCite(stack: readonly Cite[], frame: Cite): Cite[] {
  const top = stack[stack.length - 1];
  const next = top && sameCite(top, frame) ? [...stack] : [...stack, frame];
  return next.length > STACK_CAP ? next.slice(next.length - STACK_CAP) : next;
}

/**
 * Old frames may carry `actual_index` plus a consecutive label.
 * The label is ignored. A frame without a unit index is dropped.
 */
export function parseStack(raw: string | null | undefined): Cite[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: Cite[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const documentId = row['documentId'];
    const unitIndex = row['unitIndex'];
    const legacyIndex = row['actual_index'];
    const id = parseDocumentId(typeof documentId === 'string' ? documentId : null);
    const fromUnit =
      typeof unitIndex === 'number' || typeof unitIndex === 'string'
        ? unitIndex
        : null;
    const fromLegacy =
      typeof legacyIndex === 'number' || typeof legacyIndex === 'string'
        ? legacyIndex
        : null;
    const unit = parseUnitIndex(fromUnit ?? fromLegacy);
    if (!id || unit == null) continue;
    out.push(cite(id, unit));
  }
  return out.slice(-STACK_CAP);
}

export function parseArrival(input: {
  documentId: string | null;
  unit: string | null;
  legacyUser: string | null;
  resume: ResumeCard | null;
}): Arrival {
  const id = parseDocumentId(input.documentId);
  if (!id) return { kind: 'invalid' };
  if (input.unit != null && input.unit !== '') {
    const unit = parseUnitIndex(input.unit);
    if (unit == null) return { kind: 'invalid' };
    return { kind: 'cite', cite: cite(id, unit) };
  }
  if (input.legacyUser != null && input.legacyUser !== '') {
    const legacy = parseUnitIndex(input.legacyUser);
    if (legacy != null) {
      return { kind: 'redirect', cite: cite(id, legacy) };
    }
  }
  return { kind: 'redirect', cite: cite(id, resumeUnitFor(input.resume, id)) };
}

/**
 * Offline reading history on this device.
 * One row per document, newest `updatedAt` first. The corpus is not stored.
 * `dv.lastRead` stays the single resume card; this list is the history view.
 */
export const READING_HISTORY_KEY = 'dv.readingHistory.v1';
export const READING_HISTORY_CAP = 100;

export interface ReadingHistoryEntry {
  documentId: string;
  title: string;
  unitIndex: number;
  unitCount: number;
  label?: string;
  /** First time this document was recorded. */
  openedAt: string;
  /** Last time the reader reported this document. */
  updatedAt: string;
}

export type ReadingHistoryInput = Omit<
  ReadingHistoryEntry,
  'openedAt' | 'updatedAt'
>;

type HistoryStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

function cleanHistoryEntry(raw: unknown): ReadingHistoryEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = parseDocumentId(
    typeof row['documentId'] === 'string' ? row['documentId'] : null,
  );
  const unit = parseUnitIndex(
    typeof row['unitIndex'] === 'number' || typeof row['unitIndex'] === 'string'
      ? row['unitIndex']
      : null,
  );
  if (!id || unit == null) return null;
  const title = typeof row['title'] === 'string' ? row['title'] : '';
  const unitCountRaw = row['unitCount'];
  const unitCount =
    typeof unitCountRaw === 'number' &&
    Number.isInteger(unitCountRaw) &&
    unitCountRaw >= 0
      ? unitCountRaw
      : 0;
  const labelRaw = row['label'];
  const label =
    typeof labelRaw === 'string' && labelRaw.length > 0 ? labelRaw : undefined;
  const openedAt = typeof row['openedAt'] === 'string' ? row['openedAt'] : '';
  const updatedAt = typeof row['updatedAt'] === 'string' ? row['updatedAt'] : '';
  if (!openedAt || !updatedAt) return null;
  return {
    documentId: documentIdKey(id),
    title,
    unitIndex: unit,
    unitCount,
    ...(label ? { label } : {}),
    openedAt,
    updatedAt,
  };
}

/** Parse stored history. Invalid rows are dropped. Order is kept. */
export function parseReadingHistory(
  raw: string | null | undefined,
): ReadingHistoryEntry[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: ReadingHistoryEntry[] = [];
  const seen = new Set<string>();
  for (const row of parsed) {
    const entry = cleanHistoryEntry(row);
    if (!entry || seen.has(entry.documentId)) continue;
    seen.add(entry.documentId);
    out.push(entry);
    if (out.length >= READING_HISTORY_CAP) break;
  }
  return out;
}

export function serializeReadingHistory(
  entries: readonly ReadingHistoryEntry[],
): string {
  return JSON.stringify(entries);
}

/**
 * Upsert by document id and move that row to the front.
 * `openedAt` stays the first visit. A bad id or unit leaves the list unchanged.
 */
export function recordReading(
  entries: readonly ReadingHistoryEntry[],
  input: ReadingHistoryInput,
  now: string,
): ReadingHistoryEntry[] {
  const id = parseDocumentId(input.documentId);
  const unit = parseUnitIndex(input.unitIndex);
  if (!id || unit == null || !now) return entries.slice();
  const documentId = documentIdKey(id);
  const title = typeof input.title === 'string' ? input.title : '';
  const unitCount =
    typeof input.unitCount === 'number' &&
    Number.isInteger(input.unitCount) &&
    input.unitCount >= 0
      ? input.unitCount
      : 0;
  const label =
    typeof input.label === 'string' && input.label.length > 0
      ? input.label
      : undefined;
  const prev = entries.find((entry) => entry.documentId === documentId);
  const row: ReadingHistoryEntry = {
    documentId,
    title,
    unitIndex: unit,
    unitCount,
    ...(label ? { label } : {}),
    openedAt: prev?.openedAt || now,
    updatedAt: now,
  };
  const rest = entries.filter((entry) => entry.documentId !== documentId);
  return [row, ...rest].slice(0, READING_HISTORY_CAP);
}

export function readReadingHistory(
  store: Pick<HistoryStore, 'getItem'>,
): ReadingHistoryEntry[] {
  try {
    return parseReadingHistory(store.getItem(READING_HISTORY_KEY));
  } catch {
    return [];
  }
}

export function recordReadingInStore(
  store: HistoryStore,
  input: ReadingHistoryInput,
  now: () => string = () => new Date().toISOString(),
): ReadingHistoryEntry[] {
  const next = recordReading(readReadingHistory(store), input, now());
  try {
    store.setItem(READING_HISTORY_KEY, serializeReadingHistory(next));
  } catch {
    // quota / private mode
  }
  return next;
}

export function clearReadingHistory(store: Pick<HistoryStore, 'removeItem'>): void {
  try {
    store.removeItem(READING_HISTORY_KEY);
  } catch {
    // private mode
  }
}
