/**
 * Rótulo visible de una fila de Relacionados.
 * Título corto primero, como Citas cruzadas. El id del paquete sigue en la
 * fila para navegar y no se muestra si el corpus ya trae un nombre.
 * Archivo .js para que los tests con strip-types puedan requerirlo.
 */
function relatedChromeTitle(documentId, consec, labels) {
  const id = String(documentId || '').trim();
  const short = String((labels && labels.shortTitle) || '').trim();
  const nombre = String((labels && labels.nombre) || '').trim();
  const name =
    short && short !== id ? short : nombre && nombre !== id ? nombre : '';
  return `${name || id || 'doc'} · Nº ${consec}`;
}

module.exports = { relatedChromeTitle };
