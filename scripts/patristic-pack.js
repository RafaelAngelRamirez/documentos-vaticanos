#!/usr/bin/env node
/**
 * Offline patristic pack.
 *
 * The base APK keeps the ship corpus except kind=patristic. Those works
 * travel in a pack that is installed once on the device and read locally.
 * Canonical documentos/corpus is only read. The text is not rewritten.
 *
 *   node scripts/patristic-pack.js split \
 *     --canonical documentos/corpus \
 *     --ship <apk-public>/assets/corpus \
 *     --out dist/packs/patristica
 *
 *   node scripts/patristic-pack.js proof \
 *     --canonical documentos/corpus \
 *     --check --out scripts/proof/patristic-pack-hash.ndjson
 */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { serializeCompact } = require('./corpus-compress.js');

const PACK_ID = 'patristica';
const PACK_VERSION = 1;

function sha256Buffer(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function sha256File(file) {
  return sha256Buffer(fs.readFileSync(file));
}

function normalizeUnit(raw) {
  return String(raw ?? '')
    .normalize('NFC')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

function hashUnits(units) {
  const h = crypto.createHash('sha256');
  const list = Array.isArray(units) ? units : [];
  for (const u of list) {
    const text =
      u && typeof u === 'object' && !Array.isArray(u) ? u.contenido : '';
    h.update(normalizeUnit(text), 'utf8');
    h.update('\u001e', 'utf8');
  }
  return h.digest('hex');
}

/**
 * Ship patristic: in the APK corpus, not an AI translation.
 * @param {unknown} doc
 */
function isPatristicShipDoc(doc) {
  if (!doc || typeof doc !== 'object') return false;
  const row = /** @type {{ kind?: unknown, translationProvenance?: unknown, id?: unknown }} */ (
    doc
  );
  if (row.kind !== 'patristic') return false;
  if (row.translationProvenance === 'ai') return false;
  return typeof row.id === 'string' && safeDocId(row.id) !== null;
}

/**
 * Any patristic row, including AI twins. Those stay out of the base APK
 * and out of this pack (drop-ai already removes them from the ship copy).
 * @param {unknown} doc
 */
function isPatristicKind(doc) {
  if (!doc || typeof doc !== 'object') return false;
  const row = /** @type {{ kind?: unknown, id?: unknown }} */ (doc);
  return row.kind === 'patristic' && typeof row.id === 'string';
}

/**
 * @param {string} id
 * @returns {string|null}
 */
function safeDocId(id) {
  if (typeof id !== 'string') return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id)) return null;
  if (id.includes('..')) return null;
  return id;
}

/**
 * @param {string} root
 * @param {string} id
 */
function safeDocumentDir(root, id) {
  const safe = safeDocId(id);
  if (!safe) return null;
  const documentsRoot = path.resolve(root, 'documents');
  const dir = path.resolve(documentsRoot, safe);
  const prefix = documentsRoot.endsWith(path.sep)
    ? documentsRoot
    : documentsRoot + path.sep;
  if (dir === documentsRoot || !dir.startsWith(prefix)) return null;
  return dir;
}

/**
 * @param {string} target
 * @param {string} canonicalRoot
 */
function assertOutsideCanonical(target, canonicalRoot) {
  const canon = path.resolve(canonicalRoot);
  const dest = path.resolve(target);
  if (dest === canon) {
    throw new Error(`refuse to write the canonical corpus: ${dest}`);
  }
  const rel = path.relative(canon, dest);
  if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
    throw new Error(`refuse to write inside the canonical corpus: ${dest}`);
  }
}

/**
 * @param {readonly { id: string, contentSha256: string }[]} docs
 */
function packSha256(docs) {
  const h = crypto.createHash('sha256');
  const rows = [...docs].sort((a, b) => a.id.localeCompare(b.id));
  for (const doc of rows) {
    h.update(String(doc.id), 'utf8');
    h.update('\0', 'utf8');
    h.update(String(doc.contentSha256).toLowerCase(), 'utf8');
    h.update('\n', 'utf8');
  }
  return h.digest('hex');
}

/**
 * @param {string} canonicalRoot
 */
function readManifest(canonicalRoot) {
  const manPath = path.join(canonicalRoot, 'manifest.json');
  if (!fs.existsSync(manPath)) {
    throw new Error(`missing manifest.json under ${canonicalRoot}`);
  }
  const man = JSON.parse(fs.readFileSync(manPath, 'utf8'));
  const documents = Array.isArray(man.documents) ? man.documents : [];
  return { manPath, man, documents };
}

/**
 * Copy canonical content.json and index.json. Bytes stay identical.
 * @param {{ canonicalRoot: string, outDir: string }} opts
 */
