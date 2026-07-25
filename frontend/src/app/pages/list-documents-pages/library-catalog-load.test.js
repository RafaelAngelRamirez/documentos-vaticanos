/**
 * Biblioteca must list from manifest/catalog only — no bulk body load.
 * Also asserts lector chrome has no multi-locale language switcher.
 *
 * Run from frontend/:
 *   bash ../scripts/node-strip-types.sh src/app/pages/list-documents-pages/library-catalog-load.test.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const HERE = __dirname;
const ROOT = path.resolve(HERE, '../../../..');
const LIST_TS = path.join(HERE, 'list-documents-pages.component.ts');
const LECTOR_HTML = path.resolve(
  HERE,
  '../../components/lector/lector.component.html',
);
const LECTOR_TS = path.resolve(
  HERE,
  '../../components/lector/lector.component.ts',
);
const LECTOR_CSS = path.resolve(
  HERE,
  '../../components/lector/lector.component.css',
);
const MANIFEST = path.resolve(ROOT, 'src/assets/corpus/manifest.json');
const LOCALE_LOGIC = path.resolve(
  HERE,
  '../../core/corpus/document-locale.logic.ts',
);

async function main() {
  const listSrc = fs.readFileSync(LIST_TS, 'utf8');
  assert.ok(
    !/\bensureAllLoaded\b/.test(listSrc),
    'Biblioteca must not call ensureAllLoaded (bulk body load)',
  );
  assert.ok(
    /\bloadManifest\b/.test(listSrc),
    'Biblioteca must load manifest for catalog metas',
  );
  assert.ok(
    /\blistCatalogDocuments\b/.test(listSrc),
    'Biblioteca must list via listCatalogDocuments (preferred editions)',
  );
  assert.ok(
    !/\bCargarDocumentosJsonService\b/.test(listSrc),
    'Biblioteca catalog no longer depends on body facade for listing',
  );

  for (const [label, file] of [
    ['lector.html', LECTOR_HTML],
    ['lector.ts', LECTOR_TS],
    ['lector.css', LECTOR_CSS],
  ]) {
    const src = fs.readFileSync(file, 'utf8');
    assert.ok(
      !/lang-pills|languageEditions|showLanguageSwitcher|switchLanguage/.test(
        src,
      ),
      `${label} must not contain language switcher chrome`,
    );
  }

  // Catalog is buildable from manifest metas alone (shipped pure function).
  const L = await import(
    pathToFileURL(LOCALE_LOGIC).href + `?t=${Date.now()}`
  );
  assert.ok(fs.existsSync(MANIFEST), 'corpus manifest must exist');
  const man = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const metas = man.documents || [];
  assert.ok(metas.length > 10, `expected many metas, got ${metas.length}`);
  const catalog = L.listPreferredEditions(metas, 'es');
  assert.ok(
    catalog.length > 0 && catalog.length < metas.length,
    `catalog collapse ${metas.length} → ${catalog.length}`,
  );
  // No body fields required — only DocumentMeta shape.
  for (const m of catalog.slice(0, 5)) {
    assert.ok(m.id, 'catalog row has id');
    assert.ok(m.title || m.shortTitle, 'catalog row has title');
  }

  console.log(
    `OK: library-catalog-load (manifest ${metas.length} → catalog ${catalog.length}; lector switcher absent)`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
