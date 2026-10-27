#!/usr/bin/env node
/**
 * Read-only codec probe for the offline ship pack.
 *
 * Measures deflate (zip method), brotli and zstd on the in-memory ship
 * representation of text and inverted indexes. Does not write under the
 * corpus root and does not change contenido.
 *
 * Ship representation matches scripts/corpus-compress.js: compact JSON,
 * empty referencias omitted, bodies over SHIP_BODY_CHUNK_SIZE split into
 * chunks.json + c/N.json. The canonical files stay untouched.
 *
 * Usage:
 *   node scripts/corpus-codec-probe.js [--root documentos/corpus] [--json out.json] [--ceiling 8]
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const {
  compressJsonBuffer,
  serializeCompact,
  SHIP_BODY_CHUNK_SIZE,
  isAiProvenance,
} = require('./corpus-compress.js');

const C = zlib.constants;

const CODECS = [
  {
    name: 'deflate-6',
    compress: (buf) => zlib.deflateRawSync(buf, { level: 6 }),
    decompress: (buf) => zlib.inflateRawSync(buf),
  },
  {
    name: 'brotli-5',
    compress: (buf) =>
      zlib.brotliCompressSync(buf, {
        params: { [C.BROTLI_PARAM_QUALITY]: 5 },
      }),
    decompress: (buf) => zlib.brotliDecompressSync(buf),
  },
  {
    name: 'zstd-3',
    compress: (buf) =>
      zlib.zstdCompressSync(buf, {
        params: { [C.ZSTD_c_compressionLevel]: 3 },
      }),
    decompress: (buf) => zlib.zstdDecompressSync(buf),
  },
];

const CEILING_CODECS = [
  {
    name: 'brotli-11',
    compress: (buf) =>
      zlib.brotliCompressSync(buf, {
        params: { [C.BROTLI_PARAM_QUALITY]: 11 },
      }),
    decompress: (buf) => zlib.brotliDecompressSync(buf),
  },
  {
    name: 'zstd-19',
    compress: (buf) =>
      zlib.zstdCompressSync(buf, {
        params: { [C.ZSTD_c_compressionLevel]: 19 },
      }),
    decompress: (buf) => zlib.zstdDecompressSync(buf),
  },
];

/**
 * NFC contenido, CRLF/CR → LF, SHA-256 of the strings joined by U+001E.
 * Same definition as the ship text-parity check. Index bytes are not included.
 * @param {unknown[]} units
 * @returns {string}
 */
function textFingerprint(units) {
  const hash = crypto.createHash('sha256');
  const list = Array.isArray(units) ? units : [];
  for (let i = 0; i < list.length; i += 1) {
    const unit = list[i];
    let text = '';
    if (unit && typeof unit === 'object' && !Array.isArray(unit)) {
      const raw = /** @type {{ contenido?: unknown }} */ (unit).contenido;
      if (typeof raw === 'string') text = raw;
      else if (raw != null) text = String(raw);
    }
    text = text.normalize('NFC').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    if (i > 0) hash.update('\u001e');
    hash.update(text, 'utf8');
  }
  return hash.digest('hex');
}

/**
 * @param {unknown[]} units
 * @param {number} [chunkSize]
 * @returns {{ name: string, buf: Buffer, opens: boolean }[]}
 */
function shipBodyPieces(units, chunkSize = SHIP_BODY_CHUNK_SIZE) {
  const size = chunkSize > 0 ? chunkSize : SHIP_BODY_CHUNK_SIZE;
  if (!Array.isArray(units) || units.length <= size) {
    return [{ name: 'content.json', buf: serializeCompact(units), opens: true }];
  }
  const spec = { v: 1, chunkSize: size, unitCount: units.length };
  /** @type {{ name: string, buf: Buffer, opens: boolean }[]} */
  const pieces = [
    { name: 'chunks.json', buf: serializeCompact(spec), opens: false },
  ];
  const count = Math.ceil(units.length / size);
  for (let c = 0; c < count; c += 1) {
    pieces.push({
      name: `c/${c}.json`,
      buf: serializeCompact(units.slice(c * size, (c + 1) * size)),
      opens: c === 0,
    });
  }
  return pieces;
}

