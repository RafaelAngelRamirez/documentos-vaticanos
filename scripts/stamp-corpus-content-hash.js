/**
 * Stamp DocumentMeta.contentHash (sha256[:12] of content.json) on both
 * corpus manifests so the reader fingerprint invalidates IndexedDB after
 * OCR/text repairs that keep unitCount stable.
 *
 * Usage: node scripts/stamp-corpus-content-hash.js
 */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ROOTS = [
  path.join(ROOT, 'documentos', 'corpus'),
  path.join(ROOT, 'frontend', 'src', 'assets', 'corpus'),
];
const HASH_LEN = 12;

function hashFile(abs) {
  return crypto
    .createHash('sha256')
    .update(fs.readFileSync(abs))
    .digest('hex')
    .slice(0, HASH_LEN);
}

function stampRoot(corpusRoot) {
  const manifestPath = path.join(corpusRoot, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  let changed = 0;
  let missing = 0;
  for (const doc of manifest.documents || []) {
    const body = path.join(corpusRoot, doc.bodyPath);
    if (!fs.existsSync(body)) {
      missing += 1;
      continue;
    }
    const next = hashFile(body);
    if (doc.contentHash !== next) {
      doc.contentHash = next;
      changed += 1;
    }
  }
  manifest.generatedAt = new Date().toISOString();
  fs.writeFileSync(manifestPath, JSON.stringify(manifest), 'utf8');
  return { docs: (manifest.documents || []).length, changed, missing };
}

function main() {
  for (const root of ROOTS) {
    const r = stampRoot(root);
    console.log(
      `${root}: docs=${r.docs} hashed=${r.changed} missing=${r.missing}`
    );
  }
}

main();
