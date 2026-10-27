/**
 * Mobile feature map and the four critical flows, driven on the real modules.
 *
 * Pack bytes come from documentos/corpus (the tree corpus:sync-assets copies
 * into assets). No Angular, no network, no server.
 *
 *   bash ../scripts/node-strip-types.sh src/app/core/shell/mobile-flows.behavior.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const HERE = __dirname;
const REPO = path.resolve(HERE, '../../../../..');
const APP = path.join(REPO, 'frontend/src/app');
const CANON = path.join(REPO, 'documentos/corpus');
const STUB_PATH = path.join(
  REPO,
  'frontend/src/assets/downloads/manifest.json',
);

const DOC_ID = 'iura-et-bona-es';

function section(name) {
  console.log(`\n== ${name} ==`);
}

function read(relFromApp) {
  return fs.readFileSync(path.join(APP, relFromApp), 'utf8');
}

function mustInclude(file, text, label) {
  assert.ok(text.length > 0 && file.includes(text), label || text);
}

async function load(relFromRepo) {
  const file = path.join(REPO, relFromRepo);
  return import(pathToFileURL(file).href + `?t=${Date.now()}`);
}

/** assets/corpus/… → documentos/corpus/… (the ship source). */
function packHttp(log) {
  return async (url) => {
    log.push(url);
    const rel = String(url).replace(/^assets\/corpus\/?/, '');
    const file = path.join(CANON, rel);
    if (!fs.existsSync(file)) {
      const err = new Error(`HTTP 404 ${url}`);
      err.status = 404;
      throw err;
    }
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  };
}

function offlineHttp(log) {
  return async (url) => {
    log.push(url);
    const err = new Error(`offline ${url}`);
    err.status = 0;
    throw err;
  };
}

function excerpt(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 90);
}

