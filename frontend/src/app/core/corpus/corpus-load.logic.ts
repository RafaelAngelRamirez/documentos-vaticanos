/**
 * Pure corpus load + durable-store seam (no Angular, no relative TS imports).
 * Self-contained so node tests can load via --experimental-strip-types
 * (same pattern as app-update.logic.ts).
 *
 * Production wiring: CorpusService → CorpusLoadEngine + IndexedDbCorpusStore.
 */

// --- Minimal corpus shapes (kept aligned with corpus.models.ts) ---

export interface DocumentMeta {
  id: string;
  title: string;
  shortTitle?: string;
  kind: string;
  locale?: string;
  sourceUrl?: string;
  author?: string;
  compiler?: string;
  sourceNote?: string;
  bodyPath: string;
  indexPath: string;
  unitCount?: number;
}

export interface CorpusManifest {
  version: number | string;
  generatedAt?: string;
  documents: DocumentMeta[];
}

export interface Article {
  index_array?: number;
  consecutivo: string;
  contenido: string;
  referencias?: unknown[];
  biblia?: unknown;
}

export interface Indice {
  indice: { [key: string]: number[] };
  indice_por_punto: { [key: number]: number | null };
}

export interface LoadedDocument {
  meta: DocumentMeta;
  documento: Article[];
  indice: Indice;
  /**
   * True when `documento` may have holes (windowed / chunked load).
   * Reader may render; search / full-body callers should `ensureLoaded`.
   */
  partial?: boolean;
}

/**
 * Index-only load for progressive search (PR2b).
 * `bodyLoaded` is false until {@link CorpusLoadEngine.ensureLoaded} hydrates body.
 */
export interface IndexedDocument {
  meta: DocumentMeta;
  indice: Indice;
  bodyLoaded: boolean;
  /** Empty array when body not loaded; full units after ensureLoaded. */
  documento: Article[];
}

// --- Durable store ---

export interface StoredManifest {
  version: string | number;
  generatedAt?: string;
  documents: DocumentMeta[];
  savedAt: number;
}

export interface StoredDocument {
  documentId: string;
  fingerprint: string;
  meta: DocumentMeta;
  documento: Article[];
  indice: Indice;
  savedAt: number;
}

/**
 * Fingerprint for a document relative to the current pack entry.
 * Path / unitCount changes force re-download; new docs miss the store.
 * Pack-global version is omitted so unchanged books survive unrelated adds.
 */
export function documentFingerprint(meta: DocumentMeta): string {
  return [
    meta.id,
    meta.bodyPath || '',
    meta.indexPath || '',
    meta.unitCount == null ? '' : String(meta.unitCount),
  ].join('|');
}

export function isStoredDocumentValid(
  stored: StoredDocument | null | undefined,
  meta: DocumentMeta
): boolean {
  if (!stored || !meta) {
    return false;
  }
  if (stored.documentId !== meta.id) {
    return false;
  }
  if (!Array.isArray(stored.documento) || !stored.indice) {
    return false;
  }
  return stored.fingerprint === documentFingerprint(meta);
}

export function toStoredManifest(manifest: {
  version?: string | number;
  generatedAt?: string;
  documents: DocumentMeta[];
}): StoredManifest {
  return {
    version: manifest.version ?? '0',
    generatedAt: manifest.generatedAt,
    documents: Array.isArray(manifest.documents) ? manifest.documents : [],
    savedAt: Date.now(),
  };
}

export const BODY_CHUNK_SIZE = 40;

export function chunkIndexForUnit(
  unitIndex: number,
  size: number = BODY_CHUNK_SIZE
): number {
  if (!Number.isFinite(unitIndex) || unitIndex < 0) return 0;
  return Math.floor(unitIndex / size);
}

