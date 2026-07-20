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
 * Does NOT reindex units, rename document ids, drop content.json / index.json,
 * or change consecutivo / contenido / non-empty referencias.
 *
 * Usage:
 *   node scripts/corpus-compress.js --root <corpusDir> [--dry-run] [--keep-meta]
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

/**
 * Walk a corpus root and apply compression in place.
 * @param {string} rootDir
 * @param {{ dryRun?: boolean, keepMeta?: boolean }} [opts]
 * @returns {{
 *   filesSeen: number,
 *   filesWritten: number,
 *   metaRemoved: number,
 *   bytesBefore: number,
 *   bytesAfter: number,
 *   skipped: number,
 *   errors: string[],
 * }}
 */
function compressCorpusTree(rootDir, opts = {}) {
  const dryRun = Boolean(opts.dryRun);
  const keepMeta = Boolean(opts.keepMeta);

  if (!fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) {
    throw new Error(`corpus root not found or not a directory: ${rootDir}`);
  }

  const stats = {
    filesSeen: 0,
    filesWritten: 0,
    metaRemoved: 0,
    bytesBefore: 0,
    bytesAfter: 0,
    skipped: 0,
    /** @type {string[]} */
    errors: [],
  };

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

      if (ent.name === 'meta.json' && !keepMeta) {
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

      let output;
      try {
        output = compressJsonBuffer(raw, ent.name).output;
      } catch (err) {
        stats.errors.push(`${full}: parse/transform ${/** @type {Error} */ (err).message}`);
        stats.bytesAfter += before;
        stats.skipped += 1;
        continue;
      }

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
  /** @type {{ root: string|null, dryRun: boolean, keepMeta: boolean, help: boolean }} */
  const out = { root: null, dryRun: false, keepMeta: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--root' || a === '-r') {
      out.root = argv[++i] || null;
    } else if (a === '--dry-run') {
      out.dryRun = true;
    } else if (a === '--keep-meta') {
      out.keepMeta = true;
    } else if (a === '--help' || a === '-h') {
      out.help = true;
    }
  }
  return out;
}

function printHelp() {
  console.log(`Usage: node scripts/corpus-compress.js --root <corpusDir> [options]

Options:
  --root, -r     Path to ship corpus root (must contain manifest.json)
  --dry-run      Report savings without writing
  --keep-meta    Do not delete meta.json files
  --help         Show this help

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
  });

  const saved = stats.bytesBefore - stats.bytesAfter;
  console.log(
    JSON.stringify(
      {
        filesSeen: stats.filesSeen,
        filesWritten: stats.filesWritten,
        metaRemoved: stats.metaRemoved,
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

  if (saved < 0) {
    console.error('ERROR: compression grew the tree');
    process.exit(1);
  }
}

module.exports = {
  compressUnit,
  compressJsonValue,
  compressJsonBuffer,
  compressCorpusTree,
  readingSnapshot,
  serializeCompact,
  isArticleLike,
};

if (require.main === module) {
  main(process.argv.slice(2));
}
