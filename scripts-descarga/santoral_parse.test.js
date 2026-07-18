/**
 * Real parse tests: fixture HTML → shipped parseSaintBioHtml.
 *
 * Run:
 *   node --experimental-strip-types scripts-descarga/santoral_parse.test.js
 *   (or from scripts-descarga with npx ts-node if strip-types unavailable)
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const HERE = __dirname;
const FIXTURE = path.join(
  HERE,
  'fixtures/santoral/ns_lit_doc_19840311_frassinetti_sp.html',
);
const PARSE_TS = path.join(HERE, 'src/santoral/parse_saint_bio.ts');
const SOURCE_URL =
  'https://www.vatican.va/news_services/liturgy/saints/ns_lit_doc_19840311_frassinetti_sp.html';

async function main() {
  assert.ok(fs.existsSync(FIXTURE), `missing fixture ${FIXTURE}`);
  assert.ok(fs.existsSync(PARSE_TS), `missing ${PARSE_TS}`);

  const mod = await import(pathToFileURL(PARSE_TS).href + `?t=${Date.now()}`);
  const html = fs.readFileSync(FIXTURE, 'utf8');
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

  // 404 shape
  const empty = mod.parseSaintBioHtml(
    '<html><title>404 Resource</title></html>',
    SOURCE_URL,
  );
  assert.strictEqual(empty.bio, '');
  assert.strictEqual(empty.sourceUrl, SOURCE_URL);

  console.log('ok santoral-parse');
  console.log(
    JSON.stringify({
      name: parsed.name,
      years: parsed.years,
      bioLen: parsed.bio.length,
      sourceUrl: parsed.sourceUrl,
      slug,
    }),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
