/**
 * Attach dense per-axis / per-paragraph citation maps to author profiles
 * and document overlays. Keeps prose seeds free of boilerplate.
 */
import type {
  AuthorContextProfile,
  AxisSourceMap,
  ContextAxes,
  ContextReference,
  DocumentContextOverlay,
  TimelineEntry,
} from '../../models/historical-context.model';
import { CONTEXT_AXES_KEYS } from '../../models/historical-context.model';
import { R, refIds, type RefKey } from './refs';

function ids(...keys: RefKey[]): string[] {
  return refIds(...keys);
}

function ensureRefIds(refs: ContextReference[]): ContextReference[] {
  return refs.map((r, i) => {
    if (r.id) return r;
    const slug = (r.title || `ref-${i}`)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48);
    return { ...r, id: slug || `ref-${i}` };
  });
}

function allAxes(map: AxisSourceMap): AxisSourceMap {
  const out: AxisSourceMap = { ...map };
  // Fill any missing axis with a fallback set of general refs from the map values
  const fallback = Array.from(
    new Set(CONTEXT_AXES_KEYS.flatMap((k) => map[k] || [])),
  );
  const pad = fallback.length ? fallback : ids('odcc', 'pelikan');
  for (const k of CONTEXT_AXES_KEYS) {
    if (!out[k]?.length) out[k] = pad.slice(0, 3);
  }
  return out;
}