/**
 * @param {Buffer} buf
 * @param {{ name: string, compress: (b: Buffer) => Buffer, decompress: (b: Buffer) => Buffer }} codec
 * @param {(parsed: unknown) => void} [touch]
 */
function measureCodec(buf, codec, touch) {
  const c0 = process.hrtime.bigint();
  const packed = codec.compress(buf);
  const c1 = process.hrtime.bigint();
  const d0 = process.hrtime.bigint();
  const back = codec.decompress(packed);
  const parsed = JSON.parse(back.toString('utf8'));
  if (touch) touch(parsed);
  const d1 = process.hrtime.bigint();
  return {
    bytes: packed.length,
    compressMs: Number(c1 - c0) / 1e6,
    decodeMs: Number(d1 - d0) / 1e6,
    equal: back.equals(buf),
    parsed,
  };
}

/**
 * JSON.parse + touch, without a codec. This is the JS cost after the
 * platform has already inflated a zip entry.
 * @param {Buffer} buf
 * @param {(parsed: unknown) => void} [touch]
 */
function measureParse(buf, touch) {
  const t0 = process.hrtime.bigint();
  const parsed = JSON.parse(buf.toString('utf8'));
  if (touch) touch(parsed);
  const t1 = process.hrtime.bigint();
  return { ms: Number(t1 - t0) / 1e6, parsed };
}

/**
 * @param {unknown} parsed
 * @returns {number}
 */
function touchBody(parsed) {
  if (!Array.isArray(parsed) || parsed.length === 0) return 0;
  const first = parsed[0];
  if (!first || typeof first !== 'object') return 0;
  const text = /** @type {{ contenido?: unknown }} */ (first).contenido;
  return typeof text === 'string' ? text.length : 0;
}

/**
 * @param {unknown} parsed
 * @returns {{ term: string|null, hits: number }}
 */
function touchIndex(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { term: null, hits: 0 };
  }
  const indice = /** @type {{ indice?: unknown }} */ (parsed).indice;
  if (!indice || typeof indice !== 'object' || Array.isArray(indice)) {
    return { term: null, hits: 0 };
  }
  const map = /** @type {Record<string, unknown>} */ (indice);
  const term = Object.prototype.hasOwnProperty.call(map, 'dios')
    ? 'dios'
    : Object.keys(map)[0] || null;
  if (term == null) return { term: null, hits: 0 };
  const postings = map[term];
  return { term, hits: Array.isArray(postings) ? postings.length : 0 };
}

/**
 * @param {number[]} values
 * @param {number} p 0..1
 * @returns {number|null}
 */
function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(p * sorted.length) - 1),
  );
  return sorted[idx];
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function emptyGroup() {
  return {
    docs: 0,
    contentRaw: 0,
    indexRaw: 0,
    contentShip: 0,
    indexShip: 0,
    contentCodec: {},
    indexCodec: {},
  };
}

/**
 * @param {ReturnType<typeof emptyGroup>} group
 * @param {'contentCodec'|'indexCodec'} side
 * @param {string} codec
 * @param {number} bytes
 */
function addCodecBytes(group, side, codec, bytes) {
  group[side][codec] = (group[side][codec] || 0) + bytes;
}

/**
 * @param {string} dir
 * @returns {number}
 */
function treeBytes(dir) {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) total += treeBytes(full);
    else if (ent.isFile()) total += fs.statSync(full).size;
  }
  return total;
}

function blankCodecAgg() {
  return { bytes: 0, compressMs: 0, decodeMs: 0, samples: /** @type {number[]} */ ([]) };
}

function blankClass() {
  return {
    files: 0,
    raw: 0,
    ship: 0,
    parseMs: 0,
    parseSamples: /** @type {number[]} */ ([]),
    codecs: {
      'deflate-6': blankCodecAgg(),
      'brotli-5': blankCodecAgg(),
      'zstd-3': blankCodecAgg(),
    },
  };
}

