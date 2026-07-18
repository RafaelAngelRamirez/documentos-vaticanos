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

/**
 * Dense maps prefer: (1) official/primary URLs, (2) SEP/Britannica/IEP,
 * (3) Fordham/CCEL/DCO, (4) print manuals (Brown, Chadwick, Kelly…).
 */
const PROFILE_AXIS: Record<string, AxisSourceMap> = {
  'agustin-hipona': allAxes({
    lugar: ids(
      'brownAg',
      'britannicaLateRome',
      'liviusLateRome',
      'britannicaAugustine',
      'sepAugustine',
    ),
    personajes: ids('brownAg', 'sepAugustine', 'confessions', 'britannicaAugustine', 'augustinusPortal'),
    gobierno: ids('brownAg', 'britannicaLateRome', 'frend', 'sepPolitical', 'fordhamAncient'),
    cultura: ids('brownAg', 'sepPlotinus', 'metMuseumLateAntique', 'chadwick', 'sepAugustine'),
    religion: ids('brownAg', 'sepAugustine', 'chadwick', 'kelly', 'ccelECF'),
    antropologia: ids('brownAg', 'frend', 'metMuseumLateAntique', 'britishMuseumRome', 'chadwick'),
    creenciasMundanas: ids('brownAg', 'sepPlotinus', 'britannicaLateRome', 'chadwick', 'liviusLateRome'),
    creenciaCristiana: ids('kelly', 'pelikan', 'sepAugustine', 'sepTrinity', 'newadventAg'),
  }),
  'cirilo-jerusalen': allAxes({
    lugar: ids('cyril', 'cyrilCCEL', 'chadwick', 'fordhamChurch', 'britannicaChristianity'),
    personajes: ids('cyril', 'kelly', 'odcc', 'ccelECF'),
    gobierno: ids('chadwick', 'frend', 'britannicaLateRome', 'fordhamAncient'),
    cultura: ids('cyril', 'chadwick', 'pelikan', 'metMuseumLateAntique'),
    religion: ids('cyril', 'cyrilCCEL', 'kelly', 'chadwick'),
    antropologia: ids('cyril', 'chadwick', 'frend', 'fordhamEHS'),
    creenciasMundanas: ids('chadwick', 'kelly', 'britannicaLateAntiquity'),
    creenciaCristiana: ids('cyril', 'kelly', 'pelikan', 'newadventFathers'),
  }),
  'clemente-alejandria': allAxes({
    lugar: ids('clement', 'clementCCEL', 'chadwick', 'britannicaLateRome', 'liviusLateRome'),
    personajes: ids('clement', 'odcc', 'chadwick', 'ccelECF'),
    gobierno: ids('frend', 'chadwick', 'britannicaLateRome', 'fordhamAncient'),
    cultura: ids('clement', 'sepPlotinus', 'chadwick', 'pelikan'),
    religion: ids('clement', 'clementCCEL', 'kelly', 'chadwick'),
    antropologia: ids('clement', 'chadwick', 'frend', 'britishMuseumRome'),
    creenciasMundanas: ids('clement', 'sepPlotinus', 'chadwick', 'odcc'),
    creenciaCristiana: ids('clement', 'kelly', 'pelikan', 'newadventFathers'),
  }),
  'cipriano-cartago': allAxes({
    lugar: ids('cyprian', 'cyprianCCEL', 'frend', 'liviusLateRome', 'britannicaLateRome'),
    personajes: ids('cyprian', 'frend', 'chadwick', 'ccelECF'),
    gobierno: ids('frend', 'cyprian', 'britannicaLateRome', 'fordhamAncient'),
    cultura: ids('cyprian', 'chadwick', 'odcc', 'ccelSchaffHistory'),
    religion: ids('cyprian', 'cyprianCCEL', 'frend', 'kelly'),
    antropologia: ids('cyprian', 'frend', 'chadwick', 'fordhamEHS'),
    creenciasMundanas: ids('frend', 'chadwick', 'britannicaLateAntiquity'),
    creenciaCristiana: ids('cyprian', 'kelly', 'pelikan', 'newadventFathers'),
  }),
  'gregorio-nisa': allAxes({
    lugar: ids('gregoryNyssa', 'nyssaCCEL', 'odcc', 'chadwick', 'britannicaChristianity'),
    personajes: ids('gregoryNyssa', 'kelly', 'odcc', 'ccelECF'),
    gobierno: ids('chadwick', 'kelly', 'britannicaLateRome', 'fordhamChurch'),
    cultura: ids('gregoryNyssa', 'sepPlotinus', 'pelikan', 'chadwick'),
    religion: ids('gregoryNyssa', 'nyssaCCEL', 'kelly', 'pelikan'),
    antropologia: ids('gregoryNyssa', 'odcc', 'chadwick', 'metMuseumLateAntique'),
    creenciasMundanas: ids('kelly', 'sepPlotinus', 'chadwick', 'odcc'),
    creenciaCristiana: ids('gregoryNyssa', 'kelly', 'pelikan', 'sepTrinity'),
  }),
  'diogneto-anonimo': allAxes({
    lugar: ids('diognetus', 'diognetusCCEL', 'chadwick', 'frend', 'earlyChristianWritings'),
    personajes: ids('diognetus', 'chadwick', 'odcc', 'ccelECF'),
    gobierno: ids('frend', 'chadwick', 'britannicaLateRome', 'fordhamAncient'),
    cultura: ids('diognetus', 'chadwick', 'earlyChristianWritings', 'odcc'),
    religion: ids('diognetus', 'diognetusCCEL', 'chadwick', 'frend'),
    antropologia: ids('diognetus', 'frend', 'chadwick', 'fordhamEHS'),
    creenciasMundanas: ids('diognetus', 'chadwick', 'britannicaLateAntiquity'),
    creenciaCristiana: ids('diognetus', 'kelly', 'pelikan', 'newadventFathers'),
  }),
  'sagrada-escritura': allAxes({
    lugar: ids('bible', 'bibleES', 'odcc', 'fordhamAncient', 'britannicaChristianity'),
    personajes: ids('bible', 'odcc', 'pelikan', 'earlyChristianWritings'),
    gobierno: ids('bible', 'odcc', 'frend', 'liviusLateRome'),
    cultura: ids('bible', 'odcc', 'pelikan', 'metMuseumLateAntique'),
    religion: ids('bible', 'bibleES', 'chadwick', 'odcc'),
    antropologia: ids('bible', 'odcc', 'frend', 'fordhamEHS'),
    creenciasMundanas: ids('bible', 'odcc', 'chadwick', 'britannicaLateAntiquity'),
    creenciaCristiana: ids('bible', 'pelikan', 'kelly', 'britannicaChristianity'),
  }),
  'era-concilios-antiguos': allAxes({
    lugar: ids('tanner', 'britannicaNicaea', 'britannicaChalcedon', 'papacyVaticanCouncils', 'fordhamChurch'),
    personajes: ids('tanner', 'kelly', 'odcc', 'britannicaCouncils', 'documentaCatholica'),
    gobierno: ids('tanner', 'chadwick', 'britannicaLateRome', 'fordhamAncient'),
    cultura: ids('tanner', 'kelly', 'pelikan', 'metMuseumLateAntique'),
    religion: ids('tanner', 'kelly', 'chadwick', 'britannicaCouncils'),
    antropologia: ids('chadwick', 'frend', 'fordhamEHS', 'odcc'),
    creenciasMundanas: ids('kelly', 'chadwick', 'britannicaLateAntiquity'),
    creenciaCristiana: ids('tanner', 'kelly', 'pelikan', 'sepTrinity', 'newadventCouncils'),
  }),
  'era-concilios-bizantinos': allAxes({
    lugar: ids('tanner', 'papacyVaticanCouncils', 'britannicaCouncils', 'documentaCatholica', 'fordhamChurch'),
    personajes: ids('tanner', 'odcc', 'pelikan', 'documentaCatholica'),
    gobierno: ids('tanner', 'odcc', 'britannicaCouncils', 'fordhamChurch'),
    cultura: ids('tanner', 'pelikan', 'odcc', 'metMuseumLateAntique'),
    religion: ids('tanner', 'kelly', 'pelikan', 'documentaCatholica'),
    antropologia: ids('odcc', 'pelikan', 'fordhamEHS', 'tanner'),
    creenciasMundanas: ids('odcc', 'pelikan', 'britannicaChristianity'),
    creenciaCristiana: ids('tanner', 'kelly', 'pelikan', 'newadventCouncils'),
  }),
  'era-concilios-medievales': allAxes({
    lugar: ids('tanner', 'papacyVaticanCouncils', 'britannicaCouncils', 'fordhamChurch', 'documentaCatholica'),
    personajes: ids('tanner', 'odcc', 'pelikan', 'britannicaPapacy'),
    gobierno: ids('tanner', 'britannicaPapacy', 'fordhamChurch', 'odcc'),
    cultura: ids('tanner', 'pelikan', 'odcc', 'ccelSchaffHistory'),
    religion: ids('tanner', 'pelikan', 'odcc', 'documentaCatholica'),
    antropologia: ids('odcc', 'pelikan', 'fordhamEHS', 'tanner'),
    creenciasMundanas: ids('odcc', 'pelikan', 'britannicaChristianity'),
    creenciaCristiana: ids('tanner', 'pelikan', 'kelly', 'newadventCouncils'),
  }),
  'era-trento': allAxes({
    lugar: ids('trent', 'tanner', 'britannicaTrent', 'papacyVaticanCouncils', 'documentaCatholica'),
    personajes: ids('trent', 'tanner', 'britannicaTrent', 'britannicaPapacy'),
    gobierno: ids('trent', 'tanner', 'britannicaReformation', 'britannicaPapacy'),
    cultura: ids('trent', 'pelikan', 'romanCatechism', 'britannicaReformation'),
    religion: ids('trent', 'tanner', 'pelikan', 'britannicaTrent'),
    antropologia: ids('trent', 'odcc', 'romanCatechism', 'fordhamEHS'),
    creenciasMundanas: ids('trent', 'britannicaReformation', 'pelikan', 'odcc'),
    creenciaCristiana: ids('trent', 'tanner', 'romanCatechism', 'pelikan', 'documentaCatholica'),
  }),
  'era-vat1': allAxes({
    lugar: ids('vat1', 'vat1DeiFilius', 'quantaCura', 'papacyVaticanCouncils', 'britannicaPapacy'),
    personajes: ids('vat1', 'quantaCura', 'britannicaPapacy', 'odcc'),
    gobierno: ids('vat1', 'quantaCura', 'britannicaPapacy', 'aas'),
    cultura: ids('vat1', 'odcc', 'pelikan', 'holySeeArchive'),
    religion: ids('vat1', 'quantaCura', 'pelikan', 'denzinger'),
    antropologia: ids('vat1', 'odcc', 'pelikan', 'britannicaChristianity'),
    creenciasMundanas: ids('quantaCura', 'vat1', 'britannicaChristianity', 'odcc'),
    creenciaCristiana: ids('vat1', 'tanner', 'pelikan', 'denzinger', 'documentaCatholica'),
  }),
  'era-vat2': allAxes({
    lugar: ids('vat2', 'britannicaVat2', 'tanner', 'papacyVaticanCouncils', 'holySeeArchive'),
    personajes: ids('vat2', 'paulvi', 'johnxxiii', 'britannicaVat2', 'odcc'),
    gobierno: ids('vat2', 'johnxxiii', 'paulvi', 'aas', 'britannicaPapacy'),
    cultura: ids('vat2', 'britannicaVat2', 'pelikan', 'odcc'),
    religion: ids('vat2', 'tanner', 'pelikan', 'britannicaChristianity'),
    antropologia: ids('vat2', 'odcc', 'pelikan', 'britannicaVat2'),
    creenciasMundanas: ids('vat2', 'britannicaVat2', 'odcc', 'pelikan'),
    creenciaCristiana: ids('vat2', 'tanner', 'pelikan', 'cic', 'holySeeArchive'),
  }),
  'era-concilio-jerusalen': allAxes({
    lugar: ids('bible', 'bibleES', 'chadwick', 'fordhamAncient', 'earlyChristianWritings'),
    personajes: ids('bible', 'chadwick', 'odcc', 'earlyChristianWritings'),
    gobierno: ids('bible', 'frend', 'liviusLateRome', 'fordhamAncient'),
    cultura: ids('bible', 'chadwick', 'metMuseumLateAntique', 'odcc'),
    religion: ids('bible', 'bibleES', 'chadwick', 'frend'),
    antropologia: ids('bible', 'frend', 'chadwick', 'fordhamEHS'),
    creenciasMundanas: ids('bible', 'chadwick', 'britannicaLateAntiquity'),
    creenciaCristiana: ids('bible', 'kelly', 'chadwick', 'britannicaChristianity'),
  }),
  'issuer-jp2': allAxes({
    lugar: ids('jpii', 'cic', 'holySeeArchive', 'aas', 'britannicaPapacy'),
    personajes: ids('jpii', 'cic', 'odcc', 'papalEncyclicals'),
    gobierno: ids('jpii', 'cdc', 'aas', 'holySeeArchive'),
    cultura: ids('jpii', 'cic', 'pelikan', 'britannicaChristianity'),
    religion: ids('jpii', 'cic', 'cds', 'holySeeArchive'),
    antropologia: ids('jpii', 'cic', 'cds', 'odcc'),
    creenciasMundanas: ids('jpii', 'cds', 'britannicaChristianity', 'odcc'),
    creenciaCristiana: ids('jpii', 'cic', 'pelikan', 'denzinger', 'aas'),
  }),
  'issuer-paul-vi': allAxes({
    lugar: ids('paulvi', 'vat2', 'holySeeArchive', 'britannicaVat2', 'aas'),
    personajes: ids('paulvi', 'vat2', 'odcc', 'papalEncyclicals'),
    gobierno: ids('paulvi', 'vat2', 'aas', 'britannicaPapacy'),
    cultura: ids('paulvi', 'vat2', 'pelikan', 'britannicaVat2'),
    religion: ids('paulvi', 'vat2', 'odcc', 'holySeeArchive'),
    antropologia: ids('paulvi', 'odcc', 'pelikan', 'vat2'),
    creenciasMundanas: ids('paulvi', 'vat2', 'britannicaChristianity'),
    creenciaCristiana: ids('paulvi', 'vat2', 'pelikan', 'cic'),
  }),
  'issuer-john-xxiii': allAxes({
    lugar: ids('johnxxiii', 'vat2', 'holySeeArchive', 'aas', 'britannicaVat2'),
    personajes: ids('johnxxiii', 'vat2', 'odcc', 'papalEncyclicals'),
    gobierno: ids('johnxxiii', 'aas', 'vat2', 'britannicaPapacy'),
    cultura: ids('johnxxiii', 'odcc', 'pelikan', 'britannicaChristianity'),
    religion: ids('johnxxiii', 'vat2', 'odcc', 'holySeeArchive'),
    antropologia: ids('johnxxiii', 'odcc', 'pelikan', 'vat2'),
    creenciasMundanas: ids('johnxxiii', 'vat2', 'britannicaChristianity'),
    creenciaCristiana: ids('johnxxiii', 'vat2', 'pelikan', 'denzinger'),
  }),
  'issuer-leo-xiii': allAxes({
    lugar: ids('leoxiii', 'holySeeArchive', 'aas', 'britannicaPapacy', 'papalEncyclicals'),
    personajes: ids('leoxiii', 'odcc', 'papalEncyclicals', 'britannicaPapacy'),
    gobierno: ids('leoxiii', 'aas', 'britannicaPapacy', 'odcc'),
    cultura: ids('leoxiii', 'odcc', 'pelikan', 'britannicaChristianity'),
    religion: ids('leoxiii', 'odcc', 'pelikan', 'holySeeArchive'),
    antropologia: ids('leoxiii', 'cds', 'odcc', 'pelikan'),
    creenciasMundanas: ids('leoxiii', 'odcc', 'pelikan', 'britannicaChristianity'),
    creenciaCristiana: ids('leoxiii', 'pelikan', 'denzinger', 'documentaCatholica'),
  }),
  'issuer-pius-xi': allAxes({
    lugar: ids('piusxi', 'holySeeArchive', 'aas', 'britannicaPapacy'),
    personajes: ids('piusxi', 'odcc', 'papalEncyclicals', 'britannicaPapacy'),
    gobierno: ids('piusxi', 'aas', 'britannicaPapacy', 'odcc'),
    cultura: ids('piusxi', 'odcc', 'pelikan', 'britannicaChristianity'),
    religion: ids('piusxi', 'odcc', 'pelikan', 'holySeeArchive'),
    antropologia: ids('piusxi', 'odcc', 'pelikan', 'cds'),
    creenciasMundanas: ids('piusxi', 'odcc', 'britannicaChristianity'),
    creenciaCristiana: ids('piusxi', 'pelikan', 'denzinger', 'documentaCatholica'),
  }),
  'issuer-pius-ix': allAxes({
    lugar: ids('quantaCura', 'vat1', 'holySeeArchive', 'britannicaPapacy', 'aas'),
    personajes: ids('quantaCura', 'vat1', 'odcc', 'papalEncyclicals'),
    gobierno: ids('quantaCura', 'vat1', 'britannicaPapacy', 'aas'),
    cultura: ids('quantaCura', 'odcc', 'pelikan', 'holySeeArchive'),
    religion: ids('quantaCura', 'vat1', 'pelikan', 'denzinger'),
    antropologia: ids('quantaCura', 'odcc', 'pelikan', 'britannicaChristianity'),
    creenciasMundanas: ids('quantaCura', 'vat1', 'britannicaChristianity', 'odcc'),
    creenciaCristiana: ids('quantaCura', 'vat1', 'pelikan', 'denzinger', 'documentaCatholica'),
  }),
  'issuer-curia-moderna': allAxes({
    lugar: ids('b16', 'jpii', 'holySeeArchive', 'aas', 'cdc'),
    personajes: ids('b16', 'jpii', 'odcc', 'papalEncyclicals'),
    gobierno: ids('b16', 'cdc', 'jpii', 'aas', 'holySeeArchive'),
    cultura: ids('b16', 'cic', 'odcc', 'britannicaChristianity'),
    religion: ids('b16', 'cic', 'jpii', 'holySeeArchive'),
    antropologia: ids('b16', 'jpii', 'cds', 'cic'),
    creenciasMundanas: ids('b16', 'jpii', 'britannicaChristianity', 'odcc'),
    creenciaCristiana: ids('b16', 'cic', 'pelikan', 'denzinger', 'aas'),
  }),
  'issuer-canon-law': allAxes({
    lugar: ids('cdc', 'cceo', 'holySeeArchive', 'aas', 'odcc'),
    personajes: ids('cdc', 'jpii', 'odcc', 'holySeeArchive'),
    gobierno: ids('cdc', 'cceo', 'aas', 'britannicaPapacy'),
    cultura: ids('cdc', 'odcc', 'pelikan', 'holySeeArchive'),
    religion: ids('cdc', 'cceo', 'cic', 'holySeeArchive'),
    antropologia: ids('cdc', 'odcc', 'jpii', 'cic'),
    creenciasMundanas: ids('cdc', 'odcc', 'pelikan', 'britannicaChristianity'),
    creenciaCristiana: ids('cdc', 'cceo', 'pelikan', 'denzinger', 'aas'),
  }),
  'issuer-denzinger': allAxes({
    lugar: ids('denzinger', 'holySeeArchive', 'documentaCatholica', 'odcc'),
    personajes: ids('denzinger', 'odcc', 'pelikan', 'tanner'),
    gobierno: ids('denzinger', 'tanner', 'aas', 'britannicaPapacy'),
    cultura: ids('denzinger', 'odcc', 'pelikan', 'documentaCatholica'),
    religion: ids('denzinger', 'odcc', 'pelikan', 'holySeeArchive'),
    antropologia: ids('denzinger', 'odcc', 'pelikan', 'britannicaChristianity'),
    creenciasMundanas: ids('denzinger', 'odcc', 'pelikan', 'britannicaChristianity'),
    creenciaCristiana: ids('denzinger', 'tanner', 'pelikan', 'documentaCatholica', 'cic'),
  }),
};

