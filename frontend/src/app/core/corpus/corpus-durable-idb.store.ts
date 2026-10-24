/**
 * IndexedDB-backed CorpusDurableStore for the web app.
 * Angular injectable; not imported by node strip-types tests.
 *
 * v2 stores bodies as unit chunks so the reader can hydrate a window
 * without cloning a 10–20 MB document on the main thread.
 */

import { Injectable } from '@angular/core';
import {
  BODY_CHUNK_SIZE,
  chunkIndexForUnit,
  CorpusDurableStore,
  Indice,
  StoredDocument,
  StoredManifest,
} from './corpus-load.logic';

const IDB_NAME = 'dv-corpus-v1';
const IDB_VERSION = 2;
const STORE_META = 'meta';
const STORE_DOCS = 'documents';
const STORE_HEADS = 'docHeads';
const STORE_CHUNKS = 'docChunks';
const STORE_INDEX = 'docIndex';
const MANIFEST_KEY = 'manifest';

interface StoredHead {
  documentId: string;
  fingerprint: string;
  meta: StoredDocument['meta'];
  unitCount: number;
  chunkCount: number;
  savedAt: number;
}

interface StoredChunk {
  documentId: string;
  chunk: number;
  units: StoredDocument['documento'];
}

interface StoredIndexRow {
  documentId: string;
  indice: Indice;
}

/**
 * Failures (private mode, quota) surface as rejected promises; callers
 * fall back to network.
 */
