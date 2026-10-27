/**
 * Patristic pack: install once, then read offline.
 * No network. A hash mismatch refuses the pack.
 * Pure: no Angular. Node tests load this file with strip-types.
 */

export const PATRISTIC_PACK_ID = 'patristica';
export const PATRISTIC_PACK_VERSION = 1;

export interface PatristicPackDocument {
  id: string;
  title: string;
  shortTitle?: string;
  kind: string;
  locale?: string;
  sourceUrl?: string;
  author?: string;
  compiler?: string;
  sourceNote?: string;
  translationProvenance?: 'official' | 'ai';
  bodyPath: string;
  indexPath: string;
  unitCount?: number;
  contentHash?: string;
  packId: typeof PATRISTIC_PACK_ID;
  contentSha256: string;
  contentBytes: number;
}

export interface PatristicPackManifest {
  id: typeof PATRISTIC_PACK_ID;
  version: number;
  packSha256: string;
  documents: PatristicPackDocument[];
}

export interface PatristicPackStore {
  read(relPath: string): Promise<Uint8Array | null>;
  size(relPath: string): Promise<number | null>;
  write(relPath: string, bytes: Uint8Array): Promise<void>;
  removeAll(): Promise<void>;
}

export interface PatristicPackSource {
  read(relPath: string): Promise<Uint8Array | null>;
}

export type InstallPatristicResult =
  | { ok: true; documentCount: number; manifest: PatristicPackManifest }
  | { ok: false; reason: string };

export class MemoryPackStore implements PatristicPackStore {
  private files = new Map<string, Uint8Array>();

  async read(relPath: string): Promise<Uint8Array | null> {
    const hit = this.files.get(normalizeRel(relPath));
    return hit ? hit.slice() : null;
  }

  async size(relPath: string): Promise<number | null> {
    const hit = this.files.get(normalizeRel(relPath));
    return hit ? hit.byteLength : null;
  }

  async write(relPath: string, bytes: Uint8Array): Promise<void> {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    this.files.set(normalizeRel(relPath), copy);
  }

  async removeAll(): Promise<void> {
    this.files.clear();
  }
}

export function sourceFromMap(
  files: Map<string, Uint8Array>,
): PatristicPackSource {
  return {
    async read(relPath: string) {
      const hit = files.get(normalizeRel(relPath));
      return hit ?? null;
    },
  };
}

export function normalizeRel(relPath: string): string {
  return String(relPath || '')
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '')
    .replace(/^\/+/, '');
}

export function assetUrlToPackRel(url: string): string | null {
  const cleaned = String(url || '')
    .replace(/^\//, '')
    .split('?')[0]
    .split('#')[0];
  const marker = 'documents/';
  const i = cleaned.indexOf(marker);
  if (i < 0) return null;
  const rel = normalizeRel(cleaned.slice(i));
  if (!rel || rel.includes('..')) return null;
  return rel;
}

function safeDocId(id: string): string | null {
  if (typeof id !== 'string') return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id)) return null;
  if (id.includes('..')) return null;
  return id;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await crypto.subtle.digest('SHA-256', copy);
  const view = new Uint8Array(digest);
  let hex = '';
  for (let i = 0; i < view.length; i++) {
    hex += view[i].toString(16).padStart(2, '0');
  }
  return hex;
}

export async function packSha256(
  docs: readonly { id: string; contentSha256: string }[],
): Promise<string> {
  const rows = [...docs].sort((a, b) => a.id.localeCompare(b.id));
  const parts: string[] = [];
  for (const doc of rows) {
    parts.push(doc.id, '\0', doc.contentSha256.toLowerCase(), '\n');
  }
  return sha256Hex(new TextEncoder().encode(parts.join('')));
}

function u16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function u32(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
  );
}

function findEocd(bytes: Uint8Array): number {
  const min = Math.max(0, bytes.length - (65535 + 22));
  for (let i = bytes.length - 22; i >= min; i--) {
    if (
      bytes[i] === 0x50 &&
      bytes[i + 1] === 0x4b &&
      bytes[i + 2] === 0x05 &&
      bytes[i + 3] === 0x06
    ) {
      return i;
    }
  }
  return -1;
}