/**
 * @param {ReturnType<typeof blankClass>} klass
 * @param {Buffer} buf
 * @param {(parsed: unknown) => void} touch
 * @param {boolean} timeThis
 */
function accumulatePiece(klass, buf, touch, timeThis) {
  klass.files += 1;
  klass.ship += buf.length;
  let parsedForHash = null;
  if (timeThis) {
    const parsed = measureParse(buf, touch);
    klass.parseMs += parsed.ms;
    klass.parseSamples.push(parsed.ms);
    parsedForHash = parsed.parsed;
  }
  /** @type {Record<string, { bytes: number, decodeMs: number, equal: boolean }>} */
  const codecOut = {};
  for (const codec of CODECS) {
    const measured = measureCodec(buf, codec, timeThis ? touch : undefined);
    const agg = klass.codecs[codec.name];
    agg.bytes += measured.bytes;
    agg.compressMs += measured.compressMs;
    if (timeThis) {
      agg.decodeMs += measured.decodeMs;
      agg.decodeSamples = agg.decodeSamples || [];
      agg.samples.push(measured.decodeMs);
    }
    codecOut[codec.name] = {
      bytes: measured.bytes,
      decodeMs: timeThis ? measured.decodeMs : 0,
      equal: measured.equal,
    };
    if (!measured.equal) {
      /* caller counts */
    }
  }
  return { parsedForHash, codecOut };
}

/**
 * @param {{ id: string, kind?: string, locale?: string }} doc
 * @param {string} documentsDir
 * @param {{
 *   text: ReturnType<typeof blankClass>,
 *   index: ReturnType<typeof blankClass>,
 *   groups: Record<string, Record<string, ReturnType<typeof emptyGroup>>>,
 *   ceiling: { text: any[], index: any[] },
 *   ceilingLimit: number,
 *   fingerprint: import('crypto').Hash,
 * }} ctx
 */
