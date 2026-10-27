#!/usr/bin/env node
/**
 * Per-document sha256 of reading order, consecutivo, contenido, referencias
 * (missing and [] match), biblia, and every other field except index_array.
 * Index lists are checked by expanding deltas back to absolute postings.
 *
 * Run:
 *   bash scripts/node-strip-types.sh scripts/corpus-reading-hash.js --self-test
 *   bash scripts/node-strip-types.sh scripts/corpus-reading-hash.js --check --root <corpus> --out <tsv>
 *   bash scripts/node-strip-types.sh scripts/corpus-reading-hash.js --apk <file.apk> --out <txt>
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const {
  compressCorpusTree,
  compressJsonBuffer,
} = require('./corpus-compress.js');

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = stable(/** @type {Record<string, unknown>} */ (value)[key]);
    }
    return out;
  }
  return value;
}

/**
 * @param {unknown} unit
 */
function canonicalUnit(unit) {
  if (!unit || typeof unit !== 'object' || Array.isArray(unit)) {
    return {
      consecutivo: null,
      contenido: null,
      referencias: [],
      biblia: null,
      extra: {},
    };
  }
  const obj = /** @type {Record<string, unknown>} */ (unit);
  /** @type {Record<string, unknown>} */
  const extra = {};
  for (const key of Object.keys(obj)) {
    if (
      key === 'index_array' ||
      key === 'consecutivo' ||
      key === 'contenido' ||
      key === 'referencias' ||
      key === 'biblia'
    ) {
      continue;
    }
    extra[key] = obj[key];
  }
  const refs = Object.prototype.hasOwnProperty.call(obj, 'referencias')
    ? obj.referencias
    : [];
  return stable({
    consecutivo: obj.consecutivo === undefined ? null : obj.consecutivo,
    contenido: obj.contenido === undefined ? null : obj.contenido,
    referencias: refs == null ? [] : refs,
    biblia: obj.biblia === undefined ? null : obj.biblia,
    extra,
  });
}

/**
 * @param {string} docDir
 * @returns {unknown[] | null}
 */
function loadUnits(docDir) {
  const chunksPath = path.join(docDir, 'chunks.json');
  if (fs.existsSync(chunksPath)) {
    const spec = JSON.parse(fs.readFileSync(chunksPath, 'utf8'));
    const size = spec.chunkSize > 0 ? spec.chunkSize : 500;
    const count = spec.unitCount > 0 ? spec.unitCount : 0;
    const chunks = Math.ceil(count / size) || 0;
    /** @type {unknown[]} */
    const units = [];
    for (let c = 0; c < chunks; c++) {
      const part = JSON.parse(
        fs.readFileSync(path.join(docDir, 'c', `${c}.json`), 'utf8'),
      );
      if (!Array.isArray(part)) return null;
      units.push(...part);
    }
    return units;
  }
  const contentPath = path.join(docDir, 'content.json');
  if (!fs.existsSync(contentPath)) return null;
  const data = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
  return Array.isArray(data) ? data : null;
}

/**
 * @param {unknown[]} units
 */
function hashUnits(units) {
  const canon = units.map(canonicalUnit);
  return crypto.createHash('sha256').update(JSON.stringify(canon)).digest('hex');
}

/**
 * @param {unknown} raw
 * @param {(value: unknown) => unknown} expandShipIndex
 */
function logicalIndex(raw, expandShipIndex) {
  const expanded = expandShipIndex(raw);
  if (!expanded || typeof expanded !== 'object' || Array.isArray(expanded)) {
    return null;
  }
  const obj = /** @type {Record<string, unknown>} */ (expanded);
  return stable({
    indice: obj.indice || {},
    indice_por_punto: obj.indice_por_punto || {},
  });
}

/**
 * @param {string} srcDir
 * @param {string} destDir
 */
