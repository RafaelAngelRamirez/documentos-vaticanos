/**
 * Pure historical-context merge (no Angular, no relative TS imports).
 * Testable with: node --experimental-strip-types …
 *
 * Keep field shapes aligned with historical-context.models.ts / pipeline model.
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

export interface ContextReference {
  title: string;
  citation?: string;
  url?: string;
  note?: string;
}

export interface TimelineEntry {
  years: string;
  label: string;
  note?: string;
}

export interface AuthorContextProfile {
  id: string;
  name: string;
  kind: 'author' | 'era' | 'issuer';
  years?: string;
  summary: string;
  axes: ContextAxes;
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
  chronologyNote?: string;
  axes?: Partial<ContextAxes>;
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
  workSummary?: string;
  chronologyNote?: string;
  axes: ContextAxes;
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

/** Offline pack URL relative to app assets. */
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

/**
 * Merge author/era general profile with per-document overlay.
 * Document axis text wins when non-empty; otherwise author axis is kept.
 * Timeline prefers document.timelineSlice; else author.timeline.
 * References: overlay first, then author (dedup by title+url).
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

  const timeline: TimelineEntry[] =
    overlay?.timelineSlice && overlay.timelineSlice.length
      ? overlay.timelineSlice.slice()
      : author?.timeline
        ? author.timeline.slice()
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
    workSummary: nonEmpty(overlay?.workSummary) || undefined,
    chronologyNote: nonEmpty(overlay?.chronologyNote) || undefined,
    axes,
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
    const key = `${nonEmpty(r.title).toLowerCase()}|${nonEmpty(r.url).toLowerCase()}|${nonEmpty(r.citation).toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

/** True when all eight axes have non-empty text. */
export function hasCompleteAxes(axes: ContextAxes | null | undefined): boolean {
  if (!axes) return false;
  return CONTEXT_AXES_KEYS.every((k) => nonEmpty(axes[k]).length > 0);
}

/** True when resolved context meets coverage gate (axes + ≥1 reference). */
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
 * Axis rows for templates (label + text), skipping empties so optional fields
 * never break the reader.
 */
export function axisRowsForUi(
  axes: ContextAxes | null | undefined,
  labels: Record<keyof ContextAxes, string>,
): { key: keyof ContextAxes; label: string; text: string }[] {
  if (!axes) return [];
  const rows: { key: keyof ContextAxes; label: string; text: string }[] = [];
  for (const k of CONTEXT_AXES_KEYS) {
    const text = nonEmpty(axes[k]);
    if (!text) continue;
    rows.push({ key: k, label: labels[k], text });
  }
  return rows;
}