function probeDocument(doc, documentsDir, ctx) {
  const id = doc.id;
  const dir = path.join(documentsDir, id);
  const contentPath = path.join(dir, 'content.json');
  const indexPath = path.join(dir, 'index.json');
  const contentRaw = fs.readFileSync(contentPath);
  const indexRaw = fs.readFileSync(indexPath);
  const contentSha = sha256(contentRaw);
  const indexSha = sha256(indexRaw);

  const contentPacked = compressJsonBuffer(contentRaw, 'content.json');
  const indexPacked = compressJsonBuffer(indexRaw, 'index.json');
  const units = /** @type {unknown[]} */ (contentPacked.parsed);
  const canonicalUnits = JSON.parse(contentRaw.toString('utf8'));
  const fingerBefore = textFingerprint(canonicalUnits);
  const fingerShip = textFingerprint(units);
  const pieces = shipBodyPieces(units);

  let textHashOk = fingerBefore === fingerShip;
  let byteMismatches = 0;
  /** @type {unknown[]} */
  const rebuilt = [];
  let openMs = 0;
  /** @type {Record<string, number>} */
  const openDecode = {};

  const kind = typeof doc.kind === 'string' ? doc.kind : '?';
  const locale = typeof doc.locale === 'string' ? doc.locale : '?';
  for (const axis of ['kind', 'locale']) {
    const key = axis === 'kind' ? kind : locale;
    if (!ctx.groups[axis][key]) ctx.groups[axis][key] = emptyGroup();
    const group = ctx.groups[axis][key];
    group.docs += 1;
    group.contentRaw += contentRaw.length;
    group.indexRaw += indexRaw.length;
  }

  for (const piece of pieces) {
    const timed = piece.opens;
    const acc = accumulatePiece(ctx.text, piece.buf, touchBody, timed);
    if (!acc.codecOut['deflate-6'].equal || !acc.codecOut['brotli-5'].equal || !acc.codecOut['zstd-3'].equal) {
      byteMismatches += 1;
    }
    if (piece.opens) {
      openMs = ctx.text.parseSamples[ctx.text.parseSamples.length - 1];
      for (const name of Object.keys(acc.codecOut)) {
        openDecode[name] = acc.codecOut[name].decodeMs;
      }
      if (Array.isArray(acc.parsedForHash)) rebuilt.push(...acc.parsedForHash);
    } else if (piece.name.startsWith('c/')) {
      const parsed = JSON.parse(piece.buf.toString('utf8'));
      if (Array.isArray(parsed)) rebuilt.push(...parsed);
    }
    for (const axis of ['kind', 'locale']) {
      const key = axis === 'kind' ? kind : locale;
      const group = ctx.groups[axis][key];
      group.contentShip += piece.buf.length;
      for (const [name, row] of Object.entries(acc.codecOut)) {
        addCodecBytes(group, 'contentCodec', name, row.bytes);
      }
    }
    considerCeiling(ctx.ceiling.text, ctx.ceilingLimit, {
      id,
      piece: piece.name,
      bytes: piece.buf.length,
      buf: piece.buf,
      kind,
    });
  }
  ctx.text.raw += contentRaw.length;

  const indexBuf = indexPacked.output;
  const indexAcc = accumulatePiece(ctx.index, indexBuf, (parsed) => {
    touchIndex(parsed);
  }, true);
  ctx.index.raw += indexRaw.length;
  if (
    !indexAcc.codecOut['deflate-6'].equal ||
    !indexAcc.codecOut['brotli-5'].equal ||
    !indexAcc.codecOut['zstd-3'].equal
  ) {
    byteMismatches += 1;
  }
  const searchMs = ctx.index.parseSamples[ctx.index.parseSamples.length - 1];
  /** @type {Record<string, number>} */
  const searchDecode = {};
  for (const name of Object.keys(indexAcc.codecOut)) {
    searchDecode[name] = indexAcc.codecOut[name].decodeMs;
  }
  for (const axis of ['kind', 'locale']) {
    const key = axis === 'kind' ? kind : locale;
    const group = ctx.groups[axis][key];
    group.indexShip += indexBuf.length;
    for (const [name, row] of Object.entries(indexAcc.codecOut)) {
      addCodecBytes(group, 'indexCodec', name, row.bytes);
    }
  }
  considerCeiling(ctx.ceiling.index, ctx.ceilingLimit, {
    id,
    piece: 'index.json',
    bytes: indexBuf.length,
    buf: indexBuf,
    kind,
  });

  const fingerAfter = textFingerprint(rebuilt);
  if (fingerAfter !== fingerBefore) textHashOk = false;

  const contentAfter = sha256(fs.readFileSync(contentPath));
  const indexAfter = sha256(fs.readFileSync(indexPath));
  const diskOk = contentAfter === contentSha && indexAfter === indexSha;

  ctx.fingerprint.update(id);
  ctx.fingerprint.update('\0');
  ctx.fingerprint.update(contentSha);
  ctx.fingerprint.update('\0');
  ctx.fingerprint.update(indexSha);
  ctx.fingerprint.update('\n');

  return {
    id,
    textHashOk,
    byteMismatches,
    diskOk,
    openMs,
    openDecode,
    searchMs,
    searchDecode,
    chunked: pieces.some((p) => p.name === 'chunks.json'),
  };
}

/**
 * @param {{ id: string, piece: string, bytes: number, buf: Buffer, kind: string }[]} heap
 * @param {number} limit
 * @param {{ id: string, piece: string, bytes: number, buf: Buffer, kind: string }} item
 */
function considerCeiling(heap, limit, item) {
  if (limit <= 0) return;
  if (heap.length < limit) {
    heap.push(item);
    return;
  }
  let minAt = 0;
  for (let i = 1; i < heap.length; i += 1) {
    if (heap[i].bytes < heap[minAt].bytes) minAt = i;
  }
  if (item.bytes > heap[minAt].bytes) heap[minAt] = item;
}

/**
 * @param {{ id: string, piece: string, bytes: number, buf: Buffer, kind: string }} item
 */
