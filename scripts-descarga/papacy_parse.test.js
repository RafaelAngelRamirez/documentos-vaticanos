/**
 * Parse the committed vatican.va holy-father fixture.
 * Run: node papacy_parse.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const HERE = __dirname;
const FIXTURE = path.join(HERE, 'fixtures/papacy/holy-father-es.html');

async function load() {
  const ts = path.join(HERE, 'src/papacy/parse_holy_father_list.ts');
  return import(pathToFileURL(ts).href + `?t=${Date.now()}`);
}

async function main() {
  assert.ok(fs.existsSync(FIXTURE), 'missing holy-father fixture');
  const html = fs.readFileSync(FIXTURE, 'utf8');
  const parse = await load();
  const rows = parse.parseHolyFatherHtml(html);
  assert.ok(rows.length >= 266, `got ${rows.length} popes`);
  assert.strictEqual(rows[0].ordinal, 1);
  assert.strictEqual(rows[0].id, 'pedro');
  assert.ok(/pedro/i.test(rows[0].name));
  const last = rows[rows.length - 1];
  assert.strictEqual(last.ordinal, rows.length);
  assert.ok(
    last.id === 'leon-xiv' || /le[oó]n xiv/i.test(last.name),
    `last pope ${last.id} ${last.name}`,
  );
  const ids = rows.map((r) => r.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'duplicate pope ids');
  const francisco = rows.find((r) => r.id === 'francisco');
  assert.ok(francisco, 'francisco missing');
  assert.strictEqual(francisco.ordinal, 266);
  const jp2 = rows.find((r) => r.id === 'juan-pablo-ii');
  assert.ok(jp2, 'juan-pablo-ii missing');
  const b9 = rows.filter((r) => r.id.startsWith('benedicto-ix'));
  assert.ok(b9.length >= 3, `Benedicto IX reigns: ${b9.map((r) => r.id)}`);
  assert.strictEqual(parse.slugToPopeId('san-pietro'), 'pedro');
  assert.strictEqual(parse.slugToPopeId('francesco'), 'francisco');
  assert.strictEqual(parse.seeForOrdinal(195), 'Aviñón');
  assert.strictEqual(parse.seeForOrdinal(267), 'Roma');
  console.log(`ok — ${rows.length} popes from vatican.va fixture`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