@Injectable({
  providedIn: 'root',
})
export class IndexedDbCorpusStore implements CorpusDurableStore {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDb(): Promise<IDBDatabase> {
    if (typeof indexedDB === 'undefined') {
      return Promise.reject(new Error('indexedDB unavailable'));
    }
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        let req: IDBOpenDBRequest;
        try {
          req = indexedDB.open(IDB_NAME, IDB_VERSION);
        } catch (err) {
          reject(err);
          return;
        }
        req.onerror = () => reject(req.error || new Error('IDB open failed'));
        req.onsuccess = () => resolve(req.result);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_META)) {
            db.createObjectStore(STORE_META);
          }
          if (!db.objectStoreNames.contains(STORE_DOCS)) {
            db.createObjectStore(STORE_DOCS, { keyPath: 'documentId' });
          }
          if (!db.objectStoreNames.contains(STORE_HEADS)) {
            db.createObjectStore(STORE_HEADS, { keyPath: 'documentId' });
          }
          if (!db.objectStoreNames.contains(STORE_CHUNKS)) {
            db.createObjectStore(STORE_CHUNKS, {
              keyPath: ['documentId', 'chunk'],
            });
          }
          if (!db.objectStoreNames.contains(STORE_INDEX)) {
            db.createObjectStore(STORE_INDEX, { keyPath: 'documentId' });
          }
        };
      });
    }
    return this.dbPromise;
  }

  private async withStore<T>(
    storeName: string,
    mode: IDBTransactionMode,
    fn: (store: IDBObjectStore) => IDBRequest | void
  ): Promise<T> {
    const db = await this.openDb();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      let req: IDBRequest | void;
      try {
        req = fn(store);
      } catch (err) {
        reject(err);
        return;
      }
      tx.oncomplete = () => {
        resolve(req ? (req.result as T) : (undefined as T));
      };
      tx.onerror = () => reject(tx.error || new Error('IDB transaction failed'));
      tx.onabort = () => reject(tx.error || new Error('IDB transaction aborted'));
    });
  }

  async getManifest(): Promise<StoredManifest | null> {
    try {
      const value = await this.withStore<StoredManifest | undefined>(
        STORE_META,
        'readonly',
        (store) => store.get(MANIFEST_KEY)
      );
      return value ?? null;
    } catch {
      return null;
    }
  }

  async setManifest(manifest: StoredManifest): Promise<void> {
    await this.withStore<void>(STORE_META, 'readwrite', (store) => {
      store.put(manifest, MANIFEST_KEY);
    });
  }

  async peekDocument(
    documentId: string
  ): Promise<Pick<
    StoredDocument,
    'documentId' | 'fingerprint' | 'meta' | 'savedAt'
  > | null> {
    try {
      const head = await this.withStore<StoredHead | undefined>(
        STORE_HEADS,
        'readonly',
        (store) => store.get(documentId)
      );
      if (head) {
        return {
          documentId: head.documentId,
          fingerprint: head.fingerprint,
          meta: head.meta,
          savedAt: head.savedAt,
        };
      }
      const legacy = await this.getLegacyDocument(documentId);
      if (!legacy) return null;
      return {
        documentId: legacy.documentId,
        fingerprint: legacy.fingerprint,
        meta: legacy.meta,
        savedAt: legacy.savedAt,
      };
    } catch {
      return null;
    }
  }

  async getUnits(
    documentId: string,
    from: number,
    to: number
  ): Promise<StoredDocument['documento'] | null> {
    try {
      const db = await this.openDb();
      if (!db.objectStoreNames.contains(STORE_CHUNKS)) {
        const legacy = await this.getLegacyDocument(documentId);
        if (!legacy?.documento) return null;
        return legacy.documento.slice(Math.max(0, from), Math.max(from, to));
      }
      const start = Math.max(0, from);
      const end = Math.max(from, to);
      if (end <= start) return [];
      const fromChunk = chunkIndexForUnit(start);
      const toChunk = chunkIndexForUnit(end - 1);
      const rows = await new Promise<StoredChunk[]>((resolve, reject) => {
        const tx = db.transaction(STORE_CHUNKS, 'readonly');
        const store = tx.objectStore(STORE_CHUNKS);
        const range = IDBKeyRange.bound(
          [documentId, fromChunk],
          [documentId, toChunk]
        );
        const req = store.getAll(range);
        req.onsuccess = () => resolve((req.result as StoredChunk[]) || []);
        req.onerror = () => reject(req.error);
      });
      if (!rows.length) {
        const legacy = await this.getLegacyDocument(documentId);
        if (!legacy?.documento) return null;
        return legacy.documento.slice(start, end);
      }
      const units: StoredDocument['documento'] = [];
      rows.sort((a, b) => a.chunk - b.chunk);
      for (const row of rows) {
        for (const u of row.units || []) {
          const i = u.index_array;
          if (typeof i === 'number' && i >= start && i < end) {
            units.push(u);
          }
        }
      }
      return units;
    } catch {
      return null;
    }
  }

  async getDocument(documentId: string): Promise<StoredDocument | null> {
    try {
      const db = await this.openDb();
      if (db.objectStoreNames.contains(STORE_HEADS)) {
        const head = await this.withStore<StoredHead | undefined>(
          STORE_HEADS,
          'readonly',
          (store) => store.get(documentId)
        );
        if (head) {
          const units = await this.readAllChunks(documentId, head.chunkCount);
          let indice: Indice = { indice: {}, indice_por_punto: {} };
          if (db.objectStoreNames.contains(STORE_INDEX)) {
            const idx = await this.withStore<StoredIndexRow | undefined>(
              STORE_INDEX,
              'readonly',
              (store) => store.get(documentId)
            );
            if (idx?.indice) indice = idx.indice;
          }
          return {
            documentId: head.documentId,
            fingerprint: head.fingerprint,
            meta: head.meta,
            documento: units,
            indice,
            savedAt: head.savedAt,
          };
        }
      }
      return this.getLegacyDocument(documentId);
    } catch {
      return null;
    }
  }

  async setDocument(doc: StoredDocument): Promise<void> {
    const db = await this.openDb();
    const units = Array.isArray(doc.documento) ? doc.documento : [];
    const chunkCount = Math.ceil(units.length / BODY_CHUNK_SIZE) || 0;
    const names = [STORE_HEADS, STORE_CHUNKS];
    if (db.objectStoreNames.contains(STORE_INDEX)) names.push(STORE_INDEX);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(names, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('IDB setDocument failed'));
      tx.objectStore(STORE_HEADS).put({
        documentId: doc.documentId,
        fingerprint: doc.fingerprint,
        meta: doc.meta,
        unitCount: units.length,
        chunkCount,
        savedAt: doc.savedAt,
      } as StoredHead);
      const chunkStore = tx.objectStore(STORE_CHUNKS);
      for (let c = 0; c < chunkCount; c++) {
        const slice = units.slice(
          c * BODY_CHUNK_SIZE,
          (c + 1) * BODY_CHUNK_SIZE
        );
        chunkStore.put({
          documentId: doc.documentId,
          chunk: c,
          units: slice,
        } as StoredChunk);
      }
      if (db.objectStoreNames.contains(STORE_INDEX) && doc.indice) {
        tx.objectStore(STORE_INDEX).put({
          documentId: doc.documentId,
          indice: doc.indice,
        } as StoredIndexRow);
      }
    });
  }

  async deleteDocument(documentId: string): Promise<void> {
    const db = await this.openDb();
    const names = [STORE_DOCS];
    if (db.objectStoreNames.contains(STORE_HEADS)) names.push(STORE_HEADS);
    if (db.objectStoreNames.contains(STORE_CHUNKS)) names.push(STORE_CHUNKS);
    if (db.objectStoreNames.contains(STORE_INDEX)) names.push(STORE_INDEX);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(names, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('IDB delete failed'));
      tx.objectStore(STORE_DOCS).delete(documentId);
      if (db.objectStoreNames.contains(STORE_HEADS)) {
        tx.objectStore(STORE_HEADS).delete(documentId);
      }
      if (db.objectStoreNames.contains(STORE_INDEX)) {
        tx.objectStore(STORE_INDEX).delete(documentId);
      }
      if (db.objectStoreNames.contains(STORE_CHUNKS)) {
        const store = tx.objectStore(STORE_CHUNKS);
        const range = IDBKeyRange.bound(
          [documentId, 0],
          [documentId, Number.MAX_SAFE_INTEGER]
        );
        store.delete(range);
      }
    });
  }

  async clear(): Promise<void> {
    const db = await this.openDb();
    const names = [STORE_META, STORE_DOCS];
    if (db.objectStoreNames.contains(STORE_HEADS)) names.push(STORE_HEADS);
    if (db.objectStoreNames.contains(STORE_CHUNKS)) names.push(STORE_CHUNKS);
    if (db.objectStoreNames.contains(STORE_INDEX)) names.push(STORE_INDEX);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(names, 'readwrite');
      for (const n of names) tx.objectStore(n).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('IDB clear failed'));
    });
  }

  private async getLegacyDocument(
    documentId: string
  ): Promise<StoredDocument | null> {
    try {
      const value = await this.withStore<StoredDocument | undefined>(
        STORE_DOCS,
        'readonly',
        (store) => store.get(documentId)
      );
      return value ?? null;
    } catch {
      return null;
    }
  }

  private async readAllChunks(
    documentId: string,
    chunkCount: number
  ): Promise<StoredDocument['documento']> {
    const db = await this.openDb();
    const rows = await new Promise<StoredChunk[]>((resolve, reject) => {
      const tx = db.transaction(STORE_CHUNKS, 'readonly');
      const store = tx.objectStore(STORE_CHUNKS);
      const range = IDBKeyRange.bound([documentId, 0], [documentId, chunkCount]);
      const req = store.getAll(range);
      req.onsuccess = () => resolve((req.result as StoredChunk[]) || []);
      req.onerror = () => reject(req.error);
    });
    rows.sort((a, b) => a.chunk - b.chunk);
    const out: StoredDocument['documento'] = [];
    for (const row of rows) {
      for (const u of row.units || []) out.push(u);
    }
    return out;
  }
}
