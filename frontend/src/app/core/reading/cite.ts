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
