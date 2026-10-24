/**
 * Write the offline papacy pack to documentos/corpus/papacy, then copy to assets.
 */
import fs from 'fs';
import path from 'path';
import type { PapacyManifest, PopeRecord } from '../../models/papacy.model';
import {
  ASSETS_CORPUS_ROOT,
  CANONICAL_CORPUS_ROOT,
  syncCorpusPathToAssets,
} from '../pipeline/write_corpus';

export const PAPACY_ROOTS = [
  path.join(CANONICAL_CORPUS_ROOT, 'papacy'),
  path.join(ASSETS_CORPUS_ROOT, 'papacy'),
];

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function writePapacyPack(manifest: PapacyManifest): {
  roots: string[];
  popeCount: number;
} {
  const popes = (manifest.popes || [])
    .slice()
    .sort((a, b) => (a.ordinal || 0) - (b.ordinal || 0));
  const payload: PapacyManifest = {
    ...manifest,
    generatedAt: manifest.generatedAt || new Date().toISOString(),
    popes,
  };
  const text = JSON.stringify(payload, null, 2) + '\n';
  const root = PAPACY_ROOTS[0];
  ensureDir(root);
  fs.writeFileSync(path.join(root, 'manifest.json'), text, 'utf-8');
  syncCorpusPathToAssets('papacy');
  return { roots: PAPACY_ROOTS, popeCount: payload.popes.length };
}

export function writePapacyDocumentsCatalog(
  documents: unknown,
  filename = 'documents.json',
): string[] {
  const text = JSON.stringify(documents, null, 2) + '\n';
  const root = PAPACY_ROOTS[0];
  ensureDir(root);
  const dest = path.join(root, filename);
  fs.writeFileSync(dest, text, 'utf-8');
  syncCorpusPathToAssets(path.join('papacy', filename));
  return [dest, path.join(PAPACY_ROOTS[1], filename)];
}

export function readPapacyPack(root?: string): PapacyManifest | null {
  const file = path.join(root || PAPACY_ROOTS[0], 'manifest.json');
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as PapacyManifest;
}

export function mergePopeWorks(
  base: PopeRecord,
  extra: PopeRecord,
): PopeRecord {
  const docSet = new Set([
    ...(base.documentIds || []),
    ...(extra.documentIds || []),
  ]);
  const workKey = (w: { documentId?: string; sourceUrl?: string; title?: string }) =>
    w.documentId || w.sourceUrl || w.title || '';
  const works = [...(base.works || [])];
  const seen = new Set(works.map(workKey));
  for (const w of extra.works || []) {
    const k = workKey(w);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    works.push(w);
  }
  const bio =
    (extra.bio || '').length > (base.bio || '').length ? extra.bio : base.bio;
  return {
    ...base,
    ...extra,
    bio,
    documentIds: Array.from(docSet).sort(),
    works,
    feastDays: Array.from(
      new Set([...(base.feastDays || []), ...(extra.feastDays || [])]),
    ),
  };
}
