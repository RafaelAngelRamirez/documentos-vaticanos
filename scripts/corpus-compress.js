#!/usr/bin/env node
/**
 * Pre-package corpus compression (ship hygiene).
 *
 * Read-safe payload reductions for the offline pack that enters ng build /
 * Capacitor / Electron / dist/web:
 *   - compact JSON re-serialize
 *   - drop load-stamped `index_array` (CorpusLoadEngine.stampIndexArray)
 *   - omit empty `referencias: []` (loader treats missing as empty)
 *   - omit ship-only `meta.json` (catalog is manifest.json; UI never fetches meta)
 *
 * Does NOT reindex units, rename document ids, or change consecutivo /
 * contenido / non-empty referencias. Packs with more than SHIP_BODY_CHUNK_SIZE
 * units replace content.json with chunks.json + c/N.json so the reader can
 * JSON.parse a window instead of the whole book.
 * Does NOT delete sibling packs under papacy/ santoral/ context/ search/
 * (except --drop-unused-sidecars, which removes every patristic-verse-hits.json).
 *
 * Optional ship-size flags default OFF (web dist can keep AI locales):
 *   --drop-unused-sidecars  delete every patristic-verse-hits.json under root
 *   --drop-ai               drop manifest entries with translationProvenance==="ai"
 *                           and their documents/<id>/ dirs (official + unset stay)
 *
 * Usage:
 *   node scripts/corpus-compress.js --root <corpusDir> [--dry-run] [--keep-meta]
 *       [--drop-ai] [--drop-unused-sidecars]
 *
 * Pure helpers are exported for tests (require without side effects when not main).
 */

'use strict';

const fs = require('fs');
const path = require('path');

/** @param {unknown} unit */
function isArticleLike(unit) {
  return (
    unit != null &&
    typeof unit === 'object' &&
    !Array.isArray(unit) &&
    Object.prototype.hasOwnProperty.call(unit, 'contenido')
  );
}

/**
 * Pure unit transform: drop load-stamped index_array and empty referencias.
 * Preserves key order of remaining fields; does not mutate input.
 * @param {Record<string, unknown>} unit
 * @returns {Record<string, unknown>}
 */
function compressUnit(unit) {
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const key of Object.keys(unit)) {
    if (key === 'index_array') {
      continue;
    }
    const value = unit[key];
    if (key === 'referencias' && Array.isArray(value) && value.length === 0) {
      continue;
    }
    out[key] = value;
  }
  return out;
}

/**
 * Pure JSON value transform for a corpus file basename.
 * content.json arrays of units get field hygiene; other JSON is left structurally
 * intact (still re-serialized compact by the walker).
 * @param {unknown} data
 * @param {string} [fileName]
 * @returns {unknown}
 */
function compressJsonValue(data, fileName) {
  const base = fileName ? path.basename(fileName) : '';
  const treatAsContent =
    base === 'content.json' ||
    (Array.isArray(data) && data.length > 0 && isArticleLike(data[0]));

  if (treatAsContent && Array.isArray(data)) {
    return data.map((item) =>
      isArticleLike(item)
        ? compressUnit(/** @type {Record<string, unknown>} */ (item))
        : item,
    );
  }
  return data;
}

/**
 * Compact JSON bytes (UTF-8). Default JSON.stringify is already space-free.
 * @param {unknown} data
 * @returns {Buffer}
 */
function serializeCompact(data) {
  return Buffer.from(JSON.stringify(data), 'utf8');
}

/**
 * Transform one JSON file's bytes → smaller/equal compact bytes.
 * @param {Buffer|string} input
 * @param {string} [fileName]
 * @returns {{ output: Buffer, parsed: unknown }}
 */
function compressJsonBuffer(input, fileName) {
  const text = Buffer.isBuffer(input) ? input.toString('utf8') : String(input);
  const parsed = JSON.parse(text);
  const transformed = compressJsonValue(parsed, fileName);
  return { output: serializeCompact(transformed), parsed: transformed };
}

