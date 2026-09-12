/**
 * Progressive / locale-scoped search load helpers + structural gates for PR2a.
 *
 * Run from frontend/:
 *   bash ../scripts/node-strip-types.sh src/app/core/search/search-load.logic.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { register } = require('node:module');

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      export async function resolve(specifier, context, nextResolve) {
        if (
          (specifier.startsWith('./') || specifier.startsWith('../')) &&
          !/\\.(ts|js|mjs|cjs|json|node)$/i.test(specifier)
        ) {
          try {
            return await nextResolve(specifier + '.ts', context);
          } catch {}
        }
        return nextResolve(specifier, context);
      }
    `),
  pathToFileURL(__filename),
);

const HERE = __dirname;
const BUSCADOR_TS = path.resolve(
  HERE,
  '../../components/buscador/buscador.component.ts',
);
const RELATED_TS = path.resolve(
  HERE,
  '../../components/related-units/related-units-panel.component.ts',
);
const CARGAR_TS = path.resolve(
  HERE,
  '../../../app/services/cargar-documentos-json.service.ts',
);
const SEARCH_MANIFEST = path.resolve(
  HERE,
  '../../../assets/corpus/search/search-manifest.json',
);
const TOPIC_MODELS = path.join(HERE, 'topic-pack.models.ts');
const TOPIC_SERVICE = path.join(HERE, 'topic-index.service.ts');

function section(name) {
  console.log(`\n== ${name} ==`);
}

async function main() {
  section('search-load pure helpers');
  const L = await import(
    pathToFileURL(path.join(HERE, 'search-load.logic.ts')).href +
      `?t=${Date.now()}`
  );

  const metas = [
    { id: 'cic-es', locale: 'es', kind: 'catechism', unitCount: 2800 },
    { id: 'cic-en', locale: 'en', kind: 'catechism', unitCount: 2800 },
    { id: 'lg-es', locale: 'es', kind: 'magisterium', unitCount: 100 },
    { id: 'agustin-02-confesiones-es', locale: 'es', kind: 'patristic', unitCount: 9000 },
    { id: 'nicea-i-la', locale: 'la', kind: 'council', unitCount: 20 },
    {
      id: 'ca-en',
      locale: 'en',
      kind: 'magisterium',
      unitCount: 50,
      translationProvenance: 'official',
    },
    {
      id: 'ca-en-ai',
      locale: 'en',
      kind: 'magisterium',
      unitCount: 50,
      translationProvenance: 'ai',
    },
  ];

  const esOnly = L.metasForSearchLocale(metas, 'es', false);
  assert.strictEqual(esOnly.length, 3, 'es locale filters 3 packs');
  assert.ok(esOnly.every((m) => m.locale === 'es'));

  const enOnly = L.metasForSearchLocale(metas, 'en', false);
  assert.ok(enOnly.some((m) => m.id === 'cic-en'));
  assert.ok(enOnly.some((m) => m.id === 'ca-en'), 'en search prefers official ca-en');
  assert.ok(
    !enOnly.some((m) => m.id === 'ca-en-ai'),
    'en search drops AI sibling of official pack',
  );

  const all = L.metasForSearchLocale(metas, 'es', true);
  assert.ok(all.some((m) => m.id === 'nicea-i-la'));
  assert.ok(all.some((m) => m.id === 'ca-en'));
  assert.ok(
    !all.some((m) => m.id === 'ca-en-ai'),
    'allLocales still drops AI sibling when official exists',
  );
  assert.strictEqual(all.length, 6, 'allLocales is 6 after collapsing ca-en-ai');

  const hubs = L.pickRelatedHubMetas(metas, 'es', 40, false);
  assert.ok(
    hubs.every((m) => m.locale === 'es'),
    'hubs stay in locale',
  );
  assert.ok(
    hubs.some((m) => m.id === 'cic-es'),
    'includes catechism hub',
  );
  assert.ok(
    hubs.some((m) => m.id === 'lg-es'),
    'includes magisterium hub',
  );
  // Cap: with max 2 only hubs preferred
  const hubs2 = L.pickRelatedHubMetas(metas, 'es', 2, false);
  assert.strictEqual(hubs2.length, 2);
  assert.ok(
    hubs2.every((m) => L.SEARCH_HUB_KINDS.has(m.kind)),
    'first slots prefer hub kinds when enough hubs exist',
  );

  section('mapPool concurrency + cancel');
  const order = [];
  let active = 0;
  let maxActive = 0;
  const items = [1, 2, 3, 4, 5, 6];
  const out = await L.mapPool(
    items,
    2,
    async (n) => {
      active++;
      maxActive = Math.max(maxActive, active);
      order.push(n);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return n * 10;
    },
  );
  assert.deepStrictEqual(out, [10, 20, 30, 40, 50, 60]);
  assert.ok(maxActive <= 2, `concurrency cap, got maxActive=${maxActive}`);

  let cancelled = false;
  const partial = await L.mapPool(
    [1, 2, 3, 4, 5, 6, 7, 8],
    2,
    async (n) => {
      if (n >= 3) cancelled = true;
      await new Promise((r) => setTimeout(r, 2));
      return n;
    },
    () => cancelled,
  );
  // Some slots may still finish after cancel; length may be sparse — ensure no throw
  assert.ok(Array.isArray(partial));

  section('PR2a: buscar/related must not call ensureAllLoaded');
  const buscadorSrc = fs.readFileSync(BUSCADOR_TS, 'utf8');
  const relatedSrc = fs.readFileSync(RELATED_TS, 'utf8');
  const cargarSrc = fs.readFileSync(CARGAR_TS, 'utf8');
  assert.ok(
    !/\bensureAllLoaded\b/.test(buscadorSrc),
    'buscador must not call ensureAllLoaded',
  );
  assert.ok(
    /\bensureIndexForLocale\b/.test(buscadorSrc),
    'buscador must use ensureIndexForLocale (PR2b)',
  );
  assert.ok(
    /\bensureLoadedMany\b/.test(buscadorSrc),
    'buscador must hydrate snippets via ensureLoadedMany',
  );
  assert.ok(
    !/\bensureAllLoaded\b/.test(relatedSrc),
    'related-units must not call ensureAllLoaded',
  );
  assert.ok(
    /\bensureLoadedRelatedPool\b/.test(relatedSrc),
    'related-units must use ensureLoadedRelatedPool',
  );
  assert.ok(
    /\bensureLoadedForLocale\b/.test(cargarSrc),
    'facade exposes ensureLoadedForLocale',
  );
  assert.ok(
    /@deprecated/.test(cargarSrc) && /\bensureAllLoaded\b/.test(cargarSrc),
    'ensureAllLoaded remains but marked deprecated',
  );

  section('PR1: topic pack scaffold + service files exist');
  assert.ok(fs.existsSync(SEARCH_MANIFEST), 'search-manifest.json shipped');
  const man = JSON.parse(fs.readFileSync(SEARCH_MANIFEST, 'utf8'));
  assert.ok(man.locales && man.locales.es, 'root manifest lists es');
  assert.ok(fs.existsSync(TOPIC_MODELS), 'topic-pack.models.ts');
  assert.ok(fs.existsSync(TOPIC_SERVICE), 'topic-index.service.ts');

  // topic-search.logic uses Angular-friendly extensionless imports; load via
  // require after strip-types (same pattern as semantic-search tests).
  const T = require('./topic-search.logic.ts');
  const boosted = T.boostHitsWithTopics(
    [
      {
        documentId: 'cic-es',
        unitIndex: 1,
        score: 1,
        matchedTerms: [],
        highlightTerms: [],
      },
      {
        documentId: 'cic-es',
        unitIndex: 2,
        score: 1,
        matchedTerms: [],
        highlightTerms: [],
      },
    ],
    new Map([['topic:es:gracia', new Set(['cic-es:1'])]]),
    ['topic:es:gracia'],
    undefined,
    0.25,
  );
  assert.ok(
    boosted[0].score > boosted[1].score,
    'membership boost raises score',
  );

  console.log('\nAll search-load / PR1–PR2a structural tests passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
