/**
 * Dual-write offline historical-context pack next to corpus roots.
 */
import fs from 'fs';
import path from 'path';
import type {
  AuthorContextProfile,
  DocumentContextOverlay,
  HistoricalContextManifest,
} from '../../models/historical-context.model';

const REPO = path.resolve(__dirname, '../../..');

export const CONTEXT_ROOTS = [
  path.join(REPO, 'documentos', 'corpus', 'context'),
  path.join(REPO, 'frontend', 'src', 'assets', 'corpus', 'context'),
];

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(file: string, data: unknown): void {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

/**
 * Write authors/, documents/, and manifest.json to every context root.
 */
export function writeHistoricalContextPack(opts: {
  authors: AuthorContextProfile[];
  documents: DocumentContextOverlay[];
  version?: string;
  sourceNote?: string;
}): { roots: string[]; authorCount: number; documentCount: number } {
  const generatedAt = new Date().toISOString();
  const version = opts.version || '1.0.0';
  const sourceNote =
    opts.sourceNote ||
    'Pack de contexto histórico offline (compilado; ejes + referencias). No es monografía peer-reviewed.';

  const authorsSorted = opts.authors
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id));
  const docsSorted = opts.documents
    .slice()
    .sort((a, b) => a.documentId.localeCompare(b.documentId));

  const manifest: HistoricalContextManifest = {
    version,
    generatedAt,
    sourceNote,
    authors: authorsSorted.map((a) => ({
      id: a.id,
      path: `authors/${a.id}.json`,
    })),
    documents: docsSorted.map((d) => ({
      documentId: d.documentId,
      path: `documents/${d.documentId}.json`,
      authorProfileId: d.authorProfileId,
    })),
  };

  for (const root of CONTEXT_ROOTS) {
    ensureDir(path.join(root, 'authors'));
    ensureDir(path.join(root, 'documents'));
    // clean stale document overlays not in this build? keep simple: overwrite known files
    for (const a of authorsSorted) {
      writeJson(path.join(root, 'authors', `${a.id}.json`), a);
    }
    for (const d of docsSorted) {
      writeJson(path.join(root, 'documents', `${d.documentId}.json`), d);
    }
    writeJson(path.join(root, 'manifest.json'), manifest);
  }

  return {
    roots: CONTEXT_ROOTS,
    authorCount: authorsSorted.length,
    documentCount: docsSorted.length,
  };
}

export function readContextManifest(
  root?: string,
): HistoricalContextManifest | null {
  const file = path.join(root || CONTEXT_ROOTS[0], 'manifest.json');
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as HistoricalContextManifest;
}