/**
 * Semantic snapshot used for parity checks (reading-critical fields).
 * @param {unknown} data content.json array or other
 * @returns {{ unitCount: number, units: Array<{consecutivo: unknown, contenido: unknown, referencias: unknown, biblia: unknown}> }}
 */
function readingSnapshot(data) {
  if (!Array.isArray(data)) {
    return { unitCount: 0, units: [] };
  }
  return {
    unitCount: data.length,
    units: data.map((u) => {
      if (!u || typeof u !== 'object') {
        return {
          consecutivo: null,
          contenido: null,
          referencias: undefined,
          biblia: undefined,
        };
      }
      const o = /** @type {Record<string, unknown>} */ (u);
      const refs = o.referencias;
      return {
        consecutivo: o.consecutivo,
        contenido: o.contenido,
        // missing empty refs ≡ [] for the reader
        referencias: Array.isArray(refs) ? refs : refs === undefined ? [] : refs,
        biblia: o.biblia,
      };
    }),
  };
}

const UNUSED_SIDECAR_NAME = 'patristic-verse-hits.json';

/** Keep in sync with frontend/.../corpus-load.logic.ts SHIP_BODY_CHUNK_SIZE. */
const SHIP_BODY_CHUNK_SIZE = 500;

/**
 * Strict AI provenance. Missing / official / other strings stay.
 * @param {unknown} doc
 * @returns {boolean}
 */
function isAiProvenance(doc) {
  if (doc == null || typeof doc !== 'object' || Array.isArray(doc)) {
    return false;
  }
  return (
    /** @type {{ translationProvenance?: unknown }} */ (doc)
      .translationProvenance === 'ai'
  );
}

/**
 * Resolve documents/<id> under root. Rejects path traversal.
 * @param {string} rootDir
 * @param {unknown} id
 * @returns {string|null}
 */
function safeDocumentDir(rootDir, id) {
  if (typeof id !== 'string' || !id.trim()) return null;
  if (id !== path.basename(id)) return null;
  const documentsRoot = path.resolve(rootDir, 'documents');
  const dir = path.resolve(documentsRoot, id);
  if (dir === documentsRoot) return null;
  const prefix = documentsRoot.endsWith(path.sep)
    ? documentsRoot
    : documentsRoot + path.sep;
  if (!dir.startsWith(prefix)) return null;
  return dir;
}

/**
 * Drop manifest documents with translationProvenance === 'ai' and their dirs.
 * Does not touch papacy/, santoral/, context/, search/.
 * @param {string} rootDir
 * @param {{ dryRun?: boolean }} [opts]
 * @returns {{ droppedIds: string[], keptCount: number, bytesFreed: number }}
 */