export function chunkRangeForWindow(
  from: number,
  to: number,
  size: number = BODY_CHUNK_SIZE
): { fromChunk: number; toChunk: number } {
  const a = Math.max(0, Math.min(from, to));
  const b = Math.max(0, Math.max(from, to));
  return {
    fromChunk: chunkIndexForUnit(a, size),
    toChunk: chunkIndexForUnit(b, size),
  };
}

export function windowIsFilled(
  documento: Article[] | undefined,
  from: number,
  to: number
): boolean {
  if (!documento || !documento.length) return false;
  const start = Math.max(0, from);
  const end = Math.min(documento.length, Math.max(from, to));
  for (let i = start; i < end; i++) {
    if (!documento[i]) return false;
  }
  return start < end || from >= end;
}

export interface StoredDocumentHead {
  documentId: string;
  fingerprint: string;
  meta: DocumentMeta;
  unitCount: number;
  chunkCount: number;
  savedAt: number;
  hasIndex?: boolean;
}

export interface CorpusDurableStore {
  getManifest(): Promise<StoredManifest | null>;
  setManifest(manifest: StoredManifest): Promise<void>;
  getDocument(documentId: string): Promise<StoredDocument | null>;
  setDocument(doc: StoredDocument): Promise<void>;
  deleteDocument(documentId: string): Promise<void>;
  clear(): Promise<void>;
  /** Optional: read only a range of units (chunked stores). */
  getUnits?(
    documentId: string,
    from: number,
    to: number
  ): Promise<Article[] | null>;
  /** Optional: fingerprint + counts without cloning the body. */
  peekDocument?(
    documentId: string
  ): Promise<Pick<
    StoredDocument,
    'documentId' | 'fingerprint' | 'meta' | 'savedAt'
  > | null>;
}

/** In-memory durable store for tests (shared across engine restarts). */
export class MemoryCorpusStore implements CorpusDurableStore {
  private manifest: StoredManifest | null = null;
  private docs: Map<string, StoredDocument> = new Map();

  async getManifest(): Promise<StoredManifest | null> {
    return this.manifest
      ? { ...this.manifest, documents: [...this.manifest.documents] }
      : null;
  }

  async setManifest(manifest: StoredManifest): Promise<void> {
    this.manifest = {
      ...manifest,
      documents: [...manifest.documents],
    };
  }

  async getDocument(documentId: string): Promise<StoredDocument | null> {
    const d = this.docs.get(documentId);
    return d
      ? { ...d, documento: [...d.documento], meta: { ...d.meta } }
      : null;
  }

  async setDocument(doc: StoredDocument): Promise<void> {
    this.docs.set(doc.documentId, {
      ...doc,
      meta: { ...doc.meta },
      documento: [...doc.documento],
      indice: {
        indice: { ...(doc.indice?.indice || {}) },
        indice_por_punto: { ...(doc.indice?.indice_por_punto || {}) },
      },
    });
  }

  async deleteDocument(documentId: string): Promise<void> {
    this.docs.delete(documentId);
  }

  async peekDocument(
    documentId: string
  ): Promise<Pick<
    StoredDocument,
    'documentId' | 'fingerprint' | 'meta' | 'savedAt'
  > | null> {
    const d = this.docs.get(documentId);
    if (!d) return null;
    return {
      documentId: d.documentId,
      fingerprint: d.fingerprint,
      meta: { ...d.meta },
      savedAt: d.savedAt,
    };
  }

  async getUnits(
    documentId: string,
    from: number,
    to: number
  ): Promise<Article[] | null> {
    const d = this.docs.get(documentId);
    if (!d || !Array.isArray(d.documento)) return null;
    const start = Math.max(0, from);
    const end = Math.min(d.documento.length, Math.max(from, to));
    return d.documento.slice(start, end).map((a) => ({ ...a }));
  }

  async clear(): Promise<void> {
    this.manifest = null;
    this.docs.clear();
  }

  size(): number {
    return this.docs.size;
  }
}

// --- Load engine ---

export const CORPUS_ROOT = 'assets/corpus';
export const MANIFEST_URL = `${CORPUS_ROOT}/manifest.json`;

