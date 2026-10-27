#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { execFileSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const sources = require(path.join(ROOT, 'scripts-descarga/config/sources.json'));

const expected = {
  'spiritus-paraclitus': {
    corpusDocId: 'spiritus-paraclitus-es',
    adapter: 'generic_numbered',
    locale: 'es',
  },
  'qui-pluribus': {
    corpusDocId: 'qui-pluribus-it',
    adapter: 'vatican_prose',
    locale: 'it',
  },
  'nostis-et-nobiscum': {
    corpusDocId: 'nostis-et-nobiscum-it',
    adapter: 'vatican_prose',
    locale: 'it',
  },
};

const byId = new Map(sources.sources.map((source) => [source.id, source]));
for (const [id, want] of Object.entries(expected)) {
  const source = byId.get(id);
  assert.ok(source, `missing source ${id}`);
  assert.strictEqual(source.packaging, 'on-demand', id);
  assert.strictEqual(source.adapter, want.adapter, id);
  assert.strictEqual(source.locale, want.locale, id);
  assert.strictEqual(source.corpusDocId, want.corpusDocId, id);
  assert.ok(source.seedUrls[0].startsWith('https://www.vatican.va/'), id);
  assert.strictEqual(source.translationProvenance, 'official', id);
}

const listed = execFileSync(process.execPath, [path.join(ROOT, 'scripts/ship-exclude-ids.js')], {
  encoding: 'utf8',
})
  .trim()
  .split('\n')
  .filter(Boolean);

for (const want of Object.values(expected)) {
  assert.ok(listed.includes(want.corpusDocId), want.corpusDocId);
}

console.log('on-demand sources ok', listed.join(', '));
