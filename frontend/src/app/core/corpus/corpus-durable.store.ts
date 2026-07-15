/**
 * Re-exports durable store types + MemoryCorpusStore from the pure load module.
 * IndexedDB implementation lives in corpus-durable-idb.store.ts.
 */

export {
  CorpusDurableStore,
  MemoryCorpusStore,
  StoredDocument,
  StoredManifest,
  documentFingerprint,
  isStoredDocumentValid,
  toStoredManifest,
} from './corpus-load.logic';