export type CorpusHttpGet = <T>(url: string) => Promise<T>;

export interface CorpusLoadEngineOptions {
  httpGet: CorpusHttpGet;
  store: CorpusDurableStore;
  onHttpGet?: (url: string) => void;
}

/**
 * Load path: in-memory → durable store (if fingerprint valid) → HTTP.
 * Write-through on HTTP success. clearMemory() simulates page reload.
 */
export class CorpusLoadEngine {
  private manifest: DocumentMeta[] | null = null;
  private packVersion: string | number | null = null;
  private cache: Map<string, LoadedDocument> = new Map();
  /** Index-only memory cache (PR2b). Not written to durable store alone. */
  private indexCache: Map<string, Indice> = new Map();
  private manifestInflight: Promise<DocumentMeta[]> | null = null;
  private inflight: Map<string, Promise<LoadedDocument>> = new Map();
  private indexInflight: Map<string, Promise<IndexedDocument>> = new Map();

  private httpGet: CorpusHttpGet;
  private store: CorpusDurableStore;
  private onHttpGet: ((url: string) => void) | undefined;

  constructor(options: CorpusLoadEngineOptions) {
    this.httpGet = options.httpGet;
    this.store = options.store;
    this.onHttpGet = options.onHttpGet;
  }

  clearMemory(): void {
    this.manifest = null;
    this.packVersion = null;
    this.cache.clear();
    this.indexCache.clear();
    this.manifestInflight = null;
    this.inflight.clear();
    this.indexInflight.clear();
  }

  hasManifestInMemory(): boolean {
    return this.manifest !== null;
  }

  listDocuments(): DocumentMeta[] {
    return this.manifest ? [...this.manifest] : [];
  }

  getMeta(documentId: string): DocumentMeta | undefined {
    return this.manifest?.find((d) => this.matchesMeta(d, documentId));
  }

  getLoaded(documentId: string): LoadedDocument | undefined {
    return this.cache.get(documentId);
  }

  /** Cached inverted index without requiring a full body load. */
  getIndex(documentId: string): Indice | undefined {
    const full = this.cache.get(documentId);
    if (full) return full.indice;
    return this.indexCache.get(documentId);
  }

  /**
   * Load inverted index only (index.json). Does not fetch content.json.
   * Reuses full cache / durable full doc when available.
   * Never writes a body-less document to durable storage.
   */
  async ensureIndex(documentId: string): Promise<IndexedDocument> {
    const full = this.cache.get(documentId);
    if (full) {
      return {
        meta: full.meta,
        indice: full.indice,
        bodyLoaded: true,
        documento: full.documento,
      };
    }

    const pending = this.indexInflight.get(documentId);
    if (pending) return pending;

    const request = this.loadIndexOnly(documentId).finally(() => {
      this.indexInflight.delete(documentId);
    });
    this.indexInflight.set(documentId, request);
    return request;
  }

  private async loadIndexOnly(documentId: string): Promise<IndexedDocument> {
    const metas = await this.loadManifest();
    const meta = metas.find((m) => this.matchesMeta(m, documentId));
    if (!meta) {
      throw new Error(`Document not found in manifest: ${documentId}`);
    }

    // Race: full load may have completed while we waited on manifest.
    const full = this.cache.get(meta.id);
    if (full) {
      return {
        meta: full.meta,
        indice: full.indice,
        bodyLoaded: true,
        documento: full.documento,
      };
    }

    // Durable full doc → use index without HTTP body.
    try {
      const stored = await this.store.getDocument(meta.id);
      if (isStoredDocumentValid(stored, meta) && stored) {
        const indice = this.normalizeIndex(stored.indice);
        this.indexCache.set(meta.id, indice);
        // Promote to full memory cache so subsequent ensureLoaded is free.
        const loaded: LoadedDocument = {
          meta,
          documento: this.stampIndexArray(
            Array.isArray(stored.documento)
              ? ([...stored.documento] as Article[])
              : [],
          ),
          indice,
        };
        this.remember(loaded);
        return {
          meta,
          indice,
          bodyLoaded: true,
          documento: loaded.documento,
        };
      }
    } catch {
      /* fall through */
    }

    const cachedIdx = this.indexCache.get(meta.id);
    if (cachedIdx) {
      return {
        meta,
        indice: cachedIdx,
        bodyLoaded: false,
        documento: [],
      };
    }

    const indexUrl = this.resolveAssetPath(meta.indexPath);
    const rawIndex = await this.getJson<unknown>(indexUrl);
    const indice = this.normalizeIndex(rawIndex);
    this.indexCache.set(meta.id, indice);
    return {
      meta,
      indice,
      bodyLoaded: false,
      documento: [],
    };
  }