/** Default dense maps by author/era profile id. */
const PROFILE_AXIS: Record<string, AxisSourceMap> = {
  'agustin-hipona': allAxes({
    lugar: ids('brownAg', 'britannicaLateRome', 'newadventAg'),
    personajes: ids('brownAg', 'newadventAg', 'confessions'),
    gobierno: ids('brownAg', 'britannicaLateRome', 'frend'),
    cultura: ids('brownAg', 'chadwick', 'kelly'),
    religion: ids('brownAg', 'chadwick', 'frend', 'kelly'),
    antropologia: ids('brownAg', 'frend', 'chadwick'),
    creenciasMundanas: ids('brownAg', 'chadwick', 'britannicaLateRome'),
    creenciaCristiana: ids('kelly', 'pelikan', 'brownAg', 'newadventAg'),
  }),
  'cirilo-jerusalen': allAxes({
    lugar: ids('cyril', 'chadwick', 'odcc'),
    personajes: ids('cyril', 'kelly', 'odcc'),
    gobierno: ids('chadwick', 'frend', 'odcc'),
    cultura: ids('cyril', 'chadwick', 'pelikan'),
    religion: ids('cyril', 'kelly', 'chadwick'),
    antropologia: ids('cyril', 'chadwick', 'frend'),
    creenciasMundanas: ids('chadwick', 'kelly', 'odcc'),
    creenciaCristiana: ids('cyril', 'kelly', 'pelikan'),
  }),
  'clemente-alejandria': allAxes({
    lugar: ids('clement', 'chadwick', 'odcc'),
    personajes: ids('clement', 'odcc', 'chadwick'),
    gobierno: ids('frend', 'chadwick', 'britannicaLateRome'),
    cultura: ids('clement', 'chadwick', 'pelikan'),
    religion: ids('clement', 'kelly', 'chadwick'),
    antropologia: ids('clement', 'chadwick', 'frend'),
    creenciasMundanas: ids('clement', 'chadwick', 'odcc'),
    creenciaCristiana: ids('clement', 'kelly', 'pelikan'),
  }),
  'cipriano-cartago': allAxes({
    lugar: ids('cyprian', 'frend', 'odcc'),
    personajes: ids('cyprian', 'frend', 'chadwick'),
    gobierno: ids('frend', 'cyprian', 'britannicaLateRome'),
    cultura: ids('cyprian', 'chadwick', 'odcc'),
    religion: ids('cyprian', 'frend', 'kelly'),
    antropologia: ids('cyprian', 'frend', 'chadwick'),
    creenciasMundanas: ids('frend', 'chadwick', 'odcc'),
    creenciaCristiana: ids('cyprian', 'kelly', 'pelikan'),
  }),
  'gregorio-nisa': allAxes({
    lugar: ids('gregoryNyssa', 'odcc', 'chadwick'),
    personajes: ids('gregoryNyssa', 'kelly', 'odcc'),
    gobierno: ids('chadwick', 'kelly', 'odcc'),
    cultura: ids('gregoryNyssa', 'pelikan', 'chadwick'),
    religion: ids('gregoryNyssa', 'kelly', 'pelikan'),
    antropologia: ids('gregoryNyssa', 'odcc', 'chadwick'),
    creenciasMundanas: ids('kelly', 'chadwick', 'odcc'),
    creenciaCristiana: ids('gregoryNyssa', 'kelly', 'pelikan'),
  }),
  'diogneto-anonimo': allAxes({
    lugar: ids('diognetus', 'chadwick', 'frend'),
    personajes: ids('diognetus', 'chadwick', 'odcc'),
    gobierno: ids('frend', 'chadwick', 'britannicaLateRome'),
    cultura: ids('diognetus', 'chadwick', 'odcc'),
    religion: ids('diognetus', 'chadwick', 'frend'),
    antropologia: ids('diognetus', 'frend', 'chadwick'),
    creenciasMundanas: ids('diognetus', 'chadwick', 'odcc'),
    creenciaCristiana: ids('diognetus', 'kelly', 'pelikan'),
  }),
  'sagrada-escritura': allAxes({
    lugar: ids('bible', 'odcc', 'chadwick'),
    personajes: ids('bible', 'odcc', 'pelikan'),
    gobierno: ids('bible', 'odcc', 'frend'),
    cultura: ids('bible', 'odcc', 'pelikan'),
    religion: ids('bible', 'chadwick', 'odcc'),
    antropologia: ids('bible', 'odcc', 'frend'),
    creenciasMundanas: ids('bible', 'odcc', 'chadwick'),
    creenciaCristiana: ids('bible', 'pelikan', 'kelly'),
  }),
  'era-concilios-antiguos': allAxes({
    lugar: ids('tanner', 'newadventCouncils', 'chadwick'),
    personajes: ids('tanner', 'kelly', 'odcc'),
    gobierno: ids('tanner', 'chadwick', 'britannicaLateRome'),
    cultura: ids('tanner', 'kelly', 'pelikan'),
    religion: ids('tanner', 'kelly', 'chadwick'),
    antropologia: ids('chadwick', 'frend', 'odcc'),
    creenciasMundanas: ids('kelly', 'chadwick', 'odcc'),
    creenciaCristiana: ids('tanner', 'kelly', 'pelikan'),
  }),
  'era-concilios-bizantinos': allAxes({
    lugar: ids('tanner', 'newadventCouncils', 'odcc'),
    personajes: ids('tanner', 'odcc', 'pelikan'),
    gobierno: ids('tanner', 'odcc', 'newadventCouncils'),
    cultura: ids('tanner', 'pelikan', 'odcc'),
    religion: ids('tanner', 'kelly', 'pelikan'),
    antropologia: ids('odcc', 'pelikan', 'tanner'),
    creenciasMundanas: ids('odcc', 'pelikan', 'tanner'),
    creenciaCristiana: ids('tanner', 'kelly', 'pelikan'),
  }),
  'era-concilios-medievales': allAxes({
    lugar: ids('tanner', 'newadventCouncils', 'odcc'),
    personajes: ids('tanner', 'odcc', 'pelikan'),
    gobierno: ids('tanner', 'odcc', 'newadventCouncils'),
    cultura: ids('tanner', 'pelikan', 'odcc'),
    religion: ids('tanner', 'pelikan', 'odcc'),
    antropologia: ids('odcc', 'pelikan', 'tanner'),
    creenciasMundanas: ids('odcc', 'pelikan', 'tanner'),
    creenciaCristiana: ids('tanner', 'pelikan', 'kelly'),
  }),
  'era-trento': allAxes({
    lugar: ids('trent', 'tanner', 'odcc'),
    personajes: ids('trent', 'tanner', 'odcc'),
    gobierno: ids('trent', 'tanner', 'odcc'),
    cultura: ids('trent', 'pelikan', 'romanCatechism'),
    religion: ids('trent', 'tanner', 'pelikan'),
    antropologia: ids('trent', 'odcc', 'romanCatechism'),
    creenciasMundanas: ids('trent', 'odcc', 'pelikan'),
    creenciaCristiana: ids('trent', 'tanner', 'romanCatechism', 'pelikan'),
  }),
  'era-vat1': allAxes({
    lugar: ids('vat1', 'quantaCura', 'odcc'),
    personajes: ids('vat1', 'quantaCura', 'odcc'),
    gobierno: ids('vat1', 'quantaCura', 'odcc'),
    cultura: ids('vat1', 'odcc', 'pelikan'),
    religion: ids('vat1', 'quantaCura', 'pelikan'),
    antropologia: ids('vat1', 'odcc', 'pelikan'),
    creenciasMundanas: ids('quantaCura', 'vat1', 'odcc'),
    creenciaCristiana: ids('vat1', 'tanner', 'pelikan'),
  }),
  'era-vat2': allAxes({
    lugar: ids('vat2', 'tanner', 'odcc'),
    personajes: ids('vat2', 'odcc', 'paulvi'),
    gobierno: ids('vat2', 'odcc', 'johnxxiii'),
    cultura: ids('vat2', 'pelikan', 'odcc'),
    religion: ids('vat2', 'tanner', 'pelikan'),
    antropologia: ids('vat2', 'odcc', 'pelikan'),
    creenciasMundanas: ids('vat2', 'odcc', 'pelikan'),
    creenciaCristiana: ids('vat2', 'tanner', 'pelikan'),
  }),
  'era-concilio-jerusalen': allAxes({
    lugar: ids('bible', 'chadwick', 'frend'),
    personajes: ids('bible', 'chadwick', 'odcc'),
    gobierno: ids('bible', 'frend', 'chadwick'),
    cultura: ids('bible', 'chadwick', 'odcc'),
    religion: ids('bible', 'chadwick', 'frend'),
    antropologia: ids('bible', 'frend', 'chadwick'),
    creenciasMundanas: ids('bible', 'chadwick', 'odcc'),
    creenciaCristiana: ids('bible', 'kelly', 'chadwick'),
  }),
  'issuer-jp2': allAxes({
    lugar: ids('jpii', 'cic', 'odcc'),
    personajes: ids('jpii', 'odcc', 'cic'),
    gobierno: ids('jpii', 'cdc', 'odcc'),
    cultura: ids('jpii', 'cic', 'pelikan'),
    religion: ids('jpii', 'cic', 'cds'),
    antropologia: ids('jpii', 'cic', 'cds'),
    creenciasMundanas: ids('jpii', 'cds', 'odcc'),
    creenciaCristiana: ids('jpii', 'cic', 'pelikan'),
  }),
  'issuer-paul-vi': allAxes({
    lugar: ids('paulvi', 'vat2', 'odcc'),
    personajes: ids('paulvi', 'vat2', 'odcc'),
    gobierno: ids('paulvi', 'vat2', 'odcc'),
    cultura: ids('paulvi', 'vat2', 'pelikan'),
    religion: ids('paulvi', 'vat2', 'odcc'),
    antropologia: ids('paulvi', 'odcc', 'pelikan'),
    creenciasMundanas: ids('paulvi', 'odcc', 'vat2'),
    creenciaCristiana: ids('paulvi', 'vat2', 'pelikan'),
  }),
  'issuer-john-xxiii': allAxes({
    lugar: ids('johnxxiii', 'vat2', 'odcc'),
    personajes: ids('johnxxiii', 'vat2', 'odcc'),
    gobierno: ids('johnxxiii', 'odcc', 'vat2'),
    cultura: ids('johnxxiii', 'odcc', 'pelikan'),
    religion: ids('johnxxiii', 'vat2', 'odcc'),
    antropologia: ids('johnxxiii', 'odcc', 'pelikan'),
    creenciasMundanas: ids('johnxxiii', 'odcc', 'vat2'),
    creenciaCristiana: ids('johnxxiii', 'vat2', 'pelikan'),
  }),
  'issuer-leo-xiii': allAxes({
    lugar: ids('leoxiii', 'odcc', 'pelikan'),
    personajes: ids('leoxiii', 'odcc', 'pelikan'),
    gobierno: ids('leoxiii', 'odcc', 'pelikan'),
    cultura: ids('leoxiii', 'odcc', 'pelikan'),
    religion: ids('leoxiii', 'odcc', 'pelikan'),
    antropologia: ids('leoxiii', 'odcc', 'cds'),
    creenciasMundanas: ids('leoxiii', 'odcc', 'pelikan'),
    creenciaCristiana: ids('leoxiii', 'pelikan', 'odcc'),
  }),
  'issuer-pius-xi': allAxes({
    lugar: ids('piusxi', 'odcc', 'pelikan'),
    personajes: ids('piusxi', 'odcc', 'pelikan'),
    gobierno: ids('piusxi', 'odcc', 'pelikan'),
    cultura: ids('piusxi', 'odcc', 'pelikan'),
    religion: ids('piusxi', 'odcc', 'pelikan'),
    antropologia: ids('piusxi', 'odcc', 'pelikan'),
    creenciasMundanas: ids('piusxi', 'odcc', 'pelikan'),
    creenciaCristiana: ids('piusxi', 'pelikan', 'odcc'),
  }),
  'issuer-pius-ix': allAxes({
    lugar: ids('quantaCura', 'vat1', 'odcc'),
    personajes: ids('quantaCura', 'vat1', 'odcc'),
    gobierno: ids('quantaCura', 'vat1', 'odcc'),
    cultura: ids('quantaCura', 'odcc', 'pelikan'),
    religion: ids('quantaCura', 'vat1', 'pelikan'),
    antropologia: ids('quantaCura', 'odcc', 'pelikan'),
    creenciasMundanas: ids('quantaCura', 'vat1', 'odcc'),
    creenciaCristiana: ids('quantaCura', 'vat1', 'pelikan'),
  }),
  'issuer-curia-moderna': allAxes({
    lugar: ids('b16', 'jpii', 'odcc'),
    personajes: ids('b16', 'jpii', 'odcc'),
    gobierno: ids('b16', 'cdc', 'jpii'),
    cultura: ids('b16', 'cic', 'odcc'),
    religion: ids('b16', 'cic', 'jpii'),
    antropologia: ids('b16', 'jpii', 'cds'),
    creenciasMundanas: ids('b16', 'jpii', 'odcc'),
    creenciaCristiana: ids('b16', 'cic', 'pelikan'),
  }),
  'issuer-canon-law': allAxes({
    lugar: ids('cdc', 'cceo', 'odcc'),
    personajes: ids('cdc', 'jpii', 'odcc'),
    gobierno: ids('cdc', 'cceo', 'odcc'),
    cultura: ids('cdc', 'odcc', 'pelikan'),
    religion: ids('cdc', 'cceo', 'cic'),
    antropologia: ids('cdc', 'odcc', 'jpii'),
    creenciasMundanas: ids('cdc', 'odcc', 'pelikan'),
    creenciaCristiana: ids('cdc', 'cceo', 'pelikan'),
  }),
  'issuer-denzinger': allAxes({
    lugar: ids('denzinger', 'odcc', 'pelikan'),
    personajes: ids('denzinger', 'odcc', 'pelikan'),
    gobierno: ids('denzinger', 'odcc', 'tanner'),
    cultura: ids('denzinger', 'odcc', 'pelikan'),
    religion: ids('denzinger', 'odcc', 'pelikan'),
    antropologia: ids('denzinger', 'odcc', 'pelikan'),
    creenciasMundanas: ids('denzinger', 'odcc', 'pelikan'),
    creenciaCristiana: ids('denzinger', 'tanner', 'pelikan'),
  }),
};

