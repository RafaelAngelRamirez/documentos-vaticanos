/**
 * IndexedDB-backed CorpusDurableStore for the web app.
 * Angular injectable; not imported by node strip-types tests.
 */

import { Injectable } from '@angular/core';
import {
  CorpusDurableStore,
  StoredDocument,
  StoredManifest,
} from './corpus-load.logic';

const IDB_NAME = 'dv-corpus-v1';
const IDB_VERSION = 1;
const STORE_META = 'meta';
const STORE_DOCS = 'documents';
const MANIFEST_KEY = 'manifest';

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

  async getDocument(documentId: string): Promise<StoredDocument | null> {
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

  async setDocument(doc: StoredDocument): Promise<void> {
    await this.withStore<void>(STORE_DOCS, 'readwrite', (store) => {
      store.put(doc);
    });
  }

  async deleteDocument(documentId: string): Promise<void> {
    await this.withStore<void>(STORE_DOCS, 'readwrite', (store) => {
      store.delete(documentId);
    });
  }

  async clear(): Promise<void> {
    const db = await this.openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_META, STORE_DOCS], 'readwrite');
      tx.objectStore(STORE_META).clear();
      tx.objectStore(STORE_DOCS).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('IDB clear failed'));
    });
  }
}
