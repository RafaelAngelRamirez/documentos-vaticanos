/**
 * Offline gate: Spanish Psalms verse counts and completeness vs frozen ESL0506
 * fixtures (not live network). Proves the pack no longer drops continuation lines.
 *
 * Cheap CI has no scripts-descarga node_modules — no linkedom. Run via:
 *   bash scripts/node-strip-types.sh scripts-descarga/psalms_es_verse_counts.test.js
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const HERE = __dirname;
const REPO = path.resolve(HERE, '..');
const FIXTURE = path.join(HERE, 'fixtures', 'psalms-es');
const COUNTS_PATH = path.join(FIXTURE, 'expected_verse_counts.json');
const CONTENT_PATH = path.join(
  REPO,
  'documentos/corpus/documents/bible-pueblo-de-dios-es/content.json',
);
const PARSE_TS = path.join(HERE, 'src/bible/psalm_verse_parse.ts');

const ENTITIES = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  ntilde: 'ñ',
  Ntilde: 'Ñ',
  aacute: 'á',
  eacute: 'é',
  iacute: 'í',
  oacute: 'ó',
  uacute: 'ú',
  Aacute: 'Á',
  Eacute: 'É',
  Iacute: 'Í',
  Oacute: 'Ó',
  Uacute: 'Ú',
  uuml: 'ü',
  Uuml: 'Ü',
  iquest: '¿',
  iexcl: '¡',
  laquo: '«',
  raquo: '»',
  mdash: '—',
  ndash: '–',
};

function decodeEntities(raw) {
  return String(raw || '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) =>
      String.fromCharCode(parseInt(h, 16)),
    )
    .replace(/&([a-zA-Z]+);/g, (m, name) =>
      Object.prototype.hasOwnProperty.call(ENTITIES, name)
        ? ENTITIES[name]
        : m,
    );
}

/** Zero-dep extract of p.MsoNormal text (same nodes the ESL0506 scraper reads). */
function msoNormalParagraphs(html) {
  const paras = [];
  const re = /<p\s+class=["']?MsoNormal["']?[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = re.exec(html))) {
    const t = decodeEntities(m[1].replace(/<[^>]+>/g, ' '))
      .replace(/\s+/g, ' ')
      .trim();
    if (t) paras.push(t);
  }
  return paras;
}

function loadCounts() {
  assert.ok(fs.existsSync(COUNTS_PATH), `missing ${COUNTS_PATH}`);
  return JSON.parse(fs.readFileSync(COUNTS_PATH, 'utf8'));
}

function corpusPsalmCounts(units) {
  /** @type {Record<string, number>} */
  const counts = {};
  /** @type {Record<string, string[]>} */
  const texts = {};
  for (const u of units) {
    const b = u.biblia || {};
    if (String(b.libro || '').toLowerCase() !== 'salmos') continue;
    const ch = String(b.capitulo);
    counts[ch] = (counts[ch] || 0) + 1;
    (texts[ch] || (texts[ch] = [])).push(String(u.contenido || ''));
  }
  return { counts, texts };
}

async function loadParser() {
  assert.ok(fs.existsSync(PARSE_TS), `missing ${PARSE_TS}`);
  return import(pathToFileURL(PARSE_TS).href + `?t=${Date.now()}`);
}

function parseFixtureChapter(parser, htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  return parser.foldPsalmParagraphs(msoNormalParagraphs(html));
}

async function main() {
  const expected = loadCounts();
  assert.strictEqual(expected.chapters, 150, 'fixture chapters');
  assert.ok(expected.counts && typeof expected.counts === 'object');

  assert.ok(fs.existsSync(CONTENT_PATH), `missing ${CONTENT_PATH}`);
  const units = JSON.parse(fs.readFileSync(CONTENT_PATH, 'utf8'));
  assert.ok(Array.isArray(units), 'content.json array');

  const { counts, texts } = corpusPsalmCounts(units);
  const chapterKeys = Object.keys(expected.counts).sort(
    (a, b) => Number(a) - Number(b),
  );
  assert.strictEqual(chapterKeys.length, 150, 'expected 150 psalm chapters');

  let mismatches = 0;
  /** @type {string[]} */
  const bad = [];
  for (const ch of chapterKeys) {
    const want = expected.counts[ch];
    const got = counts[ch] || 0;
    if (got !== want) {
      mismatches += 1;
      bad.push(`Sal ${ch}: corpus=${got} source=${want}`);
    }
  }
  assert.strictEqual(
    mismatches,
    0,
    `verse-count mismatches vs source fixture:\n${bad.slice(0, 20).join('\n')}`,
  );

  const totalGot = Object.values(counts).reduce((a, b) => a + b, 0);
  assert.strictEqual(
    totalGot,
    expected.totalVerses,
    `total salmos verses corpus=${totalGot} source=${expected.totalVerses}`,
  );

  const p23 = (texts['23'] || []).join(' ').toLowerCase();
  assert.ok(
    p23.includes('señor es mi pastor'),
    'Sal 23 must include «El Señor es mi pastor» from ESL0506',
  );
  assert.ok(
    p23.includes('nada me puede faltar'),
    'Sal 23 must include «nada me puede faltar» from ESL0506',
  );

  const parser = await loadParser();
  const html22 = path.join(FIXTURE, 'html', '__PGR.HTM');
  const html23 = path.join(FIXTURE, 'html', '__PGS.HTM');
  assert.ok(fs.existsSync(html22), `missing fixture ${html22}`);
  assert.ok(fs.existsSync(html23), `missing fixture ${html23}`);

  const v22 = parseFixtureChapter(parser, html22);
  const v23 = parseFixtureChapter(parser, html23);
  assert.strictEqual(v22.length, expected.counts['22'], 'parse Sal 22 count');
  assert.strictEqual(v23.length, expected.counts['23'], 'parse Sal 23 count');
  assert.ok(
    !v22.some((v) => /^16c\b/i.test(v.contenido)),
    '16c must not become its own verse unit',
  );
  const joined23 = v23.map((v) => v.contenido).join(' ').toLowerCase();
  assert.ok(joined23.includes('señor es mi pastor'));
  assert.ok(joined23.includes('nada me puede faltar'));

  const folded = parser.foldPsalmParagraphs([
    '1 Primero.',
    'continuación',
    '16c y me hunden en el polvo.',
    '2 Segundo.',
  ]);
  assert.strictEqual(folded.length, 2);
  assert.strictEqual(folded[0].versiculo, 1);
  assert.ok(folded[0].contenido.includes('16c y me hunden'));
  assert.strictEqual(folded[1].versiculo, 2);

  console.log(
    'ok psalms_es_verse_counts',
    JSON.stringify({
      chapters: 150,
      totalVerses: totalGot,
      psalm23Units: counts['23'],
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