function copyDir(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const ent of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const from = path.join(srcDir, ent.name);
    const to = path.join(destDir, ent.name);
    if (ent.isDirectory()) copyDir(from, to);
    else if (ent.isFile()) fs.copyFileSync(from, to);
  }
}

/**
 * @param {string} root
 * @param {(value: unknown) => unknown} expandShipIndex
 * @param {string} outPath
 */
function checkRoot(root, expandShipIndex, outPath) {
  const documents = path.join(root, 'documents');
  if (!fs.existsSync(documents)) {
    throw new Error(`missing documents/ under ${root}`);
  }
  const ids = fs
    .readdirSync(documents, { withFileTypes: true })
    .filter((ent) => ent.isDirectory())
    .map((ent) => ent.name)
    .sort();
  /** @type {string[]} */
  const lines = ['documentId\tunits\tsha256_before\tsha256_after\tindex_equal'];
  let docs = 0;
  let mismatches = 0;
  for (const id of ids) {
    const docDir = path.join(documents, id);
    const beforeUnits = loadUnits(docDir);
    if (!beforeUnits) continue;
    const beforeHash = hashUnits(beforeUnits);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'corpus-hash-'));
    try {
      const copy = path.join(tmp, 'documents', id);
      copyDir(docDir, copy);
      compressCorpusTree(tmp);
      const afterUnits = loadUnits(copy);
      const afterHash = afterUnits ? hashUnits(afterUnits) : '';
      let indexEqual = 'no-index';
      const indexPath = path.join(docDir, 'index.json');
      if (fs.existsSync(indexPath)) {
        const raw = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
        const packed = compressJsonBuffer(
          fs.readFileSync(indexPath),
          'index.json',
        );
        const left = logicalIndex(raw, expandShipIndex);
        const right = logicalIndex(packed.parsed, expandShipIndex);
        indexEqual =
          JSON.stringify(left) === JSON.stringify(right) ? 'yes' : 'no';
      }
      const textEqual = beforeHash === afterHash;
      if (!textEqual || indexEqual === 'no') mismatches += 1;
      lines.push(
        [id, String(beforeUnits.length), beforeHash, afterHash, indexEqual].join(
          '\t',
        ),
      );
      docs += 1;
      if (docs % 50 === 0) {
        process.stderr.write(`hashed ${docs}\n`);
      }
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }
  const body = lines.join('\n') + '\n';
  if (outPath) fs.writeFileSync(outPath, body);
  else process.stdout.write(body);
  process.stderr.write(
    `documents ${docs} mismatches ${mismatches}\n`,
  );
  if (mismatches > 0) process.exit(1);
}