const PROFILE_SUMMARY: Record<string, string[]> = {
  'agustin-hipona': ids('brownAg', 'newadventAg', 'chadwick'),
  'cirilo-jerusalen': ids('cyril', 'odcc', 'chadwick'),
  'clemente-alejandria': ids('clement', 'chadwick', 'odcc'),
  'cipriano-cartago': ids('cyprian', 'frend', 'chadwick'),
  'gregorio-nisa': ids('gregoryNyssa', 'kelly', 'odcc'),
  'diogneto-anonimo': ids('diognetus', 'chadwick', 'frend'),
  'sagrada-escritura': ids('bible', 'odcc', 'pelikan'),
  'era-concilios-antiguos': ids('tanner', 'kelly', 'newadventCouncils'),
  'era-concilios-bizantinos': ids('tanner', 'newadventCouncils', 'odcc'),
  'era-concilios-medievales': ids('tanner', 'odcc', 'pelikan'),
  'era-trento': ids('trent', 'tanner', 'romanCatechism'),
  'era-vat1': ids('vat1', 'quantaCura', 'tanner'),
  'era-vat2': ids('vat2', 'tanner', 'odcc'),
  'era-concilio-jerusalen': ids('bible', 'chadwick', 'frend'),
  'issuer-jp2': ids('jpii', 'cic', 'odcc'),
  'issuer-paul-vi': ids('paulvi', 'vat2', 'odcc'),
  'issuer-john-xxiii': ids('johnxxiii', 'vat2', 'odcc'),
  'issuer-leo-xiii': ids('leoxiii', 'odcc', 'pelikan'),
  'issuer-pius-xi': ids('piusxi', 'odcc', 'pelikan'),
  'issuer-pius-ix': ids('quantaCura', 'vat1', 'odcc'),
  'issuer-curia-moderna': ids('b16', 'jpii', 'odcc'),
  'issuer-canon-law': ids('cdc', 'cceo', 'odcc'),
  'issuer-denzinger': ids('denzinger', 'odcc', 'pelikan'),
};

