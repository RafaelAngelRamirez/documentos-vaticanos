#!/usr/bin/env node
/**
 * Per-document proof that ship compression does not change normalized text.
 *
 * Normalized text, per unit, in order:
 *   Unicode NFC of `contenido`, with CR/LF turned into LF.
 * The document hash is SHA-256 over those strings separated by U+001E.
 *
 * Before: canonical documentos/corpus (docs that the APK keeps:
 * translationProvenance !== "ai").
 * After: the same units passed through compressJsonBuffer('content.json')
 * and, when the ship pack splits a long body, through writeShipChunks.
 * index.json is packed and unpacked; postings must match. It is not part
 * of the text hash.
 *
 *   node scripts/ship-text-parity.js [--out path.ndjson]
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  compressJsonBuffer,
  writeShipChunks,
  SHIP_BODY_CHUNK_SIZE,
} = require('./corpus-compress.js');
const { packIndexBuffer, unpackIndex, sameIndex } = require('./index-pack.js');

const ROOT = path.resolve(__dirname, '..');
const CANON = path.join(ROOT, 'documentos', 'corpus');

function normalizeUnit(raw) {
  return String(raw ?? '')
    .normalize('NFC')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

function hashUnits(units) {
  const h = crypto.createHash('sha256');
  for (const u of units) {
    const text =
      u && typeof u === 'object' && !Array.isArray(u) ? u.contenido : '';
    h.update(normalizeUnit(text), 'utf8');
    h.update('\u001e', 'utf8');
  }
  return h.digest('hex');
}

function loadShippedUnits(docDir, fallback) {
  const contentPath = path.join(docDir, 'content.json');
  if (fs.existsSync(contentPath)) {
    return JSON.parse(fs.readFileSync(contentPath, 'utf8'));
  }
  const specPath = path.join(docDir, 'chunks.json');
  if (!fs.existsSync(specPath)) return fallback;
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  const size = spec.chunkSize > 0 ? spec.chunkSize : SHIP_BODY_CHUNK_SIZE;
  const n = Math.ceil((spec.unitCount || 0) / size) || 0;
  const units = [];
  for (let i = 0; i < n; i++) {
    const part = JSON.parse(
      fs.readFileSync(path.join(docDir, 'c', `${i}.json`), 'utf8'),
    );
    for (const u of part) units.push(u);
  }
  return units;
}

function parseOut(argv) {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') return argv[i + 1] || '';
  }
  return '';
}

function main() {
  const outPath = parseOut(process.argv.slice(2));
  const man = JSON.parse(
    fs.readFileSync(path.join(CANON, 'manifest.json'), 'utf8'),
  );
  const docs = (man.documents || []).filter(
    (d) => d && d.translationProvenance !== 'ai' && typeof d.id === 'string',
  );
  const lines = [];
  let mismatches = 0;
  let indexMismatches = 0;
  let packed = 0;
  for (const doc of docs) {
    const dir = path.join(CANON, 'documents', doc.id);
    const contentPath = path.join(dir, 'content.json');
    const indexPath = path.join(dir, 'index.json');
    const beforeUnits = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
    const beforeHash = hashUnits(beforeUnits);
    const { output, parsed } = compressJsonBuffer(
      fs.readFileSync(contentPath),
      'content.json',
    );
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dv-parity-'));
    try {
      if (
        Array.isArray(parsed) &&
        parsed.length > SHIP_BODY_CHUNK_SIZE
      ) {
        writeShipChunks(tmp, parsed, { chunkSize: SHIP_BODY_CHUNK_SIZE });
      } else {
        fs.writeFileSync(path.join(tmp, 'content.json'), output);
      }
      const afterUnits = loadShippedUnits(tmp, parsed);
      const afterHash = hashUnits(afterUnits);
      const equal = beforeHash === afterHash && beforeUnits.length === afterUnits.length;
      if (!equal) mismatches += 1;

      let indexEqual = true;
      if (fs.existsSync(indexPath)) {
        const classic = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
        const buf = packIndexBuffer(classic);
        if (buf) {
          packed += 1;
          const back = unpackIndex(JSON.parse(buf.toString('utf8')));
          indexEqual = Boolean(back && sameIndex(classic, back));
        }
        if (!indexEqual) indexMismatches += 1;
      }

      lines.push(
        JSON.stringify({
          id: doc.id,
          units: beforeUnits.length,
          sha256: beforeHash,
          sha256After: afterHash,
          equal,
          indexEqual,
        }),
      );
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
    if (lines.length % 200 === 0) {
      process.stderr.write(`parity ${lines.length}/${docs.length}\n`);
    }
  }

  const body = lines.join('\n') + '\n';
  if (outPath) {
    fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
    fs.writeFileSync(outPath, body);
  }
  const summary = {
    documents: docs.length,
    textMismatches: mismatches,
    indexMismatches,
    indexesPacked: packed,
    out: outPath || null,
  };
  console.log(JSON.stringify(summary));
  if (mismatches || indexMismatches) process.exit(1);
}

main();
