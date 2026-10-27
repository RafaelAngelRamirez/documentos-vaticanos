/**
 * Install once, verify the content hash, read locally, never over the network.
 *
 *   bash scripts/node-strip-types.sh frontend/src/app/core/corpus/patristic-pack.logic.test.js
 */
const assert = require('assert');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
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
);

const HERE = __dirname;
const REPO = path.resolve(HERE, '../../../../..');

function section(name) {
  console.log(`\n== ${name} ==`);
}

async function load(rel) {
  return import(pathToFileURL(path.join(HERE, rel)).href);
}

function writeDoc(root, id, units, extra) {
  const dir = path.join(root, 'documents', id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'content.json'),
    JSON.stringify(units),
  );
  fs.writeFileSync(
    path.join(dir, 'index.json'),
    JSON.stringify({ indice: { dios: [0] }, indice_por_punto: { 0: 1 } }),
  );
  return extra;
}

async function main() {
  const packLogic = await load('patristic-pack.logic.ts');
  const engineMod = await load('corpus-load.logic.ts');
  const searchMod = await import(
    pathToFileURL(path.join(HERE, '../search/search-load.logic.ts')).href
  );
  const {
    MemoryPackStore,
    filesFromZip,
    installPatristicPack,
    readInstalledPack,
    sourceFromMap,
    assetUrlToPackRel,
  } = packLogic;
  const { CorpusLoadEngine, MemoryCorpusStore, MANIFEST_URL, CORPUS_ROOT } =
    engineMod;
  const { metasForSearchLocale } = searchMod;

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dv-patristic-logic-'));
  try {
    section('zip install checks the hash and then reads offline');
    const canon = path.join(tmp, 'canon');
    const out = path.join(tmp, 'pack');
    fs.mkdirSync(canon, { recursive: true });
    const units = [
      { consecutivo: '1', contenido: 'En el principio' },
      { consecutivo: '2', contenido: 'el Verbo.' },
    ];
    writeDoc(canon, 'padre-es', units);
    writeDoc(canon, 'lg-es', [{ consecutivo: '1', contenido: 'Lumen' }]);
    fs.writeFileSync(
      path.join(canon, 'manifest.json'),
      JSON.stringify({
        version: 1,
        documents: [
          {
            id: 'padre-es',
            title: 'Padre',
            kind: 'patristic',
            locale: 'es',
            bodyPath: 'documents/padre-es/content.json',
            indexPath: 'documents/padre-es/index.json',
            unitCount: 2,
          },
          {
            id: 'lg-es',
            title: 'LG',
            kind: 'magisterium',
            locale: 'es',
            bodyPath: 'documents/lg-es/content.json',
            indexPath: 'documents/lg-es/index.json',
            unitCount: 1,
          },
        ],
      }),
    );
    const built = spawnSync(
      process.execPath,
      [
        path.join(REPO, 'scripts', 'patristic-pack.js'),
        'build',
        '--canonical',
        canon,
        '--out',
        out,
      ],
      { encoding: 'utf8' },
    );
    assert.strictEqual(built.status, 0, built.stderr || built.stdout);
    const zipPath = path.join(tmp, 'patristica.zip');
    const zipped = spawnSync('zip', ['-X', '-r', '-q', zipPath, '.'], {
      cwd: out,
    });
    assert.strictEqual(zipped.status, 0, 'zip');
    const zipBytes = new Uint8Array(fs.readFileSync(zipPath));
    const files = await filesFromZip(zipBytes);
    assert.ok(files.has('manifest.json'));
    assert.ok(files.has('documents/padre-es/content.json'));
    assert.strictEqual(
      assetUrlToPackRel('assets/corpus/documents/padre-es/content.json'),
      'documents/padre-es/content.json',
    );

    const store = new MemoryPackStore();
    const installed = await installPatristicPack(sourceFromMap(files), store);
    assert.strictEqual(installed.ok, true, installed.reason);
    assert.strictEqual(installed.documentCount, 1);
    const opened = await readInstalledPack(store);
    assert.ok(opened);
    assert.strictEqual(opened.documents[0].id, 'padre-es');

    section('a bad hash does not replace the installed pack');
    const badFiles = new Map(files);
    const body = Buffer.from(badFiles.get('documents/padre-es/content.json'));
    body[0] = body[0] ^ 0xff;
    badFiles.set('documents/padre-es/content.json', new Uint8Array(body));
    const refused = await installPatristicPack(sourceFromMap(badFiles), store);
    assert.strictEqual(refused.ok, false);
    assert.ok(refused.reason.includes('hash') || refused.reason.includes('coincide'));
    const still = await readInstalledPack(store);
    assert.strictEqual(still.documents[0].id, 'padre-es');
    const stillBody = await store.read('documents/padre-es/content.json');
    assert.ok(stillBody);
    assert.notStrictEqual(stillBody[0], body[0]);

    section('search and reading use the pack and do not ask the network');
    const urls = [];
    const httpGet = async (url) => {
      urls.push(url);
      if (url === MANIFEST_URL) {
        return {
          version: 1,
          documents: [
            {
              id: 'lg-es',
              title: 'LG',
              kind: 'magisterium',
              locale: 'es',
              bodyPath: 'documents/lg-es/content.json',
              indexPath: 'documents/lg-es/index.json',
              unitCount: 1,
            },
          ],
        };
      }
      if (url === `${CORPUS_ROOT}/documents/lg-es/content.json`) {
        return [{ consecutivo: '1', contenido: 'Lumen' }];
      }
      if (url === `${CORPUS_ROOT}/documents/lg-es/index.json`) {
        return { indice: { lumen: [0] }, indice_por_punto: {} };
      }
      throw new Error(`HTTP ${url}`);
    };
    const engine = new CorpusLoadEngine({
      httpGet,
      store: new MemoryCorpusStore(),
      readLocalJson: async (url) => {
        const rel = assetUrlToPackRel(url);
        if (!rel) return undefined;
        const bytes = await store.read(rel);
        if (!bytes) return undefined;
        return JSON.parse(new TextDecoder().decode(bytes));
      },
      installedPack: async () => opened.documents,
    });
    const metas = await engine.loadManifest();
    assert.ok(metas.some((d) => d.id === 'padre-es'));
    assert.ok(metas.some((d) => d.id === 'lg-es'));
    const scoped = metasForSearchLocale(metas, 'es');
    assert.ok(scoped.some((d) => d.id === 'padre-es'));

    const indexed = await engine.ensureIndex('padre-es');
    assert.deepStrictEqual(indexed.indice.indice.dios, [0]);
    const loaded = await engine.ensureLoaded('padre-es');
    assert.strictEqual(loaded.documento[0].contenido, 'En el principio');
    assert.strictEqual(loaded.documento[1].contenido, 'el Verbo.');
    assert.ok(
      !urls.some((u) => u.includes('padre-es')),
      `patristic was requested: ${urls.join(', ')}`,
    );

    const base = await engine.ensureLoaded('lg-es');
    assert.strictEqual(base.documento[0].contenido, 'Lumen');
    assert.ok(urls.some((u) => u.includes('lg-es')));

    section('without the pack the work is absent and still offline');
    const absentUrls = [];
    const absent = new CorpusLoadEngine({
      httpGet: async (url) => {
        absentUrls.push(url);
        if (url === MANIFEST_URL) {
          return { version: 1, documents: [] };
        }
        throw new Error(`HTTP ${url}`);
      },
      store: new MemoryCorpusStore(),
      installedPack: async () => [],
    });
    await assert.rejects(
      () => absent.ensureLoaded('padre-es'),
      /not found/i,
    );
    await assert.rejects(
      () => absent.ensureIndex('padre-es'),
      /not found/i,
    );
    assert.deepStrictEqual(
      absentUrls.filter((u) => u.includes('padre-es')),
      [],
    );
    console.log('\npatristic-pack.logic.test.js OK');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