  async loadManifest(): Promise<DocumentMeta[]> {
    if (this.manifest) {
      return this.manifest;
    }
    if (this.manifestInflight) {
      return this.manifestInflight;
    }

    this.manifestInflight = this.fetchManifest().finally(() => {
      this.manifestInflight = null;
    });
    return this.manifestInflight;
  }

  private async fetchManifest(): Promise<DocumentMeta[]> {
    try {
      const raw = await this.getJson<CorpusManifest>(MANIFEST_URL);
      const documents = raw?.documents ?? [];
      this.manifest = documents;
      this.packVersion = raw?.version ?? '0';
      try {
        await this.store.setManifest(toStoredManifest(raw || { documents }));
      } catch {
        /* quota / private mode */
      }
      return documents;
    } catch (networkErr) {
      try {
        const stored = await this.store.getManifest();
        if (stored?.documents?.length) {
          this.manifest = stored.documents;
          this.packVersion = stored.version;
          return stored.documents;
        }
      } catch {
        /* ignore */
      }
      throw networkErr;
    }
  }

  async ensureLoaded(documentId: string): Promise<LoadedDocument> {
    const cached = this.cache.get(documentId);
    if (cached && !cached.partial) {
      return cached;
    }

    const pending = this.inflight.get(documentId);
    if (pending) {
      return pending;
    }

    const request = this.loadDocument(documentId).finally(() => {
      this.inflight.delete(documentId);
    });
    this.inflight.set(documentId, request);
    return request;
  }

  private async loadDocument(documentId: string): Promise<LoadedDocument> {
    const metas = await this.loadManifest();
    const meta = metas.find((m) => this.matchesMeta(m, documentId));
    if (!meta) {
      throw new Error(`Document not found in manifest: ${documentId}`);
    }

    const byId = this.cache.get(meta.id);
    if (byId) {
      return byId;
    }

    try {
      const stored = await this.store.getDocument(meta.id);
      if (isStoredDocumentValid(stored, meta) && stored) {
        const loaded: LoadedDocument = {
          meta,
          documento: this.stampIndexArray(
            Array.isArray(stored.documento)
              ? ([...stored.documento] as Article[])
              : []
          ),
          indice: this.normalizeIndex(stored.indice),
        };
        this.remember(loaded);
        return loaded;
      }
    } catch {
      /* fall through to HTTP */
    }

    const bodyUrl = this.resolveAssetPath(meta.bodyPath);
    const body = await this.getJson<Article[]>(bodyUrl);

    // Reuse index-only cache when present (PR2b: avoid double index fetch).
    let indice = this.indexCache.get(meta.id);
    if (!indice) {
      const indexUrl = this.resolveAssetPath(meta.indexPath);
      const rawIndex = await this.getJson<unknown>(indexUrl);
      indice = this.normalizeIndex(rawIndex);
    }

    const documento = this.stampIndexArray(
      Array.isArray(body) ? ([...body] as Article[]) : []
    );
    const loaded: LoadedDocument = {
      meta,
      documento,
      indice,
      partial: false,
    };
    this.remember(loaded);
    this.indexCache.set(meta.id, indice);
    await this.persistLoaded(loaded);
    return loaded;
  }

