const fs = require("fs");

/**
 * Elimina todos los diacriticos menos la Ñ.
 * https://es.stackoverflow.com/questions/62031/eliminar-signos-diacríticos-en-javascript-eliminar-tildes-acentos-ortográficos
 * @param {string} texto
 * @returns El texto sin acentos, diacritos, menos Ñ
 */
function eliminar_diacriticos(texto) {
  return texto
    .normalize("NFD")
    .replace(
      /([^n\u0300-\u036f]|n(?!\u0303(?![\u0300-\u036f])))[\u0300-\u036f]+/gi,
      "$1"
    )
    .normalize();
}

/**
 *Elimina una lista de caracteres innecesarios como comas, puntos,
 * comillas francesas.
 *
 * @param {*} texto
 * @return El texto limpio.
 */
function eliminar_caracteres_innecesarios_para_indice(texto) {
  return (
    texto
      .replace(/[,"\.«»“”:;!¡¿?—']/gi, "")
      // Eliminamos el formato de la referencia que creamos
      // al descargar el documento.
      .replace(/\( \[\+\[\d*\]\+\] \)/gi, "")
      //   Para poder eliminar los espacios dobles primero
      //   remplazamos todos los no caracteres con ###, para
      //   luego poder seleccionar todas las coincidencias de #
      //   mayores de 3 y remplazarlas por un espacio.
      .replace(/\s/gi, "###")
      .replace(/#{3,21}/gi, " ")
      .replace(/[\[\]”]/gi, "")
      //   Estos caracteres necesitan estar en este punto.
      .replace(/[-\(\)\*\/`‘–…]/gi, "")
      .trim()
  );
}

function eliminar_consecutivo_de_punto(texto, consecutivo) {
  return texto.replace(consecutivo + " ", "");
}

/**
 *Genera un indice en función del documento que se le pase.
 * Se espera que el documento sea un estandar, talcual la
 * actual estructura de "El Catecismo"
 *
 * @param {*} documento
 * @return {*} El indice generado
 */
function generar_indice(documento) {
  if (!documento) throw new Error("No se recibio ningún documento");
  let indice = {};
  // Esta es una referencia rápida para encontrar el
  // punto contra el indice del arreglo en que está almacenado.
  // Esto lo hago así principalmente para que en la interfaz
  // obtengamos de manera rápida la ubiación del punto.
  let indice_por_punto = {};
  let i = -1;
  for (const punto of documento) {
    let contenido = punto.contenido;
    let modificado = contenido;
    modificado = eliminar_diacriticos(modificado);
    modificado = eliminar_caracteres_innecesarios_para_indice(modificado);
    modificado = modificado.toLowerCase();
    modificado = eliminar_consecutivo_de_punto(modificado, punto.consecutivo);
    i++;

    // Si existe un punto (diferente de 'no-encontrado') entonces
    // gurdamos su indice.

    if (punto.consecutivo !== "no-encontrado") {
      indice_por_punto[i] = parseInt(punto.consecutivo);
    }

    if (modificado.length === 0) continue;

    modificado.split(" ").forEach((palabra) => {
      if (!indice.hasOwnProperty(palabra)) indice[palabra] = new Set();
      indice[palabra].add(i);
    });
  }

  let llaves = Object.keys(indice);
  // Necesitamos que e set sea un arreglo
  llaves.forEach((k) => {
    indice[k] = [...indice[k]];
  });
  let longitud = llaves.length;
  console.log(`[ index ] Longitud: ${longitud}`);

  return { indice, indice_por_punto };
}

module.exports = {
  generar_indice,
};
