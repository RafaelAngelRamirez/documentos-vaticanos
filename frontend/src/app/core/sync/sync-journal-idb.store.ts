/**
 * IndexedDB para el diario append-only (`dv-sync-v1`).
 * Aparte de `dv-corpus-v1`: borrar el caché del corpus no borra las notas.
 */

import { Injectable } from '@angular/core';
import {
  JournalMeta,
  Op,
  SYNC_IDB_NAME,
  createJournalMeta,
} from './sync-journal.logic';

const IDB_VERSION = 1;
const STORE_META = 'meta';
const STORE_OPS = 'ops';
const META_KEY = 'local';

@Injectable({ providedIn: 'root' })
export class SyncJournalIdbStore {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDb(): Promise<IDBDatabase> {
    if (typeof indexedDB === 'undefined') {
      return Promise.reject(new Error('indexedDB unavailable'));
    }
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        let req: IDBOpenDBRequest;
        try {
          req = indexedDB.open(SYNC_IDB_NAME, IDB_VERSION);
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
          if (!db.objectStoreNames.contains(STORE_OPS)) {
            db.createObjectStore(STORE_OPS, { keyPath: 'opId' });
          }
        };
      });
    }
    return this.dbPromise;
  }

  private async withStore<T>(
    storeName: string,
    mode: IDBTransactionMode,
    fn: (store: IDBObjectStore) => IDBRequest<T> | void,
  ): Promise<T> {
    const db = await this.openDb();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      let req: IDBRequest<T> | void;
      try {
        req = fn(store);
      } catch (err) {
        reject(err);
        return;
      }
      tx.oncomplete = () => {
        resolve(req ? (req.result as T) : (undefined as T));
      };
      tx.onerror = () => reject(tx.error || new Error('IDB tx failed'));
      tx.onabort = () => reject(tx.error || new Error('IDB tx aborted'));
    });
  }

  async readMeta(): Promise<JournalMeta | null> {
    try {
      const row = await this.withStore<JournalMeta | undefined>(
        STORE_META,
        'readonly',
        (store) => store.get(META_KEY),
      );
      return row || null;
    } catch {
      return null;
    }
  }

  async writeMeta(meta: JournalMeta): Promise<void> {
    await this.withStore(STORE_META, 'readwrite', (store) => {
      store.put(meta, META_KEY);
    });
  }

  async ensureMeta(): Promise<JournalMeta> {
    const existing = await this.readMeta();
    if (existing?.peerId && existing?.groupId) return existing;
    const meta = createJournalMeta();
    await this.writeMeta(meta);
    return meta;
  }

  async appendOps(ops: Op[]): Promise<void> {
    if (!ops.length) return;
    const db = await this.openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_OPS, 'readwrite');
      const store = tx.objectStore(STORE_OPS);
      for (const op of ops) store.put(op);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('IDB append failed'));
    });
  }

  async listOps(): Promise<Op[]> {
    try {
      const db = await this.openDb();
      return await new Promise<Op[]>((resolve, reject) => {
        const tx = db.transaction(STORE_OPS, 'readonly');
        const store = tx.objectStore(STORE_OPS);
        const req = store.getAll();
        req.onsuccess = () => {
          const ops = (req.result || []) as Op[];
          ops.sort((a, b) => {
            if (a.peerId === b.peerId) return a.seq - b.seq;
            return a.hlc.wall - b.hlc.wall || a.hlc.counter - b.hlc.counter;
          });
          resolve(ops);
        };
        req.onerror = () => reject(req.error || new Error('IDB list failed'));
      });
    } catch {
      return [];
    }
  }

  async clearAll(): Promise<void> {
    const db = await this.openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_META, STORE_OPS], 'readwrite');
      tx.objectStore(STORE_OPS).clear();
      tx.objectStore(STORE_META).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('IDB clear failed'));
    });
  }
}