  /**
   * Reader path: body only (no index.json), optional unit window from durable
   * chunks. Persists in the background so first paint is not blocked by IDB.
   */
  async ensureWindow(
    documentId: string,
    focusIndex: number,
    radius: number
  ): Promise<LoadedDocument> {
    const cached = this.cache.get(documentId);
    const from = Math.max(0, (focusIndex || 0) - Math.max(0, radius));
    const to = (focusIndex || 0) + Math.max(0, radius) + 1;
    if (cached && !cached.partial && cached.documento.length) {
      return cached;
    }
    if (cached && windowIsFilled(cached.documento, from, to)) {
      return cached;
    }

    const pendingFull = this.inflight.get(documentId);
    if (pendingFull) {
      return pendingFull;
    }

    return this.loadWindow(documentId, from, to);
  }

  /**
   * Fill more units of a partial in-memory document (scroll / narrator).
   */
  async ensureUnits(
    documentId: string,
    from: number,
    to: number
  ): Promise<LoadedDocument> {
    const cached = this.cache.get(documentId);
    if (cached && !cached.partial) {
      return cached;
    }
    if (cached && windowIsFilled(cached.documento, from, to)) {
      return cached;
    }
    const pendingFull = this.inflight.get(documentId);
    if (pendingFull) {
      return pendingFull;
    }
    return this.loadWindow(documentId, from, to);
  }

  private async loadWindow(
    documentId: string,
    from: number,
    to: number
  ): Promise<LoadedDocument> {
    const metas = await this.loadManifest();
    const meta = metas.find((m) => this.matchesMeta(m, documentId));
    if (!meta) {
      throw new Error(`Document not found in manifest: ${documentId}`);
    }

    const byId = this.cache.get(meta.id);
    if (byId && !byId.partial) {
      return byId;
    }
    if (byId && windowIsFilled(byId.documento, from, to)) {
      return byId;
    }

    try {
      if (typeof this.store.getUnits === 'function') {
        const peek =
          typeof this.store.peekDocument === 'function'
            ? await this.store.peekDocument(meta.id)
            : await this.store.getDocument(meta.id);
        if (
          peek &&
          peek.documentId === meta.id &&
          peek.fingerprint === documentFingerprint(meta)
        ) {
          const units = await this.store.getUnits(meta.id, from, to);
          if (units && units.length) {
            const unitCount = meta.unitCount || byId?.documento.length || 0;
            const stub: StoredDocument = {
              documentId: meta.id,
              fingerprint: peek.fingerprint,
              meta,
              documento: new Array(unitCount || to),
              indice: { indice: {}, indice_por_punto: {} },
              savedAt: peek.savedAt,
            };
            const merged = this.mergeUnits(byId, meta, stub, units, from, to);
            this.remember(merged);
            return merged;
          }
        }
      }

      const storedFull = await this.store.getDocument(meta.id);
      if (isStoredDocumentValid(storedFull, meta) && storedFull) {
        const loaded: LoadedDocument = {
          meta,
          documento: this.stampIndexArray(
            Array.isArray(storedFull.documento)
              ? ([...storedFull.documento] as Article[])
              : []
          ),
          indice: this.normalizeIndex(storedFull.indice),
          partial: false,
        };
        this.remember(loaded);
        return loaded;
      }
    } catch {
      /* fall through to HTTP body */
    }

    const bodyUrl = this.resolveAssetPath(meta.bodyPath);
    const body = await this.getJson<Article[]>(bodyUrl);
    const documento = this.stampIndexArray(
      Array.isArray(body) ? ([...body] as Article[]) : []
    );
    const indice = this.indexCache.get(meta.id) || {
      indice: {},
      indice_por_punto: {},
    };
    const loaded: LoadedDocument = {
      meta,
      documento,
      indice,
      partial: false,
    };
    this.remember(loaded);
    void this.persistLoaded(loaded);
    return loaded;
  }

