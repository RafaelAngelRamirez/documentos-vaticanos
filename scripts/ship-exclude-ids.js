#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function sourcesPath() {
  return (
    process.env.SHIP_SOURCES ||
    path.join(__dirname, '..', 'scripts-descarga', 'config', 'sources.json')
  );
}

function onDemandIds(file = require(sourcesPath())) {
  const ids = [];
  for (const source of file.sources || []) {
    if (source.packaging === 'on-demand' && source.corpusDocId) {
      ids.push(source.corpusDocId);
    }
  }
  return ids;
}

function filterManifest(manifest, ids) {
  const drop = new Set(ids);
  const documents = Array.isArray(manifest.documents) ? manifest.documents : [];
  manifest.documents = documents.filter((doc) => !drop.has(doc.id));
  return manifest;
}

function main() {
  const ids = onDemandIds();
  if (process.argv[2] === '--filter-manifest') {
    const manifestPath = process.argv[3];
    if (!manifestPath || !fs.existsSync(manifestPath)) {
      process.exit(manifestPath ? 0 : 1);
    }
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const before = Array.isArray(manifest.documents) ? manifest.documents.length : 0;
    filterManifest(manifest, ids);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    process.stderr.write(
      `ship manifest ${before} → ${manifest.documents.length} (on-demand left out)\n`,
    );
    return;
  }
  for (const id of ids) process.stdout.write(`${id}\n`);
}

if (require.main === module) main();

module.exports = { onDemandIds, filterManifest };
