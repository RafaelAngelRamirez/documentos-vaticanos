#!/usr/bin/env node
'use strict';

const path = require('path');

const sourcesPath =
  process.env.SHIP_SOURCES ||
  path.join(__dirname, '..', 'scripts-descarga', 'config', 'sources.json');
const fs = require('fs');

const file = require(sourcesPath);
const ids = [];
for (const source of file.sources || []) {
  if (source.packaging === 'on-demand' && source.corpusDocId) {
    ids.push(source.corpusDocId);
  }
}

if (process.argv[2] === '--filter-manifest') {
  const manifestPath = process.argv[3];
  if (!manifestPath || !fs.existsSync(manifestPath)) {
    process.exit(manifestPath ? 0 : 1);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const drop = new Set(ids);
  const before = Array.isArray(manifest.documents) ? manifest.documents.length : 0;
  manifest.documents = (manifest.documents || []).filter((doc) => !drop.has(doc.id));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  process.stderr.write(
    `ship manifest ${before} → ${manifest.documents.length} (on-demand left out)\n`,
  );
} else {
  for (const id of ids) {
    process.stdout.write(`${id}\n`);
  }
}