/** Bibliography bundle typically needed for a profile. */
function bibliographyForProfile(id: string): ContextReference[] {
  const axis = PROFILE_AXIS[id] || allAxes({});
  const summary = PROFILE_SUMMARY[id] || ids('odcc', 'pelikan');
  const want = new Set<string>([
    ...summary,
    ...CONTEXT_AXES_KEYS.flatMap((k) => axis[k] || []),
  ]);
  const all = Object.values(R) as ContextReference[];
  return all.filter((r) => r.id && want.has(r.id));
}

function stampTimeline(
  entries: TimelineEntry[] | undefined,
  defaultIds: string[],
): TimelineEntry[] | undefined {
  if (!entries?.length) return entries;
  return entries.map((t) => ({
    ...t,
    refIds: t.refIds?.length ? t.refIds : defaultIds.slice(0, 2),
  }));
}

export function enrichAuthorProfile(
  profile: AuthorContextProfile,
): AuthorContextProfile {
  const axis =
    profile.axisSources && Object.keys(profile.axisSources).length
      ? allAxes(profile.axisSources)
      : PROFILE_AXIS[profile.id] ||
        allAxes({
          lugar: ids('odcc', 'pelikan'),
          personajes: ids('odcc', 'pelikan'),
          gobierno: ids('odcc', 'pelikan'),
          cultura: ids('odcc', 'pelikan'),
          religion: ids('odcc', 'pelikan'),
          antropologia: ids('odcc', 'pelikan'),
          creenciasMundanas: ids('odcc', 'pelikan'),
          creenciaCristiana: ids('odcc', 'pelikan'),
        });
  const summaryRefIds =
    profile.summaryRefIds?.length
      ? profile.summaryRefIds
      : PROFILE_SUMMARY[profile.id] || ids('odcc', 'pelikan');
  const baseRefs = ensureRefIds([
    ...bibliographyForProfile(profile.id),
    ...(profile.references || []),
  ]);
  // dedupe by id
  const byId = new Map<string, ContextReference>();
  for (const r of baseRefs) {
    if (r.id) byId.set(r.id, r);
  }
  return {
    ...profile,
    summaryRefIds,
    axisSources: axis,
    timeline: stampTimeline(profile.timeline, summaryRefIds),
    references: Array.from(byId.values()),
    sourceNote:
      profile.sourceNote ||
      'Síntesis histórica compilada; cada eje y párrafo enlaza fuentes (ids) de la bibliografía. No sustituye monografía experta.',
  };
}