function buildPatristicPack(opts) {
  const canonicalRoot = path.resolve(opts.canonicalRoot);
  const outDir = path.resolve(opts.outDir);
  assertOutsideCanonical(outDir, canonicalRoot);
  const { documents } = readManifest(canonicalRoot);
  const selected = documents.filter(isPatristicShipDoc);
  selected.sort((a, b) => String(a.id).localeCompare(String(b.id)));

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  /** @type {Record<string, unknown>[]} */
  const packedDocs = [];
  for (const doc of selected) {
    const id = safeDocId(doc.id);
    if (!id) throw new Error(`unsafe document id: ${doc && doc.id}`);
    const srcDir = safeDocumentDir(canonicalRoot, id);
    if (!srcDir) throw new Error(`unsafe document dir: ${id}`);
    const contentSrc = path.join(srcDir, 'content.json');
    const indexSrc = path.join(srcDir, 'index.json');
    if (!fs.existsSync(contentSrc)) {
      throw new Error(`missing canonical content.json for ${id}`);
    }
    if (!fs.existsSync(indexSrc)) {
      throw new Error(`missing canonical index.json for ${id}`);
    }
    const destDir = path.join(outDir, 'documents', id);
    fs.mkdirSync(destDir, { recursive: true });
    const contentDest = path.join(destDir, 'content.json');
    const indexDest = path.join(destDir, 'index.json');
    fs.copyFileSync(contentSrc, contentDest);
    fs.copyFileSync(indexSrc, indexDest);
    const metaSrc = path.join(srcDir, 'meta.json');
    if (fs.existsSync(metaSrc)) {
      fs.copyFileSync(metaSrc, path.join(destDir, 'meta.json'));
    }
    const contentBytes = fs.statSync(contentDest).size;
    const contentSha = sha256File(contentDest);
    if (contentSha !== sha256File(contentSrc)) {
      throw new Error(`copy changed content.json bytes: ${id}`);
    }
    packedDocs.push({
      ...doc,
      id,
      kind: 'patristic',
      packId: PACK_ID,
      bodyPath: `documents/${id}/content.json`,
      indexPath: `documents/${id}/index.json`,
      contentSha256: contentSha,
      contentBytes,
    });
  }

  const manifest = {
    id: PACK_ID,
    version: PACK_VERSION,
    packSha256: packSha256(
      packedDocs.map((d) => ({
        id: String(d.id),
        contentSha256: String(d.contentSha256),
      })),
    ),
    documents: packedDocs,
  };
  fs.writeFileSync(
    path.join(outDir, 'manifest.json'),
    JSON.stringify(manifest),
  );
  return {
    outDir,
    documentCount: packedDocs.length,
    packSha256: manifest.packSha256,
    contentBytes: packedDocs.reduce(
      (sum, d) => sum + Number(d.contentBytes || 0),
      0,
    ),
  };
}

/**
 * @param {string} packDir
 * @returns {{ ok: true, documentCount: number, packSha256: string } | { ok: false, reason: string }}
 */
function verifyPatristicPack(packDir) {
  const root = path.resolve(packDir);
  const manPath = path.join(root, 'manifest.json');
  if (!fs.existsSync(manPath)) {
    return { ok: false, reason: 'El paquete no trae manifiesto' };
  }
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manPath, 'utf8'));
  } catch {
    return { ok: false, reason: 'El manifiesto no se puede leer' };
  }
  if (!manifest || manifest.id !== PACK_ID || manifest.version !== PACK_VERSION) {
    return { ok: false, reason: 'El manifiesto no es el paquete de patrística' };
  }
  const documents = Array.isArray(manifest.documents) ? manifest.documents : [];
  if (!documents.length) {
    return { ok: false, reason: 'El paquete no trae obras' };
  }
  const expected = packSha256(
    documents.map((d) => ({
      id: String(d.id),
      contentSha256: String(d.contentSha256 || ''),
    })),
  );
  if (expected !== manifest.packSha256) {
    return { ok: false, reason: 'El hash del manifiesto no coincide' };
  }
  for (const doc of documents) {
    const id = safeDocId(doc && doc.id);
    if (!id) return { ok: false, reason: 'El paquete trae un id inválido' };
    const file = path.join(root, 'documents', id, 'content.json');
    const index = path.join(root, 'documents', id, 'index.json');
    if (!fs.existsSync(file)) {
      return { ok: false, reason: `Falta el texto: ${id}` };
    }
    if (!fs.existsSync(index)) {
      return { ok: false, reason: `Falta el índice: ${id}` };
    }
    const buf = fs.readFileSync(file);
    if (buf.length !== doc.contentBytes) {
      return { ok: false, reason: `El texto no coincide: ${id}` };
    }
    const hex = sha256Buffer(buf);
    if (hex !== String(doc.contentSha256 || '').toLowerCase()) {
      return { ok: false, reason: `El hash no coincide: ${id}` };
    }
  }
  return {
    ok: true,
    documentCount: documents.length,
    packSha256: manifest.packSha256,
  };
}

