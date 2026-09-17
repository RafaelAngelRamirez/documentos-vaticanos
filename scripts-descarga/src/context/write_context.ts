/**
 * Write the offline historical-context pack to documentos/corpus/context, then copy to assets.
 */
import fs from 'fs';
import path from 'path';
import type {
  AuthorContextProfile,
  DocumentContextOverlay,
  HistoricalContextManifest,
} from '../../models/historical-context.model';
import {
  ASSETS_CORPUS_ROOT,
  CANONICAL_CORPUS_ROOT,
  syncCorpusPathToAssets,
} from '../pipeline/write_corpus';

export const CONTEXT_ROOTS = [
  path.join(CANONICAL_CORPUS_ROOT, 'context'),
  path.join(ASSETS_CORPUS_ROOT, 'context'),
];

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(file: string, data: unknown): void {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

/**
 * Write authors/, documents/, and manifest.json to the canonical context pack.
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

  const root = CONTEXT_ROOTS[0];
  ensureDir(path.join(root, 'authors'));
  ensureDir(path.join(root, 'documents'));
  for (const a of authorsSorted) {
    writeJson(path.join(root, 'authors', `${a.id}.json`), a);
  }
  for (const d of docsSorted) {
    writeJson(path.join(root, 'documents', `${d.documentId}.json`), d);
  }
  writeJson(path.join(root, 'manifest.json'), manifest);
  syncCorpusPathToAssets('context');

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