/** Work/chrono refs by document pattern. */
function docWorkRefs(documentId: string, authorProfileId?: string): string[] {
  if (documentId.includes('confesiones')) return ids('confessions', 'brownAg', 'newadventAg');
  if (documentId.includes('ciudad-de-dios')) return ids('cityOfGod', 'brownAg', 'britannicaLateRome');
  if (documentId.includes('de-trinitate')) return ids('kelly', 'brownAg', 'pelikan');
  if (documentId.includes('antimaniqueos')) return ids('brownAg', 'chadwick', 'newadventAg');
  if (documentId.includes('antidonatistas')) return ids('brownAg', 'frend', 'newadventAg');
  if (documentId.includes('antipelagianos') || documentId.includes('gracia'))
    return ids('brownAg', 'kelly', 'pelikan');
  if (documentId.startsWith('agustin-')) return ids('brownAg', 'newadventAg', 'chadwick');
  if (documentId.includes('diogneto')) return ids('diognetus', 'chadwick');
  if (documentId.includes('cirilo')) return ids('cyril', 'kelly');
  if (documentId.includes('clemente')) return ids('clement', 'chadwick');
  if (documentId.includes('cipriano')) return ids('cyprian', 'frend');
  if (documentId.includes('gregorio-nisa') || documentId.includes('nisa'))
    return ids('gregoryNyssa', 'kelly');
  if (documentId.includes('bible')) return ids('bible', 'odcc');
  if (documentId === 'cic-es') return ids('cic', 'jpii', 'odcc');
  if (documentId.startsWith('cdc') || documentId.startsWith('cceo'))
    return ids('cdc', 'cceo', 'jpii');
  if (documentId.includes('trento')) return ids('trent', 'tanner');
  if (documentId.includes('vat-i') || documentId.includes('vat-1'))
    return ids('vat1', 'tanner');
  if (
    ['sc-es', 'lg-es', 'gs-es', 'dv-es', 'aa-es', 'ur-es', 'cd-es', 'ot-es', 'pc-es', 'po-es', 'na-es', 'dh-es', 'ge-es', 'im-es', 'ag-es'].includes(
      documentId,
    )
  )
    return ids('vat2', 'tanner', 'odcc');
  if (documentId.includes('nicea') || documentId.includes('calcedonia') || documentId.includes('efeso') || documentId.includes('constantinopla') || documentId.includes('lateran') || documentId.includes('lyon') || documentId.includes('florencia') || documentId.includes('constanza') || documentId.includes('vienne') || documentId.includes('jerusalen'))
    return ids('tanner', 'newadventCouncils', 'odcc');
  if (authorProfileId?.startsWith('issuer-jp2') || authorProfileId === 'issuer-jp2')
    return ids('jpii', 'odcc');
  if (authorProfileId === 'issuer-paul-vi') return ids('paulvi', 'vat2');
  if (authorProfileId === 'issuer-curia-moderna') return ids('b16', 'jpii', 'odcc');
  if (authorProfileId === 'era-vat2') return ids('vat2', 'tanner');
  return ids('odcc', 'pelikan', 'tanner');
}

