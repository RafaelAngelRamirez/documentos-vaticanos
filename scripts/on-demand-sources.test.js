#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { execFileSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const sources = require(path.join(ROOT, 'scripts-descarga/config/sources.json'));

const expected = {
  'spiritus-paraclitus': 'spiritus-paraclitus-es',
  'qui-pluribus': 'qui-pluribus-it',
  'nostis-et-nobiscum': 'nostis-et-nobiscum-it',
};

const byId = new Map(sources.sources.map((source) => [source.id, source]));
for (const [id, corpusDocId] of Object.entries(expected)) {
  const source = byId.get(id);
  assert.ok(source, `missing source ${id}`);
  assert.strictEqual(source.packaging, 'on-demand', id);
  assert.strictEqual(source.corpusDocId, corpusDocId, id);
}

const listed = execFileSync(process.execPath, [path.join(ROOT, 'scripts/ship-exclude-ids.js')], {
  encoding: 'utf8',
})
  .trim()
  .split('\n')
  .filter(Boolean);

for (const corpusDocId of Object.values(expected)) {
  assert.ok(listed.includes(corpusDocId), corpusDocId);
}

console.log('on-demand sources ok', listed.join(', '));
