/**
 * Pure historical-context merge (no Angular, no relative TS imports).
 * Testable with: node --experimental-strip-types …
 *
 * Dense citations: prose blocks link to reference ids; bibliography in references[].
 */

export interface ContextAxes {
  lugar: string;
  personajes: string;
  gobierno: string;
  cultura: string;
  religion: string;
  antropologia: string;
  creenciasMundanas: string;
  creenciaCristiana: string;
}

export type AxisSourceMap = Partial<Record<keyof ContextAxes, string[]>>;

export interface ContextReference {
  id?: string;
  title: string;
  citation?: string;
  url?: string;
  note?: string;
  locator?: string;
}

export interface TimelineEntry {
  years: string;
  label: string;
  note?: string;
  refIds?: string[];
}

export interface AuthorContextProfile {
  id: string;
  name: string;
  kind: 'author' | 'era' | 'issuer';
  years?: string;
  summary: string;
  summaryRefIds?: string[];
  axes: ContextAxes;
  axisSources?: AxisSourceMap;
  timeline?: TimelineEntry[];
  references: ContextReference[];
  sourceNote?: string;
  saintId?: string;
}

export interface DocumentContextOverlay {
  documentId: string;
  authorProfileId?: string;
  compositionYears?: string;
  compositionPlace?: string;
  workSummary?: string;
  workSummaryRefIds?: string[];
  chronologyNote?: string;
  chronologyRefIds?: string[];
  axes?: Partial<ContextAxes>;
  axisSources?: AxisSourceMap;
  timelineSlice?: TimelineEntry[];
  references?: ContextReference[];
  sourceNote?: string;
}

export interface ResolvedHistoricalContext {
  documentId: string;
  authorProfileId?: string;
  authorName?: string;
  saintId?: string;
  compositionYears?: string;
  compositionPlace?: string;
  generalSummary?: string;
  summaryRefIds?: string[];
  workSummary?: string;
  workSummaryRefIds?: string[];
  chronologyNote?: string;
  chronologyRefIds?: string[];
  axes: ContextAxes;
  axisSources: AxisSourceMap;
  timeline: TimelineEntry[];
  references: ContextReference[];
  sourceNote?: string;
}

export interface HistoricalContextManifest {
  version: string;
  generatedAt?: string;
  sourceNote?: string;
  authors: { id: string; path: string }[];
  documents: { documentId: string; path: string; authorProfileId?: string }[];
}

export const CONTEXT_AXES_KEYS: (keyof ContextAxes)[] = [
  'lugar',
  'personajes',
  'gobierno',
  'cultura',
  'religion',
  'antropologia',
  'creenciasMundanas',
  'creenciaCristiana',
];

export const CONTEXT_AXIS_LABELS: Record<keyof ContextAxes, string> = {
  lugar: 'Lugar',
  personajes: 'Personajes relacionados',
  gobierno: 'Gobierno',
  cultura: 'Cultura',
  religion: 'Religión',
  antropologia: 'Antropología',
  creenciasMundanas: 'Creencias mundanas',
  creenciaCristiana: 'Creencia cristiana predominante',
};

export const HISTORICAL_CONTEXT_MANIFEST_URL =
  'assets/corpus/context/manifest.json';

const EMPTY_AXES: ContextAxes = {
  lugar: '',
  personajes: '',
  gobierno: '',
  cultura: '',
  religion: '',
  antropologia: '',
  creenciasMundanas: '',
  creenciaCristiana: '',
};

function nonEmpty(s: string | undefined | null): string {
  return (s || '').trim();
}