/** Optional work-specific axis overrides (only when document rewrites axes). */
function docAxisSources(
  overlay: DocumentContextOverlay,
  workIds: string[],
): AxisSourceMap | undefined {
  if (!overlay.axes || !Object.keys(overlay.axes).length) {
    // still attach work ids to axes that document specializes? optional empty
    return undefined;
  }
  const out: AxisSourceMap = {};
  for (const k of CONTEXT_AXES_KEYS) {
    if (overlay.axes[k as keyof ContextAxes]) {
      out[k] = workIds;
    }
  }
  return Object.keys(out).length ? out : undefined;
}

export function enrichDocumentOverlay(
  overlay: DocumentContextOverlay,
): DocumentContextOverlay {
  const workIds =
    overlay.workSummaryRefIds?.length
      ? overlay.workSummaryRefIds
      : docWorkRefs(overlay.documentId, overlay.authorProfileId);
  const chronoIds =
    overlay.chronologyRefIds?.length
      ? overlay.chronologyRefIds
      : workIds;
  const axisSources =
    overlay.axisSources && Object.keys(overlay.axisSources).length
      ? overlay.axisSources
      : docAxisSources(overlay, workIds);

  const extra = workIds
    .map((id) => Object.values(R).find((r) => r.id === id))
    .filter(Boolean) as ContextReference[];

  const references = ensureRefIds([
    ...extra,
    ...(overlay.references || []),
  ]);
  const byId = new Map<string, ContextReference>();
  for (const r of references) {
    if (r.id) byId.set(r.id, r);
  }

  const timelineSlice = overlay.timelineSlice?.map((t) => ({
    ...t,
    refIds: t.refIds?.length ? t.refIds : workIds.slice(0, 2),
  }));

  return {
    ...overlay,
    workSummaryRefIds: workIds,
    chronologyRefIds: chronoIds,
    axisSources,
    timelineSlice,
    references: Array.from(byId.values()),
    sourceNote:
      overlay.sourceNote ||
      'Contexto de obra con fuentes enlazadas por párrafo y eje; ver bibliografía numerada.',
  };
}

export function enrichPack(opts: {
  authors: AuthorContextProfile[];
  documents: DocumentContextOverlay[];
}): {
  authors: AuthorContextProfile[];
  documents: DocumentContextOverlay[];
} {
  const authors = opts.authors.map(enrichAuthorProfile);
  const byAuthor = new Map(authors.map((a) => [a.id, a]));
  const documents = opts.documents.map((d) => {
    const enriched = enrichDocumentOverlay(d);
    // Ensure document bibliography includes author refs for id resolution offline
    const author = d.authorProfileId
      ? byAuthor.get(d.authorProfileId)
      : undefined;
    if (author) {
      const byId = new Map<string, ContextReference>();
      for (const r of [...(enriched.references || []), ...author.references]) {
        if (r.id) byId.set(r.id, r);
      }
      return { ...enriched, references: Array.from(byId.values()) };
    }
    return enriched;
  });
  return { authors, documents };
}