  private mergeUnits(
    existing: LoadedDocument | undefined,
    meta: DocumentMeta,
    stored: StoredDocument,
    units: Article[],
    from: number,
    to: number
  ): LoadedDocument {
    const unitCount =
      stored.documento?.length ||
      meta.unitCount ||
      Math.max(to, from + units.length);
    const documento = existing?.documento?.length
      ? existing.documento
      : new Array(unitCount);
    if (documento.length < unitCount) {
      documento.length = unitCount;
    }
    for (const article of units) {
      const i =
        typeof article.index_array === 'number'
          ? article.index_array
          : documento.indexOf(article);
      if (i >= 0) {
        documento[i] = article;
        article.index_array = i;
      }
    }
    // Stamp any unstamped slice we just copied.
    for (let i = Math.max(0, from); i < Math.min(documento.length, to); i++) {
      if (documento[i]) documento[i].index_array = i;
    }
    const filled = windowIsFilled(documento, 0, documento.length);
    return {
      meta,
      documento,
      indice: existing?.indice || this.normalizeIndex(stored.indice),
      partial: !filled,
    };
  }

  private async persistLoaded(loaded: LoadedDocument): Promise<void> {
    if (loaded.partial) return;
    const storedDoc: StoredDocument = {
      documentId: loaded.meta.id,
      fingerprint: documentFingerprint(loaded.meta),
      meta: loaded.meta,
      documento: loaded.documento,
      indice: loaded.indice,
      savedAt: Date.now(),
    };
    try {
      await this.store.setDocument(storedDoc);
    } catch {
      /* quota — keep memory only */
    }
  }

  async ensureAllLoaded(): Promise<LoadedDocument[]> {
    const metas = await this.loadManifest();
    if (!metas.length) {
      return [];
    }
    return Promise.all(metas.map((m) => this.ensureLoaded(m.id)));
  }

  normalizeIndex(raw: unknown): Indice {
    if (!raw || typeof raw !== 'object') {
      return { indice: {}, indice_por_punto: {} };
    }

    const obj = raw as { [key: string]: unknown };

    if (
      obj['indice'] &&
      typeof obj['indice'] === 'object' &&
      !Array.isArray(obj['indice'])
    ) {
      const indice = obj['indice'] as Indice['indice'];
      const indice_por_punto =
        obj['indice_por_punto'] &&
        typeof obj['indice_por_punto'] === 'object' &&
        !Array.isArray(obj['indice_por_punto'])
          ? (obj['indice_por_punto'] as Indice['indice_por_punto'])
          : {};
      return { indice, indice_por_punto };
    }

    return {
      indice: obj as Indice['indice'],
      indice_por_punto: {},
    };
  }

  resolveAssetPath(path: string): string {
    const cleaned = path.replace(/^\//, '');
    if (cleaned.startsWith('assets/')) {
      return cleaned;
    }
    return `${CORPUS_ROOT}/${cleaned}`;
  }

  private async getJson<T>(url: string): Promise<T> {
    if (this.onHttpGet) {
      this.onHttpGet(url);
    }
    return this.httpGet<T>(url);
  }

  private matchesMeta(meta: DocumentMeta, idOrTitle: string): boolean {
    return (
      meta.id === idOrTitle ||
      meta.title === idOrTitle ||
      meta.shortTitle === idOrTitle
    );
  }

  private remember(loaded: LoadedDocument): void {
    this.cache.set(loaded.meta.id, loaded);
    this.cache.set(loaded.meta.title, loaded);
    if (loaded.meta.shortTitle) {
      this.cache.set(loaded.meta.shortTitle, loaded);
    }
    this.indexCache.set(loaded.meta.id, loaded.indice);
  }

  private stampIndexArray(articles: Article[]): Article[] {
    articles.forEach((article, i) => {
      article.index_array = i;
    });
    return articles;
  }
}