function runCeiling(item) {
  /** @type {Record<string, { bytes: number, decodeMs: number, compressMs: number, equal: boolean, error?: string }>} */
  const codecs = {};
  const touch = item.piece === 'index.json' ? (p) => touchIndex(p) : touchBody;
  const baseline = measureParse(item.buf, touch);
  for (const codec of [...CODECS, ...CEILING_CODECS]) {
    try {
      const measured = measureCodec(item.buf, codec, touch);
      codecs[codec.name] = {
        bytes: measured.bytes,
        decodeMs: measured.decodeMs,
        compressMs: measured.compressMs,
        equal: measured.equal,
      };
    } catch (err) {
      codecs[codec.name] = {
        bytes: 0,
        decodeMs: 0,
        compressMs: 0,
        equal: false,
        error: /** @type {Error} */ (err).message,
      };
    }
  }
  return {
    id: item.id,
    piece: item.piece,
    kind: item.kind,
    shipBytes: item.bytes,
    parseMs: baseline.ms,
    codecs,
  };
}

function summarizeClass(klass) {
  /** @type {Record<string, unknown>} */
  const codecs = {};
  for (const [name, agg] of Object.entries(klass.codecs)) {
    codecs[name] = {
      bytes: agg.bytes,
      compressMs: roundMs(agg.compressMs),
      decodeMsSum: roundMs(agg.decodeMs),
      decodeP50Ms: roundMs(percentile(agg.samples, 0.5)),
      decodeP95Ms: roundMs(percentile(agg.samples, 0.95)),
    };
  }
  return {
    files: klass.files,
    rawBytes: klass.raw,
    shipBytes: klass.ship,
    parseMsSum: roundMs(klass.parseMs),
    parseP50Ms: roundMs(percentile(klass.parseSamples, 0.5)),
    parseP95Ms: roundMs(percentile(klass.parseSamples, 0.95)),
    codecs,
  };
}

function roundMs(n) {
  if (n == null || Number.isNaN(n)) return null;
  return Math.round(n * 1000) / 1000;
}

function topSlow(rows, keyFn, n) {
  return [...rows]
    .sort((a, b) => keyFn(b) - keyFn(a))
    .slice(0, n)
    .map((row) => ({
      id: row.id,
      openMs: roundMs(row.openMs),
      searchMs: roundMs(row.searchMs),
      openBrotli5Ms: roundMs(row.openDecode['brotli-5']),
      searchBrotli5Ms: roundMs(row.searchDecode['brotli-5']),
      openZstd3Ms: roundMs(row.openDecode['zstd-3']),
      searchZstd3Ms: roundMs(row.searchDecode['zstd-3']),
      openDeflate6Ms: roundMs(row.openDecode['deflate-6']),
      searchDeflate6Ms: roundMs(row.searchDecode['deflate-6']),
    }));
}

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  const out = {
    root: null,
    json: null,
    ceiling: 8,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--root') out.root = argv[++i];
    else if (a === '--json') out.json = argv[++i];
    else if (a === '--ceiling') out.ceiling = Number(argv[++i]);
    else if (a === '-h' || a === '--help') out.help = true;
    else throw new Error(`unknown arg ${a}`);
  }
  return out;
}