function selfTest(expandShipIndex) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'corpus-hash-self-'));
  const doc = path.join(root, 'documents', 'demo-es');
  fs.mkdirSync(doc, { recursive: true });
  const units = [];
  for (let i = 0; i < 3; i++) {
    units.push({
      consecutivo: `n ${i}`,
      contenido: `Texto estable ${i}. La nota queda.`,
      referencias: i === 1 ? [] : [{ descripcion: `cf. ${i}` }],
      nota: i === 2 ? 'al margen' : undefined,
      index_array: i,
    });
  }
  delete units[0].nota;
  fs.writeFileSync(path.join(doc, 'content.json'), JSON.stringify(units));
  const postings = [];
  for (let i = 0; i < 3000; i++) postings.push(i * 2);
  fs.writeFileSync(
    path.join(doc, 'index.json'),
    JSON.stringify({
      indice: { texto: postings },
      indice_por_punto: { 0: 1, 1: 2, 2: 8 },
    }),
  );
  const before = hashUnits(/** @type {unknown[]} */ (loadUnits(doc)));
  compressCorpusTree(root);
  const after = hashUnits(/** @type {unknown[]} */ (loadUnits(doc)));
  if (before !== after) {
    throw new Error(`self-test text hash changed ${before} ${after}`);
  }
  const raw = JSON.parse(fs.readFileSync(path.join(doc, 'index.json'), 'utf8'));
  const logical = logicalIndex(raw, expandShipIndex);
  const texto = /** @type {{ indice: { texto: number[] } }} */ (logical).indice
    .texto;
  if (texto.length !== 3000 || texto[2999] !== 5998) {
    throw new Error('self-test postings did not expand');
  }
  const packed = compressJsonBuffer(
    JSON.stringify({
      indice: { texto: postings },
      indice_por_punto: { 0: 1, 1: 2, 2: 8 },
    }),
    'index.json',
  );
  const again = logicalIndex(packed.parsed, expandShipIndex);
  if (JSON.stringify(again) !== JSON.stringify(logicalIndex({
    indice: { texto: postings },
    indice_por_punto: { 0: 1, 1: 2, 2: 8 },
  }, expandShipIndex))) {
    throw new Error('self-test index logical mismatch');
  }
  fs.rmSync(root, { recursive: true, force: true });
  process.stdout.write(`self-test sha256 ${before}\n`);
}

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  /** @type {{ selfTest: boolean, check: boolean, root: string, apk: string, out: string }} */
  const out = { selfTest: false, check: false, root: '', apk: '', out: '' };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--self-test') out.selfTest = true;
    else if (arg === '--check') out.check = true;
    else if (arg === '--root') out.root = argv[++i] || '';
    else if (arg === '--apk') out.apk = argv[++i] || '';
    else if (arg === '--out') out.out = argv[++i] || '';
    else throw new Error(`unknown arg ${arg}`);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const logic = path.join(
    __dirname,
    '../frontend/src/app/core/corpus/corpus-load.logic.ts',
  );
  const mod = await import(pathToFileURL(logic).href);
  if (args.selfTest) {
    selfTest(mod.expandShipIndex);
    return;
  }
  if (args.apk) {
    measureApkFile(args.apk, mod.expandShipIndex, args.out);
    return;
  }
  if (args.check) {
    if (!args.root) throw new Error('--check needs --root');
    checkRoot(args.root, mod.expandShipIndex, args.out);
    return;
  }
  throw new Error('pass --self-test, --check --root, or --apk');
}

/**
 * @param {string} apkPath
 * @param {(value: unknown) => unknown} expandShipIndex
 * @param {string} outPath
 */
