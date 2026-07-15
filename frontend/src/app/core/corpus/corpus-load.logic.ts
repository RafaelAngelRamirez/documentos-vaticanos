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

export interface CorpusDurableStore {
  getManifest(): Promise<StoredManifest | null>;
  setManifest(manifest: StoredManifest): Promise<void>;
  getDocument(documentId: string): Promise<StoredDocument | null>;
  setDocument(doc: StoredDocument): Promise<void>;
  deleteDocument(documentId: string): Promise<void>;
  clear(): Promise<void>;
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
  private manifestInflight: Promise<DocumentMeta[]> | null = null;
  private inflight: Map<string, Promise<LoadedDocument>> = new Map();

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
    this.manifestInflight = null;
    this.inflight.clear();
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
    if (cached) {
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
    const indexUrl = this.resolveAssetPath(meta.indexPath);

    const body = await this.getJson<Article[]>(bodyUrl);
    const rawIndex = await this.getJson<unknown>(indexUrl);

    const documento = this.stampIndexArray(
      Array.isArray(body) ? ([...body] as Article[]) : []
    );
    const indice = this.normalizeIndex(rawIndex);
    const loaded: LoadedDocument = {
      meta,
      documento,
      indice,
    };
    this.remember(loaded);

    const storedDoc: StoredDocument = {
      documentId: meta.id,
      fingerprint: documentFingerprint(meta),
      meta,
      documento,
      indice,
      savedAt: Date.now(),
    };
    try {
      await this.store.setDocument(storedDoc);
    } catch {
      /* quota — keep memory only */
    }

    return loaded;
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
  }

  private stampIndexArray(articles: Article[]): Article[] {
    articles.forEach((article, i) => {
      article.index_array = i;
    });
    return articles;
  }
}
