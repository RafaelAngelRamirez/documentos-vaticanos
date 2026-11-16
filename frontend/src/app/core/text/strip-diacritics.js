/**
 * Quita diacríticos y conserva la ñ.
 * Misma expresión que el índice del corpus; una sola copia en la app.
 * Archivo .js para que los tests con strip-types puedan requerirlo.
 */
function stripDiacritics(texto) {
  return texto
    .normalize('NFD')
    .replace(
      /([^n\u0300-\u036f]|n(?!\u0303(?![\u0300-\u036f])))[\u0300-\u036f]+/gi,
      '$1',
    )
    .normalize();
}

module.exports = { stripDiacritics };
