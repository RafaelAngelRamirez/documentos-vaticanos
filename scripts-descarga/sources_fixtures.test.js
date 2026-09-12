/**
 * Offline scrape fixtures referenced by config/sources.json must exist.
 * Run: node sources_fixtures.test.js
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const sourcesPath = path.join(HERE, 'config', 'sources.json');
const sourcesFile = JSON.parse(fs.readFileSync(sourcesPath, 'utf8'));
const sourceList = Array.isArray(sourcesFile.sources) ? sourcesFile.sources : [];

let fixtureCount = 0;
for (const src of sourceList) {
  const rel = src && src.fixturePath;
  if (!rel) continue;
  const abs = path.isAbsolute(rel) ? rel : path.join(HERE, rel);
  assert.ok(
    fs.existsSync(abs),
    `missing scrape fixture for ${src.id}: ${rel}`,
  );
  fixtureCount += 1;
}
assert.ok(fixtureCount >= 1, 'expected at least one fixturePath');

const sca = sourceList.find((s) => s && s.id === 'sca');
assert.ok(sca && sca.fixturePath, 'sources.json id=sca has fixturePath');
assert.ok(
  fs.existsSync(path.join(HERE, sca.fixturePath)),
  'Sacramentum caritatis offline fixture (fixtures/sca-es/source.html) must be shipped',
);

console.log(`sources_fixtures.test.js: ok (${fixtureCount} fixturePath files, incl. sca-es)`);
