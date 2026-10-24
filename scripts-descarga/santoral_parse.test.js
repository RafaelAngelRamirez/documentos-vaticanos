/**
 * Real parse tests: fixture HTML/JSON/RSS → shipped parsers.
 *
 * Run:
 *   node --experimental-strip-types scripts-descarga/santoral_parse.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const HERE = __dirname;
const FIXTURE_LIT = path.join(
  HERE,
  'fixtures/santoral/ns_lit_doc_19840311_frassinetti_sp.html',
);
const FIXTURE_VN = path.join(HERE, 'fixtures/santoral/vn_07_18.saints.js');
const FIXTURE_VN_EMPTY = path.join(HERE, 'fixtures/santoral/vn_empty.saints.js');
const FIXTURE_RSS = path.join(HERE, 'fixtures/santoral/vaticanstate_santo.rss.xml');
const FIXTURE_ITEM = path.join(
  HERE,
  'fixtures/santoral/vaticanstate_bruno_segni.html',
);
const FIXTURE_404 = path.join(HERE, 'fixtures/santoral/empty_404.html');
const PARSE_TS = path.join(HERE, 'src/santoral/parse_saint_bio.ts');
const HOLY_TS = path.join(HERE, 'src/santoral/parse_holy_see_sources.ts');
const SOURCE_URL =
  'https://www.vatican.va/news_services/liturgy/saints/ns_lit_doc_19840311_frassinetti_sp.html';
const BRUNO_URL =
  'https://www.vaticanstate.va/es/estado-y-gobierno/notas-generales/santo-del-dia/2287-18-de-julio-san-bruno-de-segni-obispo.html';

async function main() {
  assert.ok(fs.existsSync(FIXTURE_LIT), `missing fixture ${FIXTURE_LIT}`);
  assert.ok(fs.existsSync(FIXTURE_VN), `missing ${FIXTURE_VN}`);
  assert.ok(fs.existsSync(FIXTURE_RSS), `missing ${FIXTURE_RSS}`);
  assert.ok(fs.existsSync(FIXTURE_ITEM), `missing ${FIXTURE_ITEM}`);
  assert.ok(fs.existsSync(PARSE_TS), `missing ${PARSE_TS}`);
  assert.ok(fs.existsSync(HOLY_TS), `missing ${HOLY_TS}`);

  const mod = await import(pathToFileURL(PARSE_TS).href + `?t=${Date.now()}`);
  const holy = await import(pathToFileURL(HOLY_TS).href + `?t=${Date.now()}`);

  // --- liturgy / vatican.va bio ---
  const html = fs.readFileSync(FIXTURE_LIT, 'utf8');
  const parsed = mod.parseSaintBioHtml(html, SOURCE_URL);

  assert.ok(parsed.name && parsed.name.length > 0, 'name non-empty');
  assert.ok(
    /Frassinetti/i.test(parsed.name),
    `expected Frassinetti in name, got ${parsed.name}`,
  );
  assert.ok(parsed.bio && parsed.bio.length > 100, `bio too short: ${parsed.bio.length}`);
  assert.ok(
    /Paula|bautismo|Génova|Genova|Dorotea/i.test(parsed.bio),
    'bio should contain life content',
  );
  assert.strictEqual(parsed.sourceUrl, SOURCE_URL);
  assert.ok(parsed.years, 'years from title');
  assert.strictEqual(parsed.locale, 'es');

  const slug = mod.slugifySaintId(parsed.name, SOURCE_URL);
  assert.ok(slug.includes('frassinetti') || slug.includes('paula'));

  const empty = mod.parseSaintBioHtml(
    '<html><title>404 Resource</title></html>',
    SOURCE_URL,
  );
  assert.strictEqual(empty.bio, '');
  assert.strictEqual(empty.sourceUrl, SOURCE_URL);

  // --- feast day helper ---
  assert.strictEqual(holy.parseFeastDayEs('18 de julio: San Bruno'), '07-18');
  assert.strictEqual(holy.parseFeastDayEs('/es/santos/07/18.saints.js'), '07-18');
  assert.strictEqual(holy.parseFeastDayEs('1 de enero: María'), '01-01');

  // --- Vatican News .saints.js ---
  const vnText = fs.readFileSync(FIXTURE_VN, 'utf8');
  const vn = holy.parseVaticanNewsSaintsJs(
    vnText,
    '/es/santos/07/18.saints.js',
    'https://www.vaticannews.va',
  );
  assert.ok(vn.length >= 2, `expected ≥2 vn saints, got ${vn.length}`);
  const brunoVn = vn.find((s) => /Bruno/i.test(s.name) || /Bruno/i.test(s.displayName || ''));
  assert.ok(brunoVn, 'Bruno de Segni in vn fixture');
  assert.ok(/Bruno/i.test(brunoVn.name), `vn name ${brunoVn.name}`);
  assert.ok(brunoVn.bio.length > 40, 'vn bio');
  assert.ok(
    /Segni|Eucaristía|Eucaristia|Montecassino|simonía|simonia/i.test(brunoVn.bio),
    'vn bio content',
  );
  assert.ok(
    /vaticannews\.va/i.test(brunoVn.sourceUrl),
    `vn sourceUrl ${brunoVn.sourceUrl}`,
  );
  assert.deepStrictEqual(brunoVn.feastDays, ['07-18']);
  assert.strictEqual(brunoVn.locale, 'es');

  const vnEmpty = holy.parseVaticanNewsSaintsJs(
    fs.readFileSync(FIXTURE_VN_EMPTY, 'utf8'),
    '/es/santos/01/01.saints.js',
  );
  assert.strictEqual(vnEmpty.length, 0, 'empty saints.js invents nothing');

  const vn404 = holy.parseVaticanNewsSaintsJs(
    '<html><title>404 Resource</title></html>',
    '/es/santos/01/01.saints.js',
  );
  assert.strictEqual(vn404.length, 0);

  // --- vaticanstate RSS ---
  const rssRows = holy.parseVaticanStateRss(fs.readFileSync(FIXTURE_RSS, 'utf8'));
  assert.ok(rssRows.length >= 1, 'rss ≥1');
  const brunoRss = rssRows.find((s) => /Bruno/i.test(s.name));
  assert.ok(brunoRss, 'Bruno in RSS');
  assert.ok(/Bruno/i.test(brunoRss.name));
  assert.ok(brunoRss.bio.length >= 40);
  assert.ok(
    /Solero|Benedictinos|Bolonia|Segni/i.test(brunoRss.bio),
    'rss bio content',
  );
  assert.ok(/vaticanstate\.va/i.test(brunoRss.sourceUrl));
  assert.deepStrictEqual(brunoRss.feastDays, ['07-18']);

  const rssEmpty = holy.parseVaticanStateRss('<rss><channel></channel></rss>');
  assert.strictEqual(rssEmpty.length, 0);

  // --- vaticanstate item HTML ---
  const item = holy.parseVaticanStateItemHtml(
    fs.readFileSync(FIXTURE_ITEM, 'utf8'),
    BRUNO_URL,
  );
  assert.ok(item, 'item parse');
  assert.ok(/Bruno/i.test(item.name), `item name ${item.name}`);
  assert.ok(item.bio.length > 200, `item bio len ${item.bio.length}`);
  assert.ok(
    /Gregorio VII|Clermont|1123|canoniz/i.test(item.bio) ||
      /Segni|Solero|investidura/i.test(item.bio),
    'item bio historical content',
  );
  assert.strictEqual(item.sourceUrl, BRUNO_URL);
  assert.deepStrictEqual(item.feastDays, ['07-18']);

  const item404 = holy.parseVaticanStateItemHtml(
    fs.readFileSync(FIXTURE_404, 'utf8'),
    BRUNO_URL,
  );
  assert.strictEqual(item404, null, '404 invents no saint');

  console.log('ok santoral-parse');
  console.log(
    JSON.stringify({
      liturgy: {
        name: parsed.name,
        years: parsed.years,
        bioLen: parsed.bio.length,
        slug,
      },
      vaticanNews: {
        count: vn.length,
        bruno: brunoVn.name,
        bioLen: brunoVn.bio.length,
        feastDays: brunoVn.feastDays,
        sourceUrl: brunoVn.sourceUrl,
      },
      vaticanstateRss: {
        count: rssRows.length,
        bruno: brunoRss.name,
        bioLen: brunoRss.bio.length,
      },
      vaticanstateItem: {
        name: item.name,
        bioLen: item.bio.length,
        feastDays: item.feastDays,
      },
    }),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
