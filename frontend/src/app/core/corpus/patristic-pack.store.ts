/**
 * Durable home for the patristic pack: OPFS when the WebView has it,
 * IndexedDB otherwise. Both stay on the device. Nothing is fetched.
 */

import { normalizeRel, type PatristicPackStore } from './patristic-pack.logic';

interface DirHandle {
  getDirectoryHandle(
    name: string,
    opts: { create: boolean },
  ): Promise<DirHandle>;
  getFileHandle(
    name: string,
    opts: { create: boolean },
  ): Promise<{
    getFile: () => Promise<{ size: number; arrayBuffer: () => Promise<ArrayBuffer> }>;
    createWritable: () => Promise<{
      write: (data: Uint8Array) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
  removeEntry(name: string, opts?: { recursive?: boolean }): Promise<void>;
  entries: () => AsyncIterable<[string, { kind: string }]>;
}

class OpfsPackStore implements PatristicPackStore {
  constructor(private readonly root: DirHandle) {}

  private async fileHandle(relPath: string, create: boolean) {
    const rel = normalizeRel(relPath);
    if (!rel || rel.includes('..')) return null;
    const parts = rel.split('/');
    const name = parts.pop();
    if (!name) return null;
    let dir = this.root;
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part, { create });
    }
    try {
      return await dir.getFileHandle(name, { create });
    } catch {
      return null;
    }
  }

  async read(relPath: string): Promise<Uint8Array | null> {
    const handle = await this.fileHandle(relPath, false);
    if (!handle) return null;
    const file = await handle.getFile();
    return new Uint8Array(await file.arrayBuffer());
  }

  async size(relPath: string): Promise<number | null> {
    const handle = await this.fileHandle(relPath, false);
    if (!handle) return null;
    const file = await handle.getFile();
    return file.size;
  }

  async write(relPath: string, bytes: Uint8Array): Promise<void> {
    const handle = await this.fileHandle(relPath, true);
    if (!handle) throw new Error(`No se pudo guardar ${relPath}`);
    const writable = await handle.createWritable();
    await writable.write(bytes);
    await writable.close();
  }

  async removeAll(): Promise<void> {
    const names: string[] = [];
    for await (const [name] of this.root.entries()) names.push(name);
    for (const name of names) {
      await this.root.removeEntry(name, { recursive: true });
    }
  }
}

const DB_NAME = 'dv-patristica-v1';
const STORE = 'files';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

class IdbPackStore implements PatristicPackStore {
  constructor(private readonly db: IDBDatabase) {}

  private request<T>(
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE, mode);
      const req = run(tx.objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async read(relPath: string): Promise<Uint8Array | null> {
    const hit = await this.request<ArrayBuffer | Uint8Array | undefined>(
      'readonly',
      (store) => store.get(normalizeRel(relPath)),
    );
    if (!hit) return null;
    return hit instanceof Uint8Array ? hit : new Uint8Array(hit);
  }

  async size(relPath: string): Promise<number | null> {
    const hit = await this.read(relPath);
    return hit ? hit.byteLength : null;
  }

  async write(relPath: string, bytes: Uint8Array): Promise<void> {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    await this.request('readwrite', (store) =>
      store.put(copy, normalizeRel(relPath)),
    );
  }

  async removeAll(): Promise<void> {
    await this.request('readwrite', (store) => store.clear());
  }
}

export async function openPatristicPackStore(): Promise<PatristicPackStore> {
  const nav = globalThis.navigator as unknown as {
    storage?: { getDirectory?: () => Promise<DirHandle> };
  };
  if (nav?.storage?.getDirectory) {
    try {
      const root = await nav.storage.getDirectory();
      const dir = await root.getDirectoryHandle('dv-patristica', {
        create: true,
      });
      return new OpfsPackStore(dir);
    } catch {
      /* IndexedDB below */
    }
  }
  if (typeof indexedDB !== 'undefined') {
    try {
      return new IdbPackStore(await openDb());
    } catch {
      /* thrown below */
    }
  }
  throw new Error('Este aparato no puede guardar el paquete');
}