async function main() {
  const corpus = await load(
    'frontend/src/app/core/corpus/corpus-load.logic.ts',
  );
  const search = await load(
    'frontend/src/app/core/search/semantic-search.logic.ts',
  );
  const cite = await load('frontend/src/app/core/reading/cite.ts');
  const immersive = await load(
    'frontend/src/app/pages/immersive-route.logic.ts',
  );
  const downloads = await load(
    'frontend/src/app/core/downloads/downloads.models.ts',
  );
  const version = await load(
    'frontend/src/app/core/downloads/version-display.logic.ts',
  );
  const update = await load(
    'frontend/src/app/core/downloads/app-update.logic.ts',
  );
  const shell = await load('frontend/src/app/core/shell/shell.util.ts');
  const env = await load('frontend/src/environments/environment.ts');

  const bnav = read('components/bnav/bnav.component.ts');
  const routing = read('pages/pages-routing.module.ts');
  const lector = read('components/lector/lector.component.html');
  const inicio = read('pages/inicio/inicio.component.html');
  const biblioteca = read(
    'pages/list-documents-pages/list-documents-pages.component.html',
  );
  const bibliotecaTs = read(
    'pages/list-documents-pages/list-documents-pages.component.ts',
  );
  const buscarHtml = read('pages/buscar/buscar.component.html');
  const buscarTs = read('components/buscador/buscador.component.ts');
  const estudios = read('pages/estudios/estudios.component.html');
  const ajustes = read('pages/ajustes/ajustes.component.html');
  const downloadsTs = read('core/downloads/downloads.service.ts');
  const inicioTs = read('pages/inicio/inicio.component.ts');

  section('mapa del móvil');
  const map = [
    ['Inicio', '/inicio', 'inmersiva', 'sin bnav'],
    ['Biblioteca', '/biblioteca', 'inmersiva', 'bnav biblioteca'],
    ['Buscar', '/buscar', 'inmersiva', 'fbar propia, sin bnav'],
    ['Lector', '/leyendo/:id/u/:unit', 'inmersiva', 'fbar + rfoot, sin bnav'],
    ['Ficha', '/documento/:id', 'producto', 'cubre el lector'],
    ['Estudio', '/estudios', 'producto', 'bnav estudio'],
    ['Ajustes', '/ajustes', 'producto', 'bnav ajustes'],
  ];
  for (const row of map) {
    console.log(row.join(' · '));
  }

  mustInclude(bnav, "go(['/', route.inicio])", 'bnav inicio');
  mustInclude(bnav, "go(['/biblioteca'])", 'bnav biblioteca');
  mustInclude(bnav, "go(['/estudios'])", 'bnav estudio');
  mustInclude(bnav, "go(['/ajustes'])", 'bnav ajustes');
  assert.ok(!bnav.includes("go(['/leyendo"), 'la barra no abre el lector');
  mustInclude(bnav, "p.startsWith('/buscar')", 'buscar marcaría biblioteca');

  mustInclude(routing, "path: 'biblioteca'", 'ruta biblioteca');
  mustInclude(routing, "path: 'buscar'", 'ruta buscar');
  mustInclude(routing, "path: 'estudios'", 'ruta estudios');
  mustInclude(routing, "path: 'ajustes'", 'ruta ajustes');
  mustInclude(routing, "path: 'documento/:id'", 'ruta ficha');
  mustInclude(routing, 'ROUTE.leyendo}/:id/u/:unit', 'ruta canónica del lector');
  mustInclude(routing, 'component: InicioComponent', 'ruta inicio');

  assert.strictEqual(immersive.isImmersivePath('/inicio'), true);
  assert.strictEqual(immersive.isImmersivePath('/biblioteca'), true);
  assert.strictEqual(immersive.isImmersivePath('/buscar?q=suicidio'), true);
  assert.strictEqual(
    immersive.isImmersivePath('/leyendo/iura-et-bona-es/u/2'),
    true,
  );
  assert.strictEqual(immersive.isImmersivePath('/documento/iura-et-bona-es'), false);
  assert.strictEqual(immersive.isImmersivePath('/estudios'), false);
  assert.strictEqual(immersive.isImmersivePath('/ajustes'), false);

  assert.ok(!inicio.includes('app-bnav'), 'inicio no monta bnav');
  assert.ok(!lector.includes('app-bnav'), 'lector no monta bnav');
  assert.ok(!buscarHtml.includes('app-bnav'), 'buscar no monta bnav');
  mustInclude(lector, 'class="fbar hair only-mobile"', 'fbar del lector');
  mustInclude(lector, 'class="rfoot only-mobile"', 'rfoot del lector');
  mustInclude(buscarHtml, 'Volver a la biblioteca', 'volver desde buscar');
  mustInclude(buscarHtml, 'Offline, sin red', 'buscar declara offline');
  mustInclude(biblioteca, 'app-bnav current="biblioteca"', 'bnav biblioteca');
  mustInclude(biblioteca, 'class="only-mobile"', 'biblioteca móvil');
  mustInclude(estudios, 'app-bnav current="estudio"', 'bnav estudio');
  mustInclude(ajustes, 'app-bnav current="ajustes"', 'bnav ajustes');
  mustInclude(bibliotecaTs, "navigate(['/documento', item.id])", 'abrir ficha');
  mustInclude(buscarTs, 'rankUnitsForDocument', 'buscar usa el ranker');
  mustInclude(buscarTs, 'openReading', 'un resultado abre el lector');

  section('abrir y leer offline');
  const firstUrls = [];
  const store = new corpus.MemoryCorpusStore();
  const online = new corpus.CorpusLoadEngine({
    httpGet: packHttp(firstUrls),
    store,
  });
  const loaded = await online.ensureLoaded(DOC_ID);
  assert.strictEqual(loaded.meta.id, DOC_ID);
  assert.ok(loaded.meta.title && loaded.meta.title !== DOC_ID, 'título completo');
  assert.ok(loaded.documento.length >= 3, 'hay unidades');
  const unit0 = loaded.documento[0];
  assert.ok(unit0 && unit0.contenido && unit0.contenido.length > 40, 'texto');
  assert.ok(
    firstUrls.some((u) => String(u).endsWith('content.json') || String(u).includes('/c/')),
    'la primera lectura pide el cuerpo al pack',
  );
  console.log(`documento ${loaded.meta.id}`);
  console.log(`título ${loaded.meta.title}`);
  console.log(`unidad 0 · ${unit0.consecutivo} · ${excerpt(unit0.contenido)}`);

  online.clearMemory();
  const offlineUrls = [];
  const offline = new corpus.CorpusLoadEngine({
    httpGet: offlineHttp(offlineUrls),
    store,
  });
  const again = await offline.ensureWindow(DOC_ID, 0, 0);
  assert.strictEqual(again.documento[0].contenido, unit0.contenido);
  const withIndex = await offline.ensureLoaded(DOC_ID);
  assert.ok(
    Object.keys(withIndex.indice.indice || {}).length > 10,
    'el índice queda en el almacén local',
  );
  assert.ok(
    offlineUrls.every(
      (u) => !String(u).includes('content.json') && !String(u).includes('/c/'),
    ),
    'sin red no se vuelve a pedir el cuerpo',
  );
  console.log(
    `relectura sin red · peticiones ${offlineUrls.length} · cuerpo no solicitado`,
  );

  await assert.rejects(
    () => offline.ensureLoaded('no-existe-es'),
    /not found/i,
  );

  section('búsqueda');
  const docInput = search.toSearchDocumentInput(
    withIndex.meta.id,
    withIndex.indice,
    withIndex.documento,
  );
  assert.deepStrictEqual(search.searchCorpus('', [docInput]), []);
  assert.deepStrictEqual(search.searchCorpus('   ', [docInput]), []);

  const wordHits = search.searchCorpus('suicidio', [docInput]);
  assert.ok(wordHits.length >= 1, 'suicidio tiene hit');
  const word = wordHits[0];
  assert.strictEqual(word.documentId, DOC_ID);
  assert.ok(word.matchedTerms.includes('suicidio'));
  const wordUnit = withIndex.documento[word.unitIndex];
  assert.ok(
    wordUnit.contenido.toLowerCase().includes('suicidio'),
    'el hit apunta al texto',
  );
  console.log(
    `consulta suicidio · ${word.documentId} · unidad ${word.unitIndex} · ${word.consecutivo}`,
  );

  const pointHits = search.searchCorpus('.3', [docInput]);
  assert.ok(pointHits.length >= 1, 'punto 3 tiene hit');
  const point = pointHits[0];
  assert.strictEqual(point.documentId, DOC_ID);
  const pointUnit = withIndex.documento[point.unitIndex];
  assert.ok(
    String(pointUnit.consecutivo).includes('3'),
    'el punto resuelve al consecutivo',
  );
  console.log(
    `consulta .3 · ${point.documentId} · unidad ${point.unitIndex} · ${point.consecutivo}`,
  );

  section('navegación');
  assert.strictEqual(cite.parseDocumentId(loaded.meta.title), null);
  const id = cite.parseDocumentId(word.documentId);
  const unit = cite.parseUnitIndex(word.unitIndex);
  assert.ok(id && id.kind === 'corpus' && id.id === DOC_ID);
  assert.strictEqual(unit, word.unitIndex);
  const commands = cite.readingCommands(cite.cite(id, unit));
  assert.deepStrictEqual(commands, [
    'leyendo',
    DOC_ID,
    'u',
    String(word.unitIndex),
  ]);
  const url = `/${commands.join('/')}`;
  assert.strictEqual(immersive.isImmersivePath(url), true);
  assert.ok(!lector.includes('app-bnav'));
  console.log(`abrir ${url}`);
  console.log('chrome lector · inmersiva · sin bnav');

  const cover = `/documento/${DOC_ID}`;
  assert.strictEqual(immersive.isImmersivePath(cover), false);
  console.log(`ficha ${cover} · luego el lector`);

  section('descarga');
  const STABLE = downloads.STABLE_DOWNLOAD_PATHS;
  const stub = JSON.parse(fs.readFileSync(STUB_PATH, 'utf8'));
  assert.strictEqual(stub.downloads.apk, STABLE.apk);
  assert.strictEqual(stub.downloads.linux, STABLE.linux);
  assert.strictEqual(stub.downloads.windows, STABLE.windows);

  mustInclude(
    downloadsTs,
    'STABLE_DOWNLOAD_PATHS.manifest',
    'primero el manifest público',
  );
  mustInclude(
    downloadsTs,
    "get<DownloadsManifest>('assets/downloads/manifest.json')",
    'luego el stub empaquetado',
  );
  mustInclude(downloadsTs, 'fallbackManifest()', 'luego las rutas estables');
  mustInclude(downloadsTs, 'pickAppVersionForDisplay', 'la etiqueta es la del build');
  mustInclude(inicioTs, 'isWebDownloadShell', 'inicio decide si muestra iconos');
  mustInclude(inicio, 'data-testid="inicio-downloads"', 'fila de descargas');
  mustInclude(inicio, '*ngIf="showDownloads"', 'la fila es condicional');

  const build = env.environment.version;
  const shown = version.pickAppVersionForDisplay(build, '0.0.1');
  assert.strictEqual(shown, build);
  const fromStub = version.pickAppVersionForDisplay(build, stub.version);
  assert.strictEqual(fromStub, build);

  assert.strictEqual(shell.isWebDownloadShell(false, false), true);
  assert.strictEqual(shell.isWebDownloadShell(true, false), false);
  assert.strictEqual(
    update.shouldAutoCheckAppUpdate({
      isNativePlatform: true,
      isElectron: false,
    }),
    true,
  );
  assert.strictEqual(
    update.shouldAutoCheckAppUpdate({
      isNativePlatform: false,
      isElectron: false,
    }),
    false,
  );
  assert.strictEqual(
    update.detectUpdatePlatform({
      isNativePlatform: true,
      isElectron: false,
    }),
    'apk',
  );

  const origin = env.environment.downloadsPublicOrigin;
  const same = update.resolveUpdate(build, stub, 'apk', origin);
  assert.strictEqual(same.available, false);
  assert.strictEqual(same.reason, 'same_or_older');

  const newer = update.resolveUpdate(
    build,
    {
      version: '9.9.9',
      downloads: { apk: STABLE.apk },
    },
    'apk',
    origin,
  );
  assert.strictEqual(newer.available, true);
  assert.strictEqual(newer.platform, 'apk');
  assert.strictEqual(
    newer.downloadUrl,
    update.absolutizeDownloadUrl(STABLE.apk, origin),
  );
  assert.strictEqual(
    update.resolveUpdate(build, null, 'apk', origin).reason,
    'no_manifest',
  );

  console.log(`web · iconos · ${STABLE.apk}`);
  console.log(`android · sin iconos · aviso si el remoto es más nuevo`);
  console.log(`etiqueta v${shown} · stub no la pisa`);
  console.log(`apk nuevo · ${newer.downloadUrl}`);

  console.log('\nok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
