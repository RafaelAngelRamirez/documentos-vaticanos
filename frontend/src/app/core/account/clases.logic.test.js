/**
 * Clase privada: archivo, revisión y avance por id de paso.
 * Run: npm --prefix frontend run test:clases
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
          } catch {
            // fall through
          }
        }
        return nextResolve(specifier, context);
      }
    `),
  pathToFileURL(__filename),
);

const HERE = __dirname;
const LOGIC = path.join(HERE, 'clases.logic.ts');
const FRONTEND = path.resolve(HERE, '../../../..');

const ID = '11111111-1111-4111-8111-111111111111';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const NOW = '2026-10-27T12:00:00.000Z';
const NOW2 = '2026-10-27T13:00:00.000Z';

function section(name) {
  console.log(`\n== ${name} ==`);
}

async function load() {
  return import(pathToFileURL(LOGIC).href + `?t=${Date.now()}`);
}

function maestroCon(L, pasos) {
  const creado = L.crearMaestro('Cuaresma', NOW, ID, 'Nota del maestro');
  assert.strictEqual(creado.ok, true);
  let entry = creado.entry;
  const ids = [A, B, C];
  for (let i = 0; i < pasos; i++) {
    const ag = L.agregarPaso(
      entry,
      { documentId: 'cic-es', unitIndex: i, rotulo: 'Paso ' + (i + 1), nota: 'Lea' },
      NOW,
      ids[i] || ('dddddddd-dddd-4ddd-8ddd-dddddddddd' + String(i).padStart(2, '0')),
    );
    assert.strictEqual(ag.ok, true, ag.codigo);
    entry = ag.entry;
  }
  return entry;
}

async function main() {
  const L = await load();

  section('crear y tope');
  const creado = L.crearMaestro('  Cuaresma  ', NOW, ID);
  assert.strictEqual(creado.ok, true);
  assert.strictEqual(creado.entry.papel, 'maestro');
  assert.strictEqual(creado.entry.clase.audiencia, 'privada');
  assert.strictEqual(creado.entry.clase.revision, 1);
  assert.strictEqual(creado.entry.listaParaAlumnos, false);
  assert.strictEqual(L.crearMaestro('   ', NOW, ID).ok, false);
  assert.strictEqual(L.puedeArmarClase({ isLoggedIn: false, isTeacher: false }), true);
  assert.strictEqual(L.puedeArmarClase({ isLoggedIn: true, isTeacher: true }), true);
  assert.strictEqual(L.puedeArmarClase({ isLoggedIn: true, isTeacher: false }), false);

  let entry = maestroCon(L, 2);
  assert.strictEqual(entry.clase.pasos[0].id, A);
  assert.strictEqual(entry.clase.pasos[0].documentId, 'cic-es');
  assert.strictEqual(entry.clase.revision, 3);
  assert.strictEqual(entry.listaParaAlumnos, false);

  const tope = { ...entry, clase: { ...entry.clase, pasos: Array.from({ length: 40 }, (_, i) => entry.clase.pasos[0]) } };
  const overflow = L.agregarPaso(tope, { documentId: 'cic-es', unitIndex: 1 }, NOW2, C);
  assert.strictEqual(overflow.ok, false);
  assert.strictEqual(overflow.codigo, 'tope');
  assert.strictEqual(L.agregarPaso(entry, { documentId: 'no es un id', unitIndex: 0 }, NOW2, C).codigo, 'paso');
  assert.strictEqual(L.agregarPaso(entry, { documentId: 'cic-es', unitIndex: -1 }, NOW2, C).codigo, 'paso');

  section('reordenar no cambia el id');
  const lista = L.marcarLista(entry, true);
  assert.strictEqual(lista.ok, true);
  assert.strictEqual(lista.entry.clase.revision, entry.clase.revision);
  const movido = L.reordenar(lista.entry, [B, A], NOW2);
  assert.strictEqual(movido.ok, true);
  assert.deepStrictEqual(movido.entry.clase.pasos.map((p) => p.id), [B, A]);
  assert.strictEqual(movido.entry.clase.revision, lista.entry.clase.revision + 1);
  assert.strictEqual(movido.entry.listaParaAlumnos, false);
  const mismaMeta = L.guardarMeta(
    movido.entry,
    movido.entry.clase.titulo,
    movido.entry.clase.descripcion || '',
    NOW2,
  );
  assert.strictEqual(mismaMeta.ok, true);
  assert.strictEqual(mismaMeta.entry.clase.revision, movido.entry.clase.revision);

  section('exportar solo si está lista');
  assert.strictEqual(L.archivoExportable(movido.entry).codigo, 'nolista');
  const lista2 = L.marcarLista(movido.entry, true);
  const archivo = L.archivoExportable(lista2.entry);
  assert.strictEqual(archivo.ok, true);
  const json = JSON.parse(archivo.json);
  assert.deepStrictEqual(Object.keys(json).sort(), [
    'actualizadaEn',
    'audiencia',
    'descripcion',
    'id',
    'pasos',
    'revision',
    'titulo',
  ]);
  assert.strictEqual(json.descripcion, 'Nota del maestro');
  assert.strictEqual(json.audiencia, 'privada');
  assert.ok(!('email' in json));
  assert.ok(!('texto' in json));
  assert.ok(!('listaParaAlumnos' in json));
  assert.strictEqual(json.pasos[0].id, B);
  const round = L.parsearArchivo(archivo.json);
  assert.strictEqual(round.ok, true);
  assert.strictEqual(round.clase.pasos[1].id, A);

  section('importar');
  const nueva = L.incorporarArchivo([], archivo.json);
  assert.strictEqual(nueva.ok, true);
  assert.strictEqual(nueva.codigo, 'nueva');
  assert.strictEqual(nueva.entries[0].papel, 'alumno');
  assert.strictEqual(nueva.entries.length, 1);

  const propia = L.incorporarArchivo([lista2.entry], archivo.json);
  assert.strictEqual(propia.ok, false);
  assert.strictEqual(propia.codigo, 'propia');
  assert.strictEqual(propia.entries.length, 1);
  assert.strictEqual(propia.entries[0].papel, 'maestro');

  const alumno = nueva.entries[0];
  const misma = L.incorporarArchivo(nueva.entries, archivo.json);
  assert.strictEqual(misma.codigo, 'misma');
  assert.strictEqual(misma.entries, nueva.entries);

  const vieja = L.serializarClase({ ...alumno.clase, revision: alumno.clase.revision - 1 });
  const antigua = L.incorporarArchivo(nueva.entries, vieja);
  assert.strictEqual(antigua.codigo, 'antigua');
  assert.strictEqual(antigua.entries[0].clase.revision, alumno.clase.revision);

  const subida = L.serializarClase({
    ...alumno.clase,
    revision: alumno.clase.revision + 1,
    titulo: 'Cuaresma II',
    pasos: [alumno.clase.pasos[0]],
    actualizadaEn: NOW2,
  });
  const pendiente = L.incorporarArchivo(nueva.entries, subida);
  assert.strictEqual(pendiente.codigo, 'pendiente');
  assert.strictEqual(pendiente.entries[0].clase.titulo, alumno.clase.titulo);
  assert.strictEqual(pendiente.entries[0].pendiente.titulo, 'Cuaresma II');
  assert.strictEqual(pendiente.entries[0].pendiente.pasos.length, 1);

  const aceptada = L.aceptarPendiente(pendiente.entries[0]);
  assert.strictEqual(aceptada.ok, true);
  assert.strictEqual(aceptada.entry.clase.titulo, 'Cuaresma II');
  assert.strictEqual(aceptada.entry.clase.pasos.length, 1);
  assert.strictEqual(aceptada.entry.clase.pasos[0].id, B);
  assert.strictEqual(aceptada.entry.pendiente, undefined);
  const hechos = { [A]: true, [B]: true, huerfano: true };
  assert.strictEqual(L.leidos(aceptada.entry.clase.pasos, hechos), 1);
  assert.strictEqual(L.indiceSiguiente(aceptada.entry.clase.pasos, { [B]: true }), 0);

  const publica = L.parsearArchivo(JSON.stringify({ ...json, audiencia: 'publica' }));
  assert.strictEqual(publica.codigo, 'publica');
  const conTexto = L.parsearArchivo(JSON.stringify({ ...json, texto: 'corpus' }));
  assert.strictEqual(conTexto.codigo, 'invalida');
  const enorme = L.parsearArchivo('x'.repeat(L.MAX_ARCHIVO_BYTES + 1));
  assert.strictEqual(enorme.codigo, 'grande');

  section('avance legado');
  const mapa0 = {};
  const mig = L.migrarProgresoLegado(mapa0, ID, alumno.clase.pasos, [1, 0, 9]);
  assert.strictEqual(mig.consumirLegacy, true);
  assert.deepStrictEqual(mig.mapa[ID], { [B]: true, [A]: true });
  const otra = L.migrarProgresoLegado(mig.mapa, ID, alumno.clase.pasos, [0]);
  assert.strictEqual(otra.consumirLegacy, false);
  assert.deepStrictEqual(otra.mapa[ID], mig.mapa[ID]);
  const marcado = L.marcarLeido(mig.mapa, ID, B);
  assert.strictEqual(marcado[ID][B], true);
  assert.strictEqual(L.olvidarProgreso(marcado, ID)[ID], undefined);

  section('rutas y pantallas');
  const santoral = await import(
    pathToFileURL(path.join(FRONTEND, 'src/app/core/santoral/santoral-units.logic.ts')).href
  );
  assert.strictEqual(santoral.parentPathForAppUrl(`/clases/${ID}/editar`), `/clases/${ID}`);
  assert.strictEqual(santoral.parentPathForAppUrl(`/clases/${ID}`), '/estudios');

  const apr =
    fs.readFileSync(path.join(FRONTEND, 'src/app/pages/aprendizaje/aprendizaje.component.ts'), 'utf8') +
    fs.readFileSync(path.join(FRONTEND, 'src/app/pages/aprendizaje/aprendizaje.component.html'), 'utf8');
  assert.ok(apr.includes('learning.title'));
  assert.ok(apr.includes('clase.import'));
  assert.ok(!apr.includes('myEnrollments'));
  assert.ok(!apr.includes('Inicie sesión'));
  assert.ok(!apr.includes('dv.lesson.'));

  const est = fs.readFileSync(
    path.join(FRONTEND, 'src/app/pages/estudios/estudios.component.html'),
    'utf8',
  );
  assert.ok(est.includes('clase.mine'));
  assert.ok(est.includes('clase.create'));
  assert.ok(est.includes("t('study.title')"));

  console.log('\nOK: clases.logic.test.js');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