function measureApkFile(apkPath, expandShipIndex, outPath) {
  const zip = openZip(apkPath);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'apk-index-'));
  const manifest = path.join(tmp, 'manifest.tsv');
  const lines = ['name\tapk_compress\torig\tpacked'];
  let files = 0;
  let indexMismatch = 0;
  for (const entry of zip) {
    if (!entry.name.endsWith('/index.json')) continue;
    if (!entry.name.includes('/documents/')) continue;
    const packed = compressJsonBuffer(entry.data, 'index.json');
    const origFile = path.join(tmp, `${files}.orig`);
    const packedFile = path.join(tmp, `${files}.bin`);
    fs.writeFileSync(origFile, entry.data);
    fs.writeFileSync(packedFile, packed.output);
    lines.push(
      [entry.name, String(entry.compressSize), origFile, packedFile].join('\t'),
    );
    const raw = JSON.parse(entry.data.toString('utf8'));
    const left = logicalIndex(raw, expandShipIndex);
    const right = logicalIndex(packed.parsed, expandShipIndex);
    if (JSON.stringify(left) !== JSON.stringify(right)) indexMismatch += 1;
    files += 1;
    if (files % 200 === 0) process.stderr.write(`apk index ${files}\n`);
  }
  fs.writeFileSync(manifest, lines.join('\n') + '\n');
  const py = [
    'import pathlib, zlib, sys',
    'root = pathlib.Path(sys.argv[1])',
    'before = after = shrunk = grew = same = shrunk_b = grew_b = matched = files = 0',
    'def stored(data):',
    '    co = zlib.compressobj(1, zlib.DEFLATED, -15, 8)',
    '    return len(co.compress(data) + co.flush())',
    'for line in (root / "manifest.tsv").read_text().splitlines()[1:]:',
    '    name, apk_s, orig, packed = line.split("\\t")',
    '    apk_n = int(apk_s)',
    '    orig_n = stored(pathlib.Path(orig).read_bytes())',
    '    packed_n = stored(pathlib.Path(packed).read_bytes())',
    '    if orig_n == apk_n: matched += 1',
    '    before += apk_n',
    '    after += packed_n',
    '    files += 1',
    '    if packed_n < apk_n:',
    '        shrunk += 1',
    '        shrunk_b += apk_n - packed_n',
    '    elif packed_n > apk_n:',
    '        grew += 1',
    '        grew_b += packed_n - apk_n',
    '    else:',
    '        same += 1',
    'print(f"{files} {before} {after} {before - after} {shrunk} {grew} {same} {shrunk_b} {grew_b} {matched}")',
  ].join('\n');
  const { execFileSync } = require('child_process');
  const summary = execFileSync('python3', ['-c', py, tmp], { encoding: 'utf8' }).trim();
  const [nFiles, beforeS, afterS, saveS, shrunkS, grewS, sameS, shrunkBS, grewBS, matchedS] =
    summary.split(' ');
  const apkBytes = fs.statSync(apkPath).size;
  const save = Number(saveS);
  const report = [
    `apk ${apkPath}`,
    `apk_bytes ${apkBytes}`,
    `index_files ${nFiles}`,
    `orig_deflate_matches_apk ${matchedS}`,
    `index_stored_before ${beforeS}`,
    `index_stored_after ${afterS}`,
    `index_stored_save ${saveS}`,
    `files_smaller ${shrunkS}`,
    `files_larger ${grewS}`,
    `files_same ${sameS}`,
    `bytes_saved_on_smaller ${shrunkBS}`,
    `bytes_added_on_larger ${grewBS}`,
    `index_logical_mismatches ${indexMismatch}`,
    `apk_bytes_after ${apkBytes - save}`,
    'deflate CPython zlib 1.3.2 level 1 window -15 memLevel 8',
    `node_zlib ${process.versions.zlib}`,
  ];
  const text = report.join('\n') + '\n';
  if (outPath) fs.writeFileSync(outPath, text);
  process.stdout.write(text);
  fs.rmSync(tmp, { recursive: true, force: true });
  if (
    indexMismatch > 0 ||
    Number(nFiles) !== files ||
    Number(matchedS) !== Number(nFiles)
  ) {
    process.exit(1);
  }
}

/**
 * @param {string} apkPath
 * @returns {{ name: string, data: Buffer, compressSize: number }[]}
 */
function openZip(apkPath) {
  const buf = fs.readFileSync(apkPath);
  const zlib = require('zlib');
  /** @type {{ name: string, data: Buffer, compressSize: number }[]} */
  const out = [];
  let offset = 0;
  while (offset + 30 <= buf.length) {
    const sig = buf.readUInt32LE(offset);
    if (sig !== 0x04034b50) break;
    const flags = buf.readUInt16LE(offset + 6);
    const method = buf.readUInt16LE(offset + 8);
    const compressSize = buf.readUInt32LE(offset + 18);
    if (flags & 0x8) {
      throw new Error('zip data descriptor is not supported');
    }
    const nameLen = buf.readUInt16LE(offset + 26);
    const extraLen = buf.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const name = buf.slice(nameStart, nameStart + nameLen).toString('utf8');
    const dataStart = nameStart + nameLen + extraLen;
    const payload = buf.slice(dataStart, dataStart + compressSize);
    let data = payload;
    if (method === 8) data = zlib.inflateRawSync(payload);
    else if (method !== 0) {
      offset = dataStart + compressSize;
      continue;
    }
    if (name.endsWith('/index.json') && name.includes('/documents/')) {
      out.push({ name, data, compressSize });
    }
    offset = dataStart + compressSize;
  }
  return out;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