/**
 * Remove patristic works from a ship copy. Never the canonical tree.
 * @param {string} shipRoot
 * @param {string} canonicalRoot
 */
function detachPatristicFromShip(shipRoot, canonicalRoot) {
  const ship = path.resolve(shipRoot);
  const canon = path.resolve(canonicalRoot);
  assertOutsideCanonical(ship, canon);
  const manPath = path.join(ship, 'manifest.json');
  if (!fs.existsSync(manPath)) {
    throw new Error(`detach: missing manifest.json under ${ship}`);
  }
  const man = JSON.parse(fs.readFileSync(manPath, 'utf8'));
  const docs = Array.isArray(man.documents) ? man.documents : [];
  /** @type {string[]} */
  const dropped = [];
  const kept = [];
  for (const doc of docs) {
    if (isPatristicKind(doc)) {
      dropped.push(String(doc.id));
    } else {
      kept.push(doc);
    }
  }
  const canonDocs = readManifest(canon).documents;
  const extraIds = canonDocs.filter(isPatristicKind).map((d) => String(d.id));
  const removeIds = new Set([...dropped, ...extraIds]);
  for (const id of removeIds) {
    const dir = safeDocumentDir(ship, id);
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
  const next = { ...man, documents: kept };
  const tmp = manPath + '.tmp-patristic';
  fs.writeFileSync(tmp, serializeCompact(next));
  fs.renameSync(tmp, manPath);
  return { dropped: dropped.length, kept: kept.length };
}

/**
 * @param {string} shipRoot
 * @param {string} canonicalRoot
 */
function assertBaseHasNoPatristic(shipRoot, canonicalRoot) {
  const ship = path.resolve(shipRoot);
  const { documents } = readManifest(ship);
  const left = documents.filter(isPatristicKind);
  if (left.length) {
    throw new Error(
      `base still lists ${left.length} patristic documents (first ${left[0].id})`,
    );
  }
  const canonDocs = readManifest(path.resolve(canonicalRoot)).documents;
  for (const doc of canonDocs.filter(isPatristicKind)) {
    const dir = safeDocumentDir(ship, String(doc.id));
    if (dir && fs.existsSync(dir)) {
      throw new Error(`base still has patristic directory ${doc.id}`);
    }
  }
  return { kept: documents.length };
}

/**
 * @param {string} dir
 * @param {string} zipPath
 */
function zipPackDir(dir, zipPath) {
  const dest = path.resolve(zipPath);
  fs.rmSync(dest, { force: true });
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const r = spawnSync('zip', ['-X', '-r', '-q', dest, '.'], {
    cwd: dir,
    encoding: 'utf8',
  });
  if (r.status !== 0) {
    throw new Error(
      `zip failed (${r.status}): ${r.stderr || r.stdout || 'no zip output'}`,
    );
  }
  return dest;
}

/**
 * @param {string} canonicalRoot
 * @returns {{ id: string, bytes: number, contentSha256: string, textHash: string }[]}
 */
function proofRows(canonicalRoot) {
  const { documents } = readManifest(canonicalRoot);
  const selected = documents.filter(isPatristicShipDoc);
  selected.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return selected.map((doc) => {
    const id = String(doc.id);
    const file = path.join(canonicalRoot, 'documents', id, 'content.json');
    const buf = fs.readFileSync(file);
    const units = JSON.parse(buf.toString('utf8'));
    return {
      id,
      bytes: buf.length,
      contentSha256: sha256Buffer(buf),
      textHash: hashUnits(units),
    };
  });
}

/**
 * @param {string} canonicalRoot
 * @param {string} outFile
 */
function writeProof(canonicalRoot, outFile) {
  const rows = proofRows(canonicalRoot);
  const body = rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
  fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
  fs.writeFileSync(outFile, body);
  return summarizeProof(rows);
}

/**
 * @param {readonly { id: string, bytes: number, contentSha256: string, textHash: string }[]} rows
 */
function summarizeProof(rows) {
  return {
    docs: rows.length,
    textMismatches: 0,
    contentBytes: rows.reduce((s, r) => s + r.bytes, 0),
    packSha256: packSha256(rows),
  };
}

/**
 * Recompute canonical hashes and compare to the committed proof.
 * Also hashes a pack copy when packDir is set.
 * @param {string} canonicalRoot
 * @param {string} proofFile
 * @param {string} [packDir]
 */
function checkProof(canonicalRoot, proofFile, packDir) {
  const live = proofRows(canonicalRoot);
  const text = fs.readFileSync(proofFile, 'utf8').trim();
  const recorded = text
    ? text.split('\n').map((line) => JSON.parse(line))
    : [];
  if (recorded.length !== live.length) {
    throw new Error(
      `proof docs ${recorded.length} != live ${live.length}`,
    );
  }
  let textMismatches = 0;
  for (let i = 0; i < live.length; i++) {
    const a = live[i];
    const b = recorded[i];
    if (
      a.id !== b.id ||
      a.bytes !== b.bytes ||
      a.contentSha256 !== b.contentSha256 ||
      a.textHash !== b.textHash
    ) {
      textMismatches += 1;
      if (textMismatches <= 5) {
        console.error(
          `mismatch ${a.id}: live ${a.textHash} recorded ${b && b.textHash}`,
        );
      }
    }
    if (packDir) {
      const copy = path.join(packDir, 'documents', a.id, 'content.json');
      const buf = fs.readFileSync(copy);
      const copyHash = hashUnits(JSON.parse(buf.toString('utf8')));
      const copySha = sha256Buffer(buf);
      if (copyHash !== a.textHash || copySha !== a.contentSha256) {
        textMismatches += 1;
        console.error(`pack copy mismatch ${a.id}`);
      }
    }
  }
  if (textMismatches) {
    throw new Error(`text hash mismatches: ${textMismatches}`);
  }
  return summarizeProof(live);
}

function argValue(argv, name) {
  const i = argv.indexOf(name);
  if (i < 0) return '';
  return argv[i + 1] || '';
}

function main(argv) {
  const cmd = argv[0];
  if (!cmd || cmd === '--help' || cmd === '-h') {
    console.log(
      'Usage: node scripts/patristic-pack.js <split|build|verify|detach|assert-base|proof> [options]',
    );
    process.exit(cmd ? 0 : 1);
  }
  const canonical = argValue(argv, '--canonical');
  const ship = argValue(argv, '--ship');
  const out = argValue(argv, '--out');
  const pack = argValue(argv, '--pack');

  if (cmd === 'build') {
    if (!canonical || !out) {
      throw new Error('build requires --canonical and --out');
    }
    const built = buildPatristicPack({ canonicalRoot: canonical, outDir: out });
    const verified = verifyPatristicPack(built.outDir);
    if (!verified.ok) throw new Error(verified.reason);
    console.log(JSON.stringify({ ...built, verified: verified.documentCount }));
    return;
  }

  if (cmd === 'verify') {
    const dir = pack || out;
    if (!dir) throw new Error('verify requires --pack');
    const verified = verifyPatristicPack(dir);
    console.log(JSON.stringify(verified));
    if (!verified.ok) process.exit(1);
    return;
  }

  if (cmd === 'detach') {
    if (!canonical || !ship) {
      throw new Error('detach requires --canonical and --ship');
    }
    const result = detachPatristicFromShip(ship, canonical);
    console.log(JSON.stringify(result));
    return;
  }

  if (cmd === 'assert-base') {
    if (!canonical || !ship) {
      throw new Error('assert-base requires --canonical and --ship');
    }
    console.log(JSON.stringify(assertBaseHasNoPatristic(ship, canonical)));
    return;
  }

  if (cmd === 'split') {
    if (!canonical || !ship || !out) {
      throw new Error('split requires --canonical, --ship and --out');
    }
    const built = buildPatristicPack({ canonicalRoot: canonical, outDir: out });
    const verified = verifyPatristicPack(built.outDir);
    if (!verified.ok) throw new Error(verified.reason);
    const zipPath = zipPackDir(built.outDir, `${path.resolve(out)}.zip`);
    const detached = detachPatristicFromShip(ship, canonical);
    const base = assertBaseHasNoPatristic(ship, canonical);
    console.log(
      JSON.stringify({
        pack: built.outDir,
        zip: zipPath,
        zipBytes: fs.statSync(zipPath).size,
        documentCount: built.documentCount,
        contentBytes: built.contentBytes,
        packSha256: built.packSha256,
        detached: detached.dropped,
        baseDocuments: base.kept,
      }),
    );
    return;
  }

  if (cmd === 'proof') {
    if (!canonical || !out) {
      throw new Error('proof requires --canonical and --out');
    }
    if (argv.includes('--check')) {
      const summary = checkProof(canonical, out, pack || undefined);
      console.log(JSON.stringify(summary));
      return;
    }
    const summary = writeProof(canonical, out);
    console.log(JSON.stringify(summary));
    return;
  }

  throw new Error(`unknown command: ${cmd}`);
}

module.exports = {
  PACK_ID,
  PACK_VERSION,
  isPatristicShipDoc,
  isPatristicKind,
  safeDocId,
  packSha256,
  sha256Buffer,
  hashUnits,
  buildPatristicPack,
  verifyPatristicPack,
  detachPatristicFromShip,
  assertBaseHasNoPatristic,
  proofRows,
  assertOutsideCanonical,
};

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (err) {
    console.error(err && err.message ? err.message : err);
    process.exit(1);
  }
}