function dropAiDocuments(rootDir, opts = {}) {
  const dryRun = Boolean(opts.dryRun);
  const manPath = path.join(rootDir, 'manifest.json');
  if (!fs.existsSync(manPath)) {
    throw new Error(`drop-ai: missing manifest.json under ${rootDir}`);
  }
  const raw = fs.readFileSync(manPath, 'utf8');
  const man = JSON.parse(raw);
  const docs = Array.isArray(man.documents) ? man.documents : [];
  /** @type {string[]} */
  const droppedIds = [];
  /** @type {unknown[]} */
  const kept = [];
  for (const doc of docs) {
    if (isAiProvenance(doc)) {
      const id =
        doc && typeof doc === 'object' && typeof doc.id === 'string'
          ? doc.id
          : '';
      droppedIds.push(id);
    } else {
      kept.push(doc);
    }
  }

  let bytesFreed = 0;
  for (const id of droppedIds) {
    const dir = safeDocumentDir(rootDir, id);
    if (!dir || !fs.existsSync(dir)) continue;
    bytesFreed += treeBytes(dir);
    if (!dryRun) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  if (!dryRun && droppedIds.length > 0) {
    const next = { ...man, documents: kept };
    const tmp = manPath + '.tmp-drop-ai';
    try {
      fs.writeFileSync(tmp, serializeCompact(next));
      fs.renameSync(tmp, manPath);
    } catch (err) {
      try {
        if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
      } catch {
        /* ignore */
      }
      throw err;
    }
  }

  return { droppedIds, keptCount: kept.length, bytesFreed };
}

/**
 * Split a content.json unit array into chunks.json + c/N.json and drop the
 * original body file. Caller has already compacted the units.
 * @param {string} docDir documents/<id>
 * @param {unknown[]} units
 * @param {{ dryRun?: boolean, chunkSize?: number }} [opts]
 * @returns {{ files: number, bytes: number, chunks: number }}
 */
function writeShipChunks(docDir, units, opts = {}) {
  const dryRun = Boolean(opts.dryRun);
  const chunkSize =
    opts.chunkSize > 0 ? opts.chunkSize : SHIP_BODY_CHUNK_SIZE;
  const unitCount = units.length;
  const chunkCount = Math.ceil(unitCount / chunkSize) || 0;
  const spec = { v: 1, chunkSize, unitCount };
  let bytes = 0;
  let files = 0;

  function writeFile(full, data) {
    const buf = serializeCompact(data);
    bytes += buf.length;
    files += 1;
    if (!dryRun) {
      fs.mkdirSync(path.dirname(full), { recursive: true });
      const tmp = full + '.tmp-chunk';
      fs.writeFileSync(tmp, buf);
      fs.renameSync(tmp, full);
    }
  }

  writeFile(path.join(docDir, 'chunks.json'), spec);
  for (let c = 0; c < chunkCount; c++) {
    writeFile(
      path.join(docDir, 'c', `${c}.json`),
      units.slice(c * chunkSize, (c + 1) * chunkSize),
    );
  }
  return { files, bytes, chunks: chunkCount };
}

function dropUnusedSidecars(rootDir, opts = {}) {
  const dryRun = Boolean(opts.dryRun);
  /** @type {string[]} */
  const paths = [];

  /**
   * @param {string} dir
   */
  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(full);
        continue;
      }
      if (ent.isFile() && ent.name === UNUSED_SIDECAR_NAME) {
        paths.push(full);
        if (!dryRun) {
          try {
            fs.unlinkSync(full);
          } catch {
            /* keep going */
          }
        }
      }
    }
  }

  walk(rootDir);
  return { removed: paths.length, paths };
}

/**
 * @param {string} dir
 * @returns {number}
 */
function treeBytes(dir) {
  let total = 0;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      total += treeBytes(full);
    } else if (ent.isFile()) {
      try {
        total += fs.statSync(full).size;
      } catch {
        /* skip */
      }
    }
  }
  return total;
}

/**
 * Walk a corpus root and apply compression in place.
 * @param {string} rootDir
 * @param {{
 *   dryRun?: boolean,
 *   keepMeta?: boolean,
 *   dropAi?: boolean,
 *   dropUnusedSidecars?: boolean,
 * }} [opts]
 * @returns {{
 *   filesSeen: number,
 *   filesWritten: number,
 *   metaRemoved: number,
 *   aiDropped: number,
 *   sidecarsRemoved: number,
 *   bytesBefore: number,
 *   bytesAfter: number,
 *   skipped: number,
 *   errors: string[],
 * }}
 */