export async function inflateRaw(compressed: Uint8Array): Promise<Uint8Array> {
  const Ctor = (globalThis as unknown as Record<string, unknown>)[
    'DecompressionStream'
  ] as (new (format: string) => ReadableWritablePair<Uint8Array, Uint8Array>) | undefined;
  if (typeof Ctor !== 'function') {
    throw new Error('Este aparato no puede abrir el paquete comprimido');
  }
  const stream = new Blob([compressed]).stream().pipeThrough(new Ctor('deflate-raw'));
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

/**
 * Read a zip produced by `zip -X -r` (stored or deflate).
 * Names are the paths inside the pack (`manifest.json`, `documents/...`).
 */
export async function filesFromZip(
  bytes: Uint8Array,
): Promise<Map<string, Uint8Array>> {
  const out = new Map<string, Uint8Array>();
  if (bytes.length < 22) {
    throw new Error('El archivo no es un paquete zip');
  }
  const eocd = findEocd(bytes);
  if (eocd < 0) throw new Error('El archivo no es un paquete zip');
  const count = u16(bytes, eocd + 10);
  const cdOffset = u32(bytes, eocd + 16);
  let cursor = cdOffset;
  for (let n = 0; n < count; n++) {
    if (u32(bytes, cursor) !== 0x02014b50) {
      throw new Error('El paquete zip está cortado');
    }
    const flags = u16(bytes, cursor + 8);
    const method = u16(bytes, cursor + 10);
    const compSize = u32(bytes, cursor + 20);
    const nameLen = u16(bytes, cursor + 28);
    const extraLen = u16(bytes, cursor + 30);
    const commentLen = u16(bytes, cursor + 32);
    const localOffset = u32(bytes, cursor + 42);
    const nameBytes = bytes.subarray(cursor + 46, cursor + 46 + nameLen);
    const name = normalizeRel(new TextDecoder().decode(nameBytes));
    cursor += 46 + nameLen + extraLen + commentLen;
    if (!name || name.endsWith('/') || name.includes('..')) continue;
    if ((flags & 0x1) !== 0) {
      throw new Error('El paquete no puede estar cifrado');
    }
    if (u32(bytes, localOffset) !== 0x04034b50) {
      throw new Error('El paquete zip está cortado');
    }
    const localName = u16(bytes, localOffset + 26);
    const localExtra = u16(bytes, localOffset + 28);
    const dataStart = localOffset + 30 + localName + localExtra;
    const compressed = new Uint8Array(compSize);
    compressed.set(bytes.subarray(dataStart, dataStart + compSize));
    let data: Uint8Array;
    if (method === 0) {
      data = compressed;
    } else if (method === 8) {
      data = await inflateRaw(compressed);
    } else {
      throw new Error('El paquete usa una compresión no soportada');
    }
    out.set(name, data);
  }
  return out;
}

async function readManifestFrom(
  source: PatristicPackSource,
): Promise<{ manifest: PatristicPackManifest } | { error: string }> {
  const raw = await source.read('manifest.json');
  if (!raw) return { error: 'El paquete no trae manifiesto' };
  let parsed: PatristicPackManifest;
  try {
    parsed = JSON.parse(new TextDecoder().decode(raw)) as PatristicPackManifest;
  } catch {
    return { error: 'El manifiesto no se puede leer' };
  }
  if (
    !parsed ||
    parsed.id !== PATRISTIC_PACK_ID ||
    parsed.version !== PATRISTIC_PACK_VERSION ||
    !Array.isArray(parsed.documents) ||
    !parsed.documents.length
  ) {
    return { error: 'El manifiesto no es el paquete de patrística' };
  }
  const fingerprint = await packSha256(
    parsed.documents.map((doc) => ({
      id: String(doc.id),
      contentSha256: String(doc.contentSha256 || ''),
    })),
  );
  if (fingerprint !== parsed.packSha256) {
    return { error: 'El hash del manifiesto no coincide' };
  }
  return { manifest: parsed };
}

/**
 * Check every canonical content.json hash before writing.
 * A mismatch leaves the store as it was.
 */
export async function installPatristicPack(
  source: PatristicPackSource,
  store: PatristicPackStore,
): Promise<InstallPatristicResult> {
  const loaded = await readManifestFrom(source);
  if ('error' in loaded) return { ok: false, reason: loaded.error };
  const manifest = loaded.manifest;
  /** @type {string[]} */
  const rels = ['manifest.json'];
  for (const doc of manifest.documents) {
    const id = safeDocId(doc && doc.id);
    if (!id) return { ok: false, reason: 'El paquete trae un id inválido' };
    const contentRel = `documents/${id}/content.json`;
    const indexRel = `documents/${id}/index.json`;
    if (doc.bodyPath !== contentRel || doc.indexPath !== indexRel) {
      return { ok: false, reason: `Ruta inválida: ${id}` };
    }
    if (doc.packId !== PATRISTIC_PACK_ID || doc.kind !== 'patristic') {
      return { ok: false, reason: `La obra no es patrística: ${id}` };
    }
    const body = await source.read(contentRel);
    if (!body) return { ok: false, reason: `Falta el texto: ${id}` };
    if (body.byteLength !== doc.contentBytes) {
      return { ok: false, reason: `El texto no coincide: ${id}` };
    }
    const hex = await sha256Hex(body);
    if (hex !== String(doc.contentSha256 || '').toLowerCase()) {
      return { ok: false, reason: `El hash no coincide: ${id}` };
    }
    const index = await source.read(indexRel);
    if (!index || !index.byteLength) {
      return { ok: false, reason: `Falta el índice: ${id}` };
    }
    rels.push(contentRel, indexRel);
    const metaRel = `documents/${id}/meta.json`;
    if (await source.read(metaRel)) rels.push(metaRel);
  }

  const staged = new Map<string, Uint8Array>();
  for (const rel of rels) {
    const bytes = await source.read(rel);
    if (!bytes) return { ok: false, reason: `Falta un archivo: ${rel}` };
    staged.set(rel, bytes);
  }
  await store.removeAll();
  for (const [rel, bytes] of staged) {
    if (rel === 'manifest.json') continue;
    await store.write(rel, bytes);
  }
  const manifestBytes = staged.get('manifest.json');
  if (!manifestBytes) {
    await store.removeAll();
    return { ok: false, reason: 'El paquete no trae manifiesto' };
  }
  await store.write('manifest.json', manifestBytes);
  return {
    ok: true,
    documentCount: manifest.documents.length,
    manifest,
  };
}

/**
 * Open an already installed pack. Checks the manifest fingerprint and
 * the recorded size of each content.json. Does not fetch anything.
 * Returns null when the pack is absent or does not match.
 */
export async function readInstalledPack(
  store: PatristicPackStore,
): Promise<PatristicPackManifest | null> {
  const source: PatristicPackSource = {
    read: (rel) => store.read(rel),
  };
  const loaded = await readManifestFrom(source);
  if ('error' in loaded) return null;
  for (const doc of loaded.manifest.documents) {
    const id = safeDocId(doc.id);
    if (!id) return null;
    const size = await store.size(`documents/${id}/content.json`);
    if (size == null || size !== doc.contentBytes) return null;
    const indexSize = await store.size(`documents/${id}/index.json`);
    if (indexSize == null || indexSize <= 0) return null;
  }
  return loaded.manifest;
}
