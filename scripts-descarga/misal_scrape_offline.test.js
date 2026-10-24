/**
 * Offline scrape path for Missal-related vatican.va sources (IGMR + APC).
 * Drives real scrape_source CLI + adapters (not a re-implementation).
 *
 * Run: node scripts-descarga/misal_scrape_offline.test.js
 */
const assert = require('assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname);
const SOURCES = path.join(ROOT, 'config/sources.json');
const INVENTORY = path.join(ROOT, 'config/missal-vatican-inventory.json');

const IGMR = ['igmr-es', 'igmr-en', 'igmr-it', 'igmr-fr'];
const APC = [
  'missale-romanum-apc-en',
  'missale-romanum-apc-it',
  'missale-romanum-apc-pt',
  'missale-romanum-apc-de',
  'missale-romanum-apc-la',
];

function loadSources() {
  const data = JSON.parse(fs.readFileSync(SOURCES, 'utf8'));
  return data.sources || [];
}

function main() {
  assert.ok(fs.existsSync(INVENTORY), 'missal-vatican-inventory.json present');
  const inv = JSON.parse(fs.readFileSync(INVENTORY, 'utf8'));
  assert.ok(inv.igmr?.html?.es, 'inventory has IGMR ES url');
  assert.ok(inv.igmr?.html?.en, 'inventory has IGMR EN url');
  assert.ok(
    inv.missaleRomanum1969Apc?.withBody?.en,
    'inventory has APC EN with body',
  );
  assert.ok(
    inv.missaleRomanum1969Apc?.shellEmptyNoBody?.es,
    'inventory records empty ES APC shell (honesty)',
  );

  const sources = loadSources();
  const byId = Object.fromEntries(sources.map((s) => [s.id, s]));

  for (const id of [...IGMR, ...APC]) {
    const s = byId[id];
    assert.ok(s, `source registered: ${id}`);
    assert.ok(s.seedUrls?.[0], `${id} has sourceUrl`);
    assert.ok(s.fixturePath, `${id} has fixturePath`);
    const fix = path.join(ROOT, s.fixturePath);
    assert.ok(fs.existsSync(fix), `fixture exists: ${s.fixturePath}`);
    assert.notStrictEqual(
      s.corpusDocId,
      'rm-es',
      'must not collide with Redemptoris Missio',
    );
    assert.ok(
      !s.corpusDocId.startsWith('rm-') || s.corpusDocId.startsWith('missale'),
      `safe id ${s.corpusDocId}`,
    );
  }

  // Offline parse via real CLI (skip write)
  for (const id of [...IGMR, ...APC]) {
    const out = execFileSync(
      'npx',
      [
        'ts-node',
        '--transpile-only',
        'scrape_source.ts',
        '--source',
        id,
        '--offline',
        '--skip-write',
      ],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 },
    );
    const m = out.match(/final units:\s*(\d+)/i);
    assert.ok(m, `parsed units line for ${id}: ${out.slice(-400)}`);
    const n = parseInt(m[1], 10);
    assert.ok(n > 0, `${id} unitCount > 0 (got ${n})`);
    const expected = byId[id].expectedUnitCount;
    if (expected) {
      assert.ok(
        n >= Math.floor(expected * 0.8),
        `${id} units ${n} >= 80% of expected ${expected}`,
      );
    }
    assert.ok(
      /fixture/i.test(out),
      `${id} used offline fixture`,
    );
    console.log(`ok scrape offline ${id} units=${n}`);
  }

  // Product locales honesty: hi/zh/ar not faked as official packs
  for (const loc of ['hi', 'zh', 'ar']) {
    assert.ok(
      !byId[`igmr-${loc}`],
      `no fake igmr-${loc} source`,
    );
    assert.ok(
      !byId[`missale-romanum-apc-${loc}`],
      `no fake missale-romanum-apc-${loc} source`,
    );
  }

  console.log(
    JSON.stringify({
      ok: true,
      igmr: IGMR,
      apc: APC,
      inventory: true,
    }),
  );
}

main();