function compressCorpusTree(rootDir, opts = {}) {
  const dryRun = Boolean(opts.dryRun);
  const keepMeta = Boolean(opts.keepMeta);
  const dropAi = Boolean(opts.dropAi);
  const dropSidecars = Boolean(opts.dropUnusedSidecars);

  if (!fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) {
    throw new Error(`corpus root not found or not a directory: ${rootDir}`);
  }

  const stats = {
    filesSeen: 0,
    filesWritten: 0,
    metaRemoved: 0,
    aiDropped: 0,
    sidecarsRemoved: 0,
    chunkFiles: 0,
    bytesBefore: 0,
    bytesAfter: 0,
    skipped: 0,
    /** @type {string[]} */
    errors: [],
  };

  if (dropAi) {
    try {
      const ai = dropAiDocuments(rootDir, { dryRun });
      stats.aiDropped = ai.droppedIds.length;
    } catch (err) {
      stats.errors.push(`drop-ai: ${/** @type {Error} */ (err).message}`);
    }
  }

  if (dropSidecars) {
    try {
      const sc = dropUnusedSidecars(rootDir, { dryRun });
      stats.sidecarsRemoved = sc.removed;
    } catch (err) {
      stats.errors.push(
        `drop-unused-sidecars: ${/** @type {Error} */ (err).message}`,
      );
    }
  }

  /**
   * @param {string} dir
   */
  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (err) {
      stats.errors.push(`${dir}: ${/** @type {Error} */ (err).message}`);
      return;
    }

    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(full);
        continue;
      }
      if (!ent.isFile() || !ent.name.endsWith('.json')) {
        continue;
      }

      stats.filesSeen += 1;
      let st;
      try {
        st = fs.statSync(full);
      } catch (err) {
        stats.errors.push(`${full}: ${/** @type {Error} */ (err).message}`);
        continue;
      }
      const before = st.size;
      stats.bytesBefore += before;

      // Never strip sibling offline packs (topic-search, historical context).
      // meta.json only exists under documents/<id>/ for reading packs.
      const relFromRoot = path.relative(rootDir, full).split(path.sep).join('/');
      const underSiblingPack =
        relFromRoot.startsWith('search/') ||
        relFromRoot.startsWith('context/');

      if (ent.name === 'meta.json' && !keepMeta && !underSiblingPack) {
        stats.metaRemoved += 1;
        // omitted from ship: 0 after bytes
        if (!dryRun) {
          try {
            fs.unlinkSync(full);
          } catch (err) {
            stats.errors.push(`${full}: ${/** @type {Error} */ (err).message}`);
            stats.bytesAfter += before;
            continue;
          }
        }
        stats.filesWritten += 1;
        continue;
      }

      let raw;
      try {
        raw = fs.readFileSync(full);
      } catch (err) {
        stats.errors.push(`${full}: ${/** @type {Error} */ (err).message}`);
        stats.bytesAfter += before;
        continue;
      }

      let packed;
      try {
        packed = compressJsonBuffer(raw, ent.name);
      } catch (err) {
        stats.errors.push(`${full}: parse/transform ${/** @type {Error} */ (err).message}`);
        stats.bytesAfter += before;
        stats.skipped += 1;
        continue;
      }
      const output = packed.output;
      const parsed = packed.parsed;

      stats.bytesAfter += output.length;

      // Write when smaller, or when representation changed (idempotent compact).
      if (output.length !== before || !raw.equals(output)) {
        if (!dryRun) {
          const tmp = full + '.tmp-compress';
          try {
            fs.writeFileSync(tmp, output);
            fs.renameSync(tmp, full);
          } catch (err) {
            try {
              if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
            } catch {
              /* ignore */
            }
            stats.errors.push(`${full}: write ${/** @type {Error} */ (err).message}`);
            continue;
          }
        }
        stats.filesWritten += 1;
      } else {
        stats.skipped += 1;
      }

      const splitBody =
        ent.name === 'content.json' &&
        !underSiblingPack &&
        Array.isArray(parsed) &&
        parsed.length > SHIP_BODY_CHUNK_SIZE;
      if (splitBody) {
        try {
          const chunked = writeShipChunks(path.dirname(full), parsed, {
            dryRun,
            chunkSize: SHIP_BODY_CHUNK_SIZE,
          });
          stats.chunkFiles += chunked.files;
          stats.filesWritten += chunked.files;
          if (!dryRun) {
            try {
              fs.unlinkSync(full);
            } catch (err) {
              stats.errors.push(
                `${full}: unlink after chunk ${/** @type {Error} */ (err).message}`,
              );
            }
            stats.bytesAfter -= output.length;
            stats.bytesAfter += chunked.bytes;
          }
        } catch (err) {
          stats.errors.push(
            `${full}: chunk ${/** @type {Error} */ (err).message}`,
          );
        }
      }
    }
  }

  walk(rootDir);
  return stats;
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MiB`;
}

function parseArgs(argv) {
  /** @type {{
   *   root: string|null,
   *   dryRun: boolean,
   *   keepMeta: boolean,
   *   dropAi: boolean,
   *   dropUnusedSidecars: boolean,
   *   help: boolean,
   * }} */
  const out = {
    root: null,
    dryRun: false,
    keepMeta: false,
    dropAi: false,
    dropUnusedSidecars: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--root' || a === '-r') {
      out.root = argv[++i] || null;
    } else if (a === '--dry-run') {
      out.dryRun = true;
    } else if (a === '--keep-meta') {
      out.keepMeta = true;
    } else if (a === '--drop-ai') {
      out.dropAi = true;
    } else if (a === '--drop-unused-sidecars') {
      out.dropUnusedSidecars = true;
    } else if (a === '--help' || a === '-h') {
      out.help = true;
    }
  }
  return out;
}

function printHelp() {
  console.log(`Usage: node scripts/corpus-compress.js --root <corpusDir> [options]

