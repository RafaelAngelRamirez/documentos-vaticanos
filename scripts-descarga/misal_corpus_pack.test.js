/**
 * Dual-written corpus packs for Missal-related docs.
 * Asserts manifest + content.json under both corpus roots.
 *
 * Run: node scripts-descarga/misal_corpus_pack.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const ROOTS = [
  path.join(REPO, 'documentos/corpus'),
  path.join(REPO, 'frontend/src/assets/corpus'),
];

const PACKS = [
  'igmr-es',
  'igmr-en',
  'igmr-it',
  'igmr-fr',
  'missale-romanum-apc-en',
  'missale-romanum-apc-it',
  'missale-romanum-apc-pt',
  'missale-romanum-apc-de',
  'missale-romanum-apc-la',
];

function main() {
  for (const root of ROOTS) {
    const manifestPath = path.join(root, 'manifest.json');
    assert.ok(fs.existsSync(manifestPath), `manifest at ${root}`);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const docs = manifest.documents || [];
    const byId = Object.fromEntries(docs.map((d) => [d.id, d]));

    // rm-es remains Redemptoris Missio — no collision
    if (byId['rm-es']) {
      assert.ok(
        /Redemptoris|misión|missio/i.test(byId['rm-es'].title || ''),
        'rm-es still Redemptoris Missio',
      );
    }

    for (const id of PACKS) {
      const meta = byId[id];
      assert.ok(meta, `${id} in manifest ${root}`);
      assert.ok(meta.unitCount > 0, `${id} unitCount > 0`);
      assert.ok(meta.sourceUrl, `${id} sourceUrl`);
      assert.ok(meta.locale, `${id} locale`);
      assert.ok(meta.title && meta.title.length > 5, `${id} full title`);
      assert.notStrictEqual(id, 'rm-es');

      const contentPath = path.join(root, 'documents', id, 'content.json');
      assert.ok(fs.existsSync(contentPath), `content.json ${id} @ ${root}`);
      const units = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
      assert.ok(Array.isArray(units) && units.length > 0, `${id} units array`);
      assert.strictEqual(
        units.length,
        meta.unitCount,
        `${id} unitCount matches content length`,
      );
      assert.ok(units[0].consecutivo != null, `${id} has consecutivo`);
      assert.ok(
        (units[0].contenido || '').trim().length > 10,
        `${id} unit prose`,
      );

      // Ordinary DocumentMeta path — no special storage keys
      assert.ok(meta.bodyPath, `${id} bodyPath`);
      assert.ok(meta.indexPath, `${id} indexPath`);
      console.log(`ok pack ${id} units=${units.length} @ ${path.basename(path.dirname(root))}/${path.basename(root)}`);
    }
  }

  console.log(JSON.stringify({ ok: true, packs: PACKS, roots: ROOTS.length }));
}

main();