function probeRoot(rootDir, ceilingLimit) {
  const manifestPath = path.join(rootDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const docs = Array.isArray(manifest.documents) ? manifest.documents : [];
  const kept = docs.filter((doc) => !isAiProvenance(doc));
  const ai = docs.filter((doc) => isAiProvenance(doc));
  kept.sort((a, b) => String(a.id).localeCompare(String(b.id)));

  let aiContent = 0;
  let aiIndex = 0;
  const documentsDir = path.join(rootDir, 'documents');
  for (const doc of ai) {
    if (!doc || typeof doc.id !== 'string') continue;
    aiContent += fileSize(path.join(documentsDir, doc.id, 'content.json'));
    aiIndex += fileSize(path.join(documentsDir, doc.id, 'index.json'));
  }

  const ctx = {
    text: blankClass(),
    index: blankClass(),
    groups: { kind: {}, locale: {} },
    ceiling: { text: [], index: [] },
    ceilingLimit,
    fingerprint: crypto.createHash('sha256'),
  };

  let textHashMismatches = 0;
  let byteMismatches = 0;
  let diskMismatches = 0;
  let chunkedDocs = 0;
  /** @type {ReturnType<typeof probeDocument>[]} */
  const rows = [];
  const started = Date.now();
  for (let i = 0; i < kept.length; i += 1) {
    const doc = kept[i];
    const row = probeDocument(doc, documentsDir, ctx);
    rows.push(row);
    if (!row.textHashOk) textHashMismatches += 1;
    byteMismatches += row.byteMismatches;
    if (!row.diskOk) diskMismatches += 1;
    if (row.chunked) chunkedDocs += 1;
    if ((i + 1) % 100 === 0 || i + 1 === kept.length) {
      console.error(
        `probed ${i + 1}/${kept.length} in ${((Date.now() - started) / 1000).toFixed(1)}s`,
      );
    }
  }

  const ceiling = [
    ...ctx.ceiling.index.map(runCeiling),
    ...ctx.ceiling.text.map(runCeiling),
  ];
  for (const row of ceiling) {
    for (const codec of Object.values(row.codecs)) {
      if (!codec.equal && !codec.error) byteMismatches += 1;
    }
  }

  const siblings = {};
  for (const name of ['search', 'papacy', 'santoral', 'context']) {
    siblings[name] = treeBytes(path.join(rootDir, name));
  }

  return {
    node: process.version,
    root: rootDir,
    manifestDocs: docs.length,
    aiDocs: ai.length,
    keptDocs: kept.length,
    aiContentRaw: aiContent,
    aiIndexRaw: aiIndex,
    chunkedDocs,
    textHashMismatches,
    byteMismatches,
    diskMismatches,
    corpusFingerprint: ctx.fingerprint.digest('hex'),
    text: summarizeClass(ctx.text),
    index: summarizeClass(ctx.index),
    byKind: ctx.groups.kind,
    byLocale: ctx.groups.locale,
    ceiling,
    slowestSearch: topSlow(rows, (r) => r.searchMs, 5),
    slowestOpen: topSlow(rows, (r) => r.openMs, 5),
    siblingsRaw: siblings,
    elapsedMs: Date.now() - started,
  };
}

function fileSize(p) {
  try {
    return fs.statSync(p).size;
  } catch {
    return 0;
  }
}

function main(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(
      'node scripts/corpus-codec-probe.js [--root documentos/corpus] [--json out.json] [--ceiling 8]',
    );
    return;
  }
  const root = path.resolve(args.root || path.join(__dirname, '..', 'documentos', 'corpus'));
  if (!fs.existsSync(path.join(root, 'manifest.json'))) {
    console.error(`missing manifest: ${root}`);
    process.exit(2);
  }
  if (args.json) {
    const dest = path.resolve(args.json);
    const rel = path.relative(root, dest);
    if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
      console.error(`refuse to write inside corpus: ${dest}`);
      process.exit(2);
    }
  }
  const report = probeRoot(root, Number.isFinite(args.ceiling) ? args.ceiling : 8);
  const json = JSON.stringify(report, null, 2);
  if (args.json) fs.writeFileSync(args.json, json);
  else process.stdout.write(json + '\n');
  console.error(
    `kept=${report.keptDocs} textHashMismatches=${report.textHashMismatches} byteMismatches=${report.byteMismatches} diskMismatches=${report.diskMismatches} elapsedMs=${report.elapsedMs}`,
  );
  if (report.textHashMismatches || report.byteMismatches || report.diskMismatches) {
    process.exit(1);
  }
}

module.exports = {
  textFingerprint,
  shipBodyPieces,
  measureCodec,
  measureParse,
  touchBody,
  touchIndex,
  CODECS,
  CEILING_CODECS,
  probeRoot,
};

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  }
}
