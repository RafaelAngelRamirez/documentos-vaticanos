/**
 * Dual-write offline santoral pack next to corpus roots.
 */
import fs from 'fs';
import path from 'path';
import type { SantoralManifest, SaintRecord } from '../../models/santoral.model';

const REPO = path.resolve(__dirname, '../../..');

export const SANTORAL_ROOTS = [
  path.join(REPO, 'documentos', 'corpus', 'santoral'),
  path.join(REPO, 'frontend', 'src', 'assets', 'corpus', 'santoral'),
];

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Write manifest.json to every santoral root (pretty JSON for pack readability).
 */
export function writeSantoralPack(manifest: SantoralManifest): {
  roots: string[];
  saintCount: number;
} {
  const payload: SantoralManifest = {
    ...manifest,
    generatedAt: manifest.generatedAt || new Date().toISOString(),
    saints: (manifest.saints || []).slice().sort((a, b) =>
      (a.displayName || a.name).localeCompare(b.displayName || b.name, 'es'),
    ),
  };
  const text = JSON.stringify(payload, null, 2) + '\n';
  for (const root of SANTORAL_ROOTS) {
    ensureDir(root);
    fs.writeFileSync(path.join(root, 'manifest.json'), text, 'utf-8');
  }
  return { roots: SANTORAL_ROOTS, saintCount: payload.saints.length };
}

export function readSantoralPack(root?: string): SantoralManifest | null {
  const file = path.join(
    root || SANTORAL_ROOTS[0],
    'manifest.json',
  );
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as SantoralManifest;
}

/** Merge saints by id (incoming overwrites same fields; documentIds union). */
export function mergeSaints(
  base: SaintRecord[],
  incoming: SaintRecord[],
): SaintRecord[] {
  const map = new Map<string, SaintRecord>();
  for (const s of base) map.set(s.id, { ...s });
  for (const s of incoming) {
    const prev = map.get(s.id);
    if (!prev) {
      map.set(s.id, { ...s });
      continue;
    }
    const docSet = new Set([
      ...(prev.documentIds || []),
      ...(s.documentIds || []),
    ]);
    const aliasSet = new Set([
      ...(prev.authorAliases || []),
      ...(s.authorAliases || []),
    ]);
    map.set(s.id, {
      ...prev,
      ...s,
      bio: s.bio || prev.bio,
      sourceUrl: s.sourceUrl || prev.sourceUrl,
      documentIds: Array.from(docSet).sort(),
      authorAliases: Array.from(aliasSet),
      themes: s.themes?.length ? s.themes : prev.themes,
    });
  }
  return Array.from(map.values());
}