Options:
  --root, -r                 Path to ship corpus root (must contain manifest.json)
  --dry-run                  Report savings without writing
  --keep-meta                Do not delete meta.json files
  --drop-ai                  Remove translationProvenance=ai docs from ship tree
  --drop-unused-sidecars     Delete every patristic-verse-hits.json under root
  --help                     Show this help

Flags default off. Compact JSON / empty refs / drop meta.json always run.
Safe transforms only (reading contract preserved).`);
}

function main(argv) {
  const args = parseArgs(argv);
  if (args.help || !args.root) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  const root = path.resolve(args.root);
  const manifest = path.join(root, 'manifest.json');
  if (!fs.existsSync(manifest)) {
    console.error(`ERROR: missing manifest.json under ${root}`);
    process.exit(1);
  }

  console.log(
    `==> corpus-compress ${args.dryRun ? '(dry-run) ' : ''}root=${root}`,
  );
  const stats = compressCorpusTree(root, {
    dryRun: args.dryRun,
    keepMeta: args.keepMeta,
    dropAi: args.dropAi,
    dropUnusedSidecars: args.dropUnusedSidecars,
  });

  const saved = stats.bytesBefore - stats.bytesAfter;
  console.log(
    JSON.stringify(
      {
        filesSeen: stats.filesSeen,
        filesWritten: stats.filesWritten,
        metaRemoved: stats.metaRemoved,
        aiDropped: stats.aiDropped,
        sidecarsRemoved: stats.sidecarsRemoved,
        chunkFiles: stats.chunkFiles,
        skipped: stats.skipped,
        bytesBefore: stats.bytesBefore,
        bytesAfter: stats.bytesAfter,
        bytesSaved: saved,
        bytesBeforeHuman: formatBytes(stats.bytesBefore),
        bytesAfterHuman: formatBytes(stats.bytesAfter),
        bytesSavedHuman: formatBytes(saved),
        errors: stats.errors.length,
      },
      null,
      2,
    ),
  );

  if (stats.errors.length) {
    console.error('errors:');
    for (const e of stats.errors.slice(0, 20)) {
      console.error('  ', e);
    }
    if (stats.errors.length > 20) {
      console.error(`  ... +${stats.errors.length - 20} more`);
    }
    process.exit(1);
  }

  if (saved < 0 && !stats.chunkFiles) {
    console.error('ERROR: compression grew the tree');
    process.exit(1);
  }
}

module.exports = {
  compressUnit,
  compressJsonValue,
  compressJsonBuffer,
  compressCorpusTree,
  writeShipChunks,
  SHIP_BODY_CHUNK_SIZE,
  readingSnapshot,
  serializeCompact,
  isArticleLike,
  isAiProvenance,
  dropAiDocuments,
  dropUnusedSidecars,
  parseArgs,
};

if (require.main === module) {
  main(process.argv.slice(2));
}