const PROFILE_SUMMARY: Record<string, string[]> = {
  'agustin-hipona': ids(
    'sepAugustine',
    'brownAg',
    'britannicaAugustine',
    'augustinusPortal',
    'chadwick',
  ),
  'cirilo-jerusalen': ids('cyril', 'cyrilCCEL', 'odcc', 'chadwick', 'fordhamChurch'),
  'clemente-alejandria': ids('clement', 'clementCCEL', 'chadwick', 'sepPlotinus', 'ccelECF'),
  'cipriano-cartago': ids('cyprian', 'cyprianCCEL', 'frend', 'chadwick', 'fordhamAncient'),
  'gregorio-nisa': ids('gregoryNyssa', 'nyssaCCEL', 'kelly', 'odcc', 'sepTrinity'),
  'diogneto-anonimo': ids(
    'diognetus',
    'diognetusCCEL',
    'earlyChristianWritings',
    'chadwick',
    'frend',
  ),
  'sagrada-escritura': ids('bible', 'bibleES', 'odcc', 'pelikan', 'fordhamAncient'),
  'era-concilios-antiguos': ids(
    'tanner',
    'britannicaNicaea',
    'britannicaChalcedon',
    'papacyVaticanCouncils',
    'fordhamChurch',
  ),
  'era-concilios-bizantinos': ids(
    'tanner',
    'papacyVaticanCouncils',
    'britannicaCouncils',
    'documentaCatholica',
    'odcc',
  ),
  'era-concilios-medievales': ids(
    'tanner',
    'papacyVaticanCouncils',
    'fordhamChurch',
    'britannicaPapacy',
    'odcc',
  ),
  'era-trento': ids('trent', 'tanner', 'britannicaTrent', 'britannicaReformation', 'romanCatechism'),
  'era-vat1': ids('vat1', 'vat1DeiFilius', 'quantaCura', 'tanner', 'britannicaPapacy'),
  'era-vat2': ids('vat2', 'britannicaVat2', 'tanner', 'johnxxiii', 'paulvi'),
  'era-concilio-jerusalen': ids('bible', 'bibleES', 'chadwick', 'fordhamAncient', 'earlyChristianWritings'),
  'issuer-jp2': ids('jpii', 'cic', 'holySeeArchive', 'aas', 'odcc'),
  'issuer-paul-vi': ids('paulvi', 'vat2', 'holySeeArchive', 'britannicaVat2', 'aas'),
  'issuer-john-xxiii': ids('johnxxiii', 'vat2', 'holySeeArchive', 'aas', 'britannicaVat2'),
  'issuer-leo-xiii': ids('leoxiii', 'holySeeArchive', 'aas', 'papalEncyclicals', 'odcc'),
  'issuer-pius-xi': ids('piusxi', 'holySeeArchive', 'aas', 'papalEncyclicals', 'odcc'),
  'issuer-pius-ix': ids('quantaCura', 'vat1', 'holySeeArchive', 'aas', 'britannicaPapacy'),
  'issuer-curia-moderna': ids('b16', 'jpii', 'holySeeArchive', 'aas', 'cic'),
  'issuer-canon-law': ids('cdc', 'cceo', 'holySeeArchive', 'aas', 'jpii'),
  'issuer-denzinger': ids('denzinger', 'documentaCatholica', 'holySeeArchive', 'tanner', 'odcc'),
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
  if (documentId.includes('confesiones'))
    return ids('confessions', 'augustinusPortal', 'sepAugustine', 'brownAg', 'britannicaAugustine');
  if (documentId.includes('ciudad-de-dios'))
    return ids('cityOfGod', 'sepPolitical', 'brownAg', 'britannicaLateRome', 'augustinusPortal');
  if (documentId.includes('de-trinitate'))
    return ids('kelly', 'sepTrinity', 'brownAg', 'pelikan', 'augustinusPortal');
  if (documentId.includes('antimaniqueos'))
    return ids('brownAg', 'sepAugustine', 'chadwick', 'augustinusPortal');
  if (documentId.includes('antidonatistas'))
    return ids('brownAg', 'frend', 'sepAugustine', 'fordhamChurch');
  if (documentId.includes('antipelagianos') || documentId.includes('gracia'))
    return ids('brownAg', 'kelly', 'pelikan', 'sepAugustine', 'augustinusPortal');
  if (documentId.startsWith('agustin-'))
    return ids('brownAg', 'sepAugustine', 'augustinusPortal', 'britannicaAugustine', 'chadwick');
  if (documentId.includes('diogneto'))
    return ids('diognetus', 'diognetusCCEL', 'earlyChristianWritings', 'chadwick');
  if (documentId.includes('cirilo')) return ids('cyril', 'cyrilCCEL', 'kelly', 'fordhamChurch');
  if (documentId.includes('clemente')) return ids('clement', 'clementCCEL', 'chadwick', 'ccelECF');
  if (documentId.includes('cipriano')) return ids('cyprian', 'cyprianCCEL', 'frend', 'fordhamAncient');
  if (documentId.includes('gregorio-nisa') || documentId.includes('nisa'))
    return ids('gregoryNyssa', 'nyssaCCEL', 'kelly', 'sepTrinity');
  if (documentId.includes('bible')) return ids('bible', 'bibleES', 'odcc', 'fordhamAncient');
  if (documentId === 'cic-es') return ids('cic', 'jpii', 'holySeeArchive', 'aas', 'odcc');
  if (documentId.startsWith('cdc') || documentId.startsWith('cceo'))
    return ids('cdc', 'cceo', 'jpii', 'holySeeArchive', 'aas');
  if (documentId.includes('trento'))
    return ids('trent', 'tanner', 'britannicaTrent', 'documentaCatholica');
  if (documentId.includes('vat-i') || documentId.includes('vat-1'))
    return ids('vat1', 'vat1DeiFilius', 'tanner', 'papacyVaticanCouncils');
  if (
    [
      'sc-es',
      'lg-es',
      'gs-es',
      'dv-es',
      'aa-es',
      'ur-es',
      'cd-es',
      'ot-es',
      'pc-es',
      'po-es',
      'na-es',
      'dh-es',
      'ge-es',
      'im-es',
      'ag-es',
    ].includes(documentId)
  )
    return ids('vat2', 'britannicaVat2', 'tanner', 'papacyVaticanCouncils', 'holySeeArchive');
  if (
    documentId.includes('nicea') ||
    documentId.includes('calcedonia') ||
    documentId.includes('efeso') ||
    documentId.includes('constantinopla') ||
    documentId.includes('lateran') ||
    documentId.includes('lyon') ||
    documentId.includes('florencia') ||
    documentId.includes('constanza') ||
    documentId.includes('vienne') ||
    documentId.includes('jerusalen')
  )
    return ids(
      'tanner',
      'papacyVaticanCouncils',
      'britannicaCouncils',
      'fordhamChurch',
      'documentaCatholica',
    );
  if (authorProfileId === 'issuer-jp2') return ids('jpii', 'holySeeArchive', 'aas', 'odcc');
  if (authorProfileId === 'issuer-paul-vi') return ids('paulvi', 'vat2', 'holySeeArchive', 'aas');
  if (authorProfileId === 'issuer-curia-moderna')
    return ids('b16', 'jpii', 'holySeeArchive', 'aas', 'cic');
  if (authorProfileId === 'era-vat2')
    return ids('vat2', 'britannicaVat2', 'tanner', 'holySeeArchive');
  return ids('odcc', 'pelikan', 'tanner', 'holySeeArchive', 'britannicaChristianity');
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