function uniqIds(ids: string[] | undefined | null): string[] {
  if (!ids || !ids.length) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of ids) {
    const id = nonEmpty(raw);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** Merge axis source maps: overlay ids replace author for that axis when non-empty. */
export function mergeAxisSources(
  author: AxisSourceMap | undefined | null,
  overlay: AxisSourceMap | undefined | null,
): AxisSourceMap {
  const out: AxisSourceMap = {};
  for (const k of CONTEXT_AXES_KEYS) {
    const o = uniqIds(overlay?.[k]);
    const a = uniqIds(author?.[k]);
    const ids = o.length ? o : a;
    if (ids.length) out[k] = ids;
  }
  return out;
}

/**
 * Merge author/era general profile with per-document overlay.
 * Document axis text wins when non-empty; axisSources: overlay wins per axis.
 * Timeline prefers document.timelineSlice; else author.timeline.
 * References: overlay first, then author (dedup by id or title+url).
 */
export function resolveHistoricalContext(
  documentId: string,
  overlay: DocumentContextOverlay | null | undefined,
  author: AuthorContextProfile | null | undefined,
): ResolvedHistoricalContext | null {
  if (!overlay && !author) return null;

  const axes: ContextAxes = { ...EMPTY_AXES };
  if (author?.axes) {
    for (const k of CONTEXT_AXES_KEYS) {
      axes[k] = nonEmpty(author.axes[k]);
    }
  }
  if (overlay?.axes) {
    for (const k of CONTEXT_AXES_KEYS) {
      const v = nonEmpty(overlay.axes[k]);
      if (v) axes[k] = v;
    }
  }

  const axisSources = mergeAxisSources(author?.axisSources, overlay?.axisSources);

  const timeline: TimelineEntry[] =
    overlay?.timelineSlice && overlay.timelineSlice.length
      ? overlay.timelineSlice.map((t) => ({
          ...t,
          refIds: uniqIds(t.refIds),
        }))
      : author?.timeline
        ? author.timeline.map((t) => ({ ...t, refIds: uniqIds(t.refIds) }))
        : [];

  const references = dedupeReferences([
    ...(overlay?.references || []),
    ...(author?.references || []),
  ]);

  const sourceParts = [overlay?.sourceNote, author?.sourceNote]
    .map((s) => nonEmpty(s))
    .filter(Boolean);

  return {
    documentId: overlay?.documentId || documentId,
    authorProfileId: overlay?.authorProfileId || author?.id,
    authorName: author?.name,
    saintId: author?.saintId,
    compositionYears: nonEmpty(overlay?.compositionYears) || undefined,
    compositionPlace: nonEmpty(overlay?.compositionPlace) || undefined,
    generalSummary: nonEmpty(author?.summary) || undefined,
    summaryRefIds: uniqIds(author?.summaryRefIds),
    workSummary: nonEmpty(overlay?.workSummary) || undefined,
    workSummaryRefIds: uniqIds(overlay?.workSummaryRefIds),
    chronologyNote: nonEmpty(overlay?.chronologyNote) || undefined,
    chronologyRefIds: uniqIds(overlay?.chronologyRefIds),
    axes,
    axisSources,
    timeline,
    references,
    sourceNote: sourceParts.length ? sourceParts.join(' · ') : undefined,
  };
}

export function dedupeReferences(refs: ContextReference[]): ContextReference[] {
  const seen = new Set<string>();
  const out: ContextReference[] = [];
  for (const r of refs) {
    if (!r || !nonEmpty(r.title)) continue;
    const key = nonEmpty(r.id)
      ? `id:${nonEmpty(r.id).toLowerCase()}`
      : `${nonEmpty(r.title).toLowerCase()}|${nonEmpty(r.url).toLowerCase()}|${nonEmpty(r.citation).toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

/** Lookup map id → reference for UI footnotes. */
export function referencesById(
  refs: ContextReference[] | null | undefined,
): Map<string, ContextReference> {
  const map = new Map<string, ContextReference>();
  for (const r of refs || []) {
    if (r?.id) map.set(r.id, r);
  }
  return map;
}

/** Resolve ref ids to bibliography entries (skips unknown ids). */
export function resolveRefIds(
  ids: string[] | undefined | null,
  refs: ContextReference[] | null | undefined,
): ContextReference[] {
  if (!ids?.length) return [];
  const map = referencesById(refs);
  const out: ContextReference[] = [];
  for (const id of uniqIds(ids)) {
    const r = map.get(id);
    if (r) out.push(r);
  }
  return out;
}

export function hasCompleteAxes(axes: ContextAxes | null | undefined): boolean {
  if (!axes) return false;
  return CONTEXT_AXES_KEYS.every((k) => nonEmpty(axes[k]).length > 0);
}

/** Axes text + ≥1 bibliographic entry (url or citation). */
export function isCoverageComplete(
  ctx: ResolvedHistoricalContext | null | undefined,
): boolean {
  if (!ctx) return false;
  if (!hasCompleteAxes(ctx.axes)) return false;
  return (ctx.references || []).some(
    (r) => nonEmpty(r.title) && (nonEmpty(r.url) || nonEmpty(r.citation)),
  );
}

/**
 * Dense citation gate: every non-empty axis has ≥1 axisSources id that
 * resolves to a reference with url or citation; summary/work/chrono when present.
 */
export function hasDenseCitations(
  ctx: ResolvedHistoricalContext | null | undefined,
): boolean {
  if (!ctx || !isCoverageComplete(ctx)) return false;
  const map = referencesById(ctx.references);
  const okIds = (ids: string[] | undefined) => {
    const u = uniqIds(ids);
    if (!u.length) return false;
    return u.some((id) => {
      const r = map.get(id);
      return !!(r && nonEmpty(r.title) && (nonEmpty(r.url) || nonEmpty(r.citation)));
    });
  };
  for (const k of CONTEXT_AXES_KEYS) {
    if (!nonEmpty(ctx.axes[k])) continue;
    if (!okIds(ctx.axisSources?.[k])) return false;
  }
  if (ctx.generalSummary && !okIds(ctx.summaryRefIds)) return false;
  if (ctx.workSummary && !okIds(ctx.workSummaryRefIds)) return false;
  if (ctx.chronologyNote && !okIds(ctx.chronologyRefIds)) return false;
  return true;
}

export interface AxisRowForUi {
  key: keyof ContextAxes;
  label: string;
  text: string;
  refIds: string[];
  sources: ContextReference[];
}

/**
 * Axis rows for templates with resolved source list under each axis.
 */
export function axisRowsForUi(
  axes: ContextAxes | null | undefined,
  labels: Record<keyof ContextAxes, string>,
  axisSources?: AxisSourceMap | null,
  references?: ContextReference[] | null,
): AxisRowForUi[] {
  if (!axes) return [];
  const rows: AxisRowForUi[] = [];
  for (const k of CONTEXT_AXES_KEYS) {
    const text = nonEmpty(axes[k]);
    if (!text) continue;
    const refIds = uniqIds(axisSources?.[k]);
    rows.push({
      key: k,
      label: labels[k],
      text,
      refIds,
      sources: resolveRefIds(refIds, references),
    });
  }
  return rows;
}

/** Short marker labels for UI (¹ ² … or [1] [2]). */
export function sourceMarkers(
  ids: string[] | undefined | null,
  refOrder: string[],
): string {
  const u = uniqIds(ids);
  if (!u.length) return '';
  const nums: number[] = [];
  for (const id of u) {
    const i = refOrder.indexOf(id);
    if (i >= 0) nums.push(i + 1);
  }
  if (!nums.length) return '';
  return nums.map((n) => `[${n}]`).join('');
}

/** Ordered unique ref ids as they appear in resolved context (for numbered list). */
export function orderedRefIds(ctx: ResolvedHistoricalContext): string[] {
  const order: string[] = [];
  const push = (ids?: string[]) => {
    for (const id of uniqIds(ids)) {
      if (!order.includes(id)) order.push(id);
    }
  };
  push(ctx.summaryRefIds);
  push(ctx.workSummaryRefIds);
  push(ctx.chronologyRefIds);
  for (const k of CONTEXT_AXES_KEYS) push(ctx.axisSources?.[k]);
  for (const t of ctx.timeline || []) push(t.refIds);
  // any remaining refs with id
  for (const r of ctx.references || []) {
    if (r.id && !order.includes(r.id)) order.push(r.id);
  }
  return order;
}
