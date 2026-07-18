/**
 * Build offline historical-context pack for every corpus documentId.
 *
 * Usage:
 *   npx ts-node --transpile-only build_historical_context.ts
 *   npm run context:build
 */
import fs from 'fs';
import path from 'path';
import type {
  ContextAxes,
  DocumentContextOverlay,
} from './models/historical-context.model';
import { AUTHOR_PROFILES } from './src/context/seed_profiles';
import { buildAllDocumentSeeds } from './src/context/seed_documents';
import { writeHistoricalContextPack } from './src/context/write_context';
import { R } from './src/context/refs';

const REPO = path.resolve(__dirname, '..');
const MANIFESTS = [
  path.join(REPO, 'documentos', 'corpus', 'manifest.json'),
  path.join(REPO, 'frontend', 'src', 'assets', 'corpus', 'manifest.json'),
];

function loadCorpusIds(): { id: string; title: string; kind: string; author?: string }[] {
  let best: { id: string; title: string; kind: string; author?: string }[] = [];
  for (const p of MANIFESTS) {
    if (!fs.existsSync(p)) continue;
    const m = JSON.parse(fs.readFileSync(p, 'utf-8'));
    const docs = (m.documents || []).map(
      (d: { id: string; title: string; kind: string; author?: string }) => ({
        id: d.id,
        title: d.title,
        kind: d.kind,
        author: d.author,
      }),
    );
    if (docs.length > best.length) best = docs;
  }
  return best;
}

function guessProfile(doc: {
  id: string;
  kind: string;
  author?: string;
  title: string;
}): string {
  const id = doc.id;
  if (id.startsWith('agustin-')) return 'agustin-hipona';
  if (doc.author?.includes('Agustín')) return 'agustin-hipona';
  if (id.includes('cirilo')) return 'cirilo-jerusalen';
  if (id.includes('clemente')) return 'clemente-alejandria';
  if (id.includes('cipriano')) return 'cipriano-cartago';
  if (id.includes('gregorio-nisa') || id.includes('nisa')) return 'gregorio-nisa';
  if (id.includes('diogneto')) return 'diogneto-anonimo';
  if (id.includes('bible')) return 'sagrada-escritura';
  if (doc.kind === 'council' || /-(la|es)$/.test(id) && (
    id.includes('nicea') ||
    id.includes('constantinopla') ||
    id.includes('calcedonia') ||
    id.includes('efeso') ||
    id.includes('lateran') ||
    id.includes('lyon') ||
    id.includes('trento') ||
    id.includes('vat-') ||
    id.includes('constanza') ||
    id.includes('florencia') ||
    id.includes('vienne') ||
    id.includes('jerusalen')
  )) {
    // finer guess
    if (id.startsWith('jerusalen')) return 'era-concilio-jerusalen';
    if (
      id.startsWith('nicea-i') ||
      id.startsWith('constantinopla-i-') ||
      id.startsWith('efeso') ||
      id.startsWith('calcedonia')
    )
      return 'era-concilios-antiguos';
    if (
      id.startsWith('constantinopla-ii') ||
      id.startsWith('constantinopla-iii') ||
      id.startsWith('nicea-ii')
    )
      return 'era-concilios-bizantinos';
    if (id.startsWith('trento')) return 'era-trento';
    if (id.startsWith('vat-i')) return 'era-vat1';
    return 'era-concilios-medievales';
  }
  if (
    [
      'sc-es', 'lg-es', 'gs-es', 'dv-es', 'aa-es', 'ur-es', 'cd-es', 'ot-es',
      'pc-es', 'po-es', 'na-es', 'dh-es', 'ge-es', 'im-es', 'ag-es',
    ].includes(id)
  )
    return 'era-vat2';
  if (id === 'cic-es' || id.startsWith('cdc') || id === 'cds-es') return 'issuer-jp2';
  if (id.startsWith('cceo')) return 'issuer-canon-law';
  if (id.includes('catecismo-romano')) return 'era-trento';
  if (id.includes('quanta-cura')) return 'issuer-pius-ix';
  return 'issuer-curia-moderna';
}

const FALLBACK_AXES = (title: string, kind: string): Partial<ContextAxes> => ({
  lugar: `Contexto geográfico asociado a «${title}» según su género (${kind}) en la historia de la Iglesia y del Mediterráneo / Europa cristiana.`,
  personajes: `Actores eclesiásticos y civiles vinculados a la producción o recepción de «${title}».`,
  gobierno: `Estructuras de poder (imperio, monarquía, Estado moderno o gobierno eclesial) del periodo en que se sitúa «${title}».`,
  cultura: `Letras, lenguas y formas culturales del medio histórico de «${title}».`,
  religion: `Paisaje religioso (cristianismos, judaísmo, islam, cultos tradicionales o secularización) contemporáneo a «${title}».`,
  antropologia: `Formas de vida, familia, estatus y prácticas cotidianas del auditorio histórico de «${title}».`,
  creenciasMundanas: `Cosmovisiones no cristianas o seculares concurrentes en el horizonte de «${title}».`,
  creenciaCristiana: `Confesión y teología cristiana predominante en el medio de «${title}» (${kind}).`,
});

function main(): void {
  const corpus = loadCorpusIds();
  if (!corpus.length) {
    console.error('No corpus documents found in manifests');
    process.exit(1);
  }

  const seeds = buildAllDocumentSeeds();
  const byId = new Map(seeds.map((s) => [s.documentId, s]));

  const documents: DocumentContextOverlay[] = [];
  const missing: string[] = [];

  for (const doc of corpus) {
    let overlay = byId.get(doc.id);
    if (!overlay) {
      missing.push(doc.id);
      const profileId = guessProfile(doc);
      overlay = {
        documentId: doc.id,
        authorProfileId: profileId,
        compositionYears: 'ver perfil de época',
        compositionPlace: 'ver perfil de época',
        workSummary: `Contexto histórico de «${doc.title}» (${doc.kind}).`,
        chronologyNote: `Documento del corpus sin ficha monográfica dedicada; se enlaza al perfil «${profileId}» y a ejes genéricos del género ${doc.kind}.`,
        axes: FALLBACK_AXES(doc.title, doc.kind),
        timelineSlice: [
          {
            years: '—',
            label: doc.title,
            note: 'Datación fina: ver referencias del perfil de época/emisor.',
          },
        ],
        references: [R.odcc, R.pelikan, R.tanner],
        sourceNote:
          'Entrada de cobertura automática del pack; enriquecer cuando haya monografía dedicada.',
      };
    }
    documents.push(overlay);
  }

  // Only ship author profiles that are referenced
  const used = new Set(
    documents.map((d) => d.authorProfileId).filter(Boolean) as string[],
  );
  const authors = AUTHOR_PROFILES.filter((a) => used.has(a.id));

  const result = writeHistoricalContextPack({
    authors,
    documents,
    version: '1.0.0',
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        corpusDocuments: corpus.length,
        writtenDocuments: result.documentCount,
        authors: result.authorCount,
        autoFallback: missing.length,
        fallbackIds: missing,
        roots: result.roots,
      },
      null,
      2,
    ),
  );

  if (documents.length !== corpus.length) {
    console.error('document count mismatch');
    process.exit(1);
  }
}

main();
