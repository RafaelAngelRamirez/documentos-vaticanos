console.log("+++++++++++++++++++++++++++++++++++++++++++++++");
console.log(
  "+ DESCARGA DE DOCUMENTOS VATICANOS v" + require("./package.json").version
);
console.log("+++++++++++++++++++++++++++++++++++++++++++++++");
console.log("[ + ] Preparando descarga del Catecismo");
const https = require("https");
const strip = require("string-strip-html").stripHtml;
const fs = require("fs");
const axios = require("axios").default;

const cliProgress = require("cli-progress");

// create a new progress bar instance and use shades_classic theme
const cli_progress_bar = new cliProgress.SingleBar(
  {
    format: "{bar} | {percentage}% | ETA: {eta}s | {fileName}",
  },
  cliProgress.Presets.legacy
);

//Pagina base de donde se estructura el documento.
const url_de_documento_a_descargar =
  "https://www.vatican.va/archive/catechism_sp";
const nombre_fichero_final = "catecismo";
// La pagina que contiene el indice.

let dir = "documentos";
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir);
}

const indice = `${url_de_documento_a_descargar}/index_sp.html`;
const totalDePuntos = 2865;

// Cache del documento limpio
const documento = [];

/**
 *Obtiene la pagina que se le pase como url.
 *
 * @param {*} url
 * @returns
 */
function obtener_pagina(url) {
  return new Promise((resolve, reject) => {
    axios
      .get(url)
      .then((respuesta) => resolve(respuesta.data))
      .catch((_) => reject(_));
  });
}

// Nos conectamos al indice para empezar todo el merequetengue
console.log(`[i] Indice: ${indice}`);

let urls = [];
let urlsRegistro = [];
obtener_pagina(indice)
  .then((r) => {
    urlsRegistro = obtenerIndice(r);
    console.log(
      `[ + ] ${urlsRegistro.length} entradas del indice para procesarse.`
    );
    cli_progress_bar.start(urls.length, 0);
    obtenerPuntos(urls.shift());
  })
  .catch((_) => console.log("[ERROR]=>", _));

function obtenerIndice(res_doc_html) {
  console.log("[ + ] Procesando indice: ");

  // Convertimos el texto en html
  const { document } = require("linkedom").parseHTML(res_doc_html);
  // Buscamos unicamente las url que es lo que nos intersa.
  const todasLasUrl = document.querySelectorAll("a");
  // Convertivmos en arreglo las coincidencias.
  const urlArreglo = Array.from(todasLasUrl);

  // Obtenemos solo las url que contengan esta estructura y eliminamos
  // Las que no nos interesan.
  urls = urlArreglo
    // Obtenemos solo el valor de href
    .map((x) => x.href)
    .map((x) => {
      const d = "html#";
      if (!x.includes(d)) return x;
      return x.split("#").shift();
    })
    // Debe estar nombrada como sp
    .filter((x) => x.includes("_sp"));
  // Quitamos los duplicados
  urls = Array.from(new Set(urls));

  return [...urls];
}

/**
 *Obtiene los puntos de cada una de las url obtenidoas en el indice.
 *
 * @param {*} url
 */

let contador = 0;
function obtenerPuntos(url) {
  contador++;
  cli_progress_bar.update(contador, {
    fileName: `Por procesar: ${urlsRegistro.length - contador} , URL: ${url}`,
  });
  // Obtenemos una url para evaluarla.
  const nuevaUrl = url_de_documento_a_descargar.concat(`/${url}`);
  // Nos conectamos
  obtener_pagina(nuevaUrl)
    .then((htmlString) => {
      const etiquetas = buscarEtiquetaObjetivo(htmlString)
        // Limpiamos y reorganizamos

        .map((x) => {
          let consecutivo = obtenerConsecutivo(x);
          let contenido = x.innerText;

          return {
            consecutivo,
            contenido,
          };
        });

      documento.push(...etiquetas);
      if (urls.length) obtenerPuntos(urls.shift());
      else terminar(documento);
    })
    .catch((_) => console.log(_));
}

function buscarEtiquetaObjetivo(htmlString) {
  const { document } = require("linkedom").parseHTML(htmlString);
  return document.querySelectorAll("p");
}

function obtenerConsecutivo(etiqueta) {
  //Los consecutivos son los puntos con los que se documenta
  // el texto y por tanto debe ser un digito
  let consecutivo = etiqueta.querySelector("b")?.innerText;
  if (isNaN(consecutivo) || !consecutivo) return "no-encontrado";
  return consecutivo;
}

function obtenerDiferenciaDePuntos(doc) {
  const soloPuntosExistentes = doc
    .map((x) => x.consecutivo * 1)
    .sort((a, b) => a - b);
  const masAlto = soloPuntosExistentes[soloPuntosExistentes.length - 1];

  let contador = 1;
  const puntosInexistentes = Array.from(
    Array(totalDePuntos),
    () => contador++
  ).filter((x) => !soloPuntosExistentes.includes(x));

  const total = doc.length;
  console.log("[ i ] -----------------------------");
  console.log("[ ! ] Puntos capturados: " + total);
  console.log("[ ! ] Puntos estimados: " + masAlto);
  console.log("[ + ] Total de puntos: " + totalDePuntos);
  console.log("[ + ] Puntos inexistentes: " + puntosInexistentes);
  console.log("[ i ] -----------------------------");

  return { total, masAlto, totalDePuntos, puntosInexistentes };
}

function escribir_fichero_principal_e_indice(datos) {
  const nombre_documento = `${datos.dir}/${datos.nombre_fichero_final}.json`;
  const nombre_indice = `${datos.dir}/${datos.nombre_fichero_final}.index.json`;

  fs.writeFileSync(nombre_documento, JSON.stringify(datos.documento), "utf-8");
  fs.writeFileSync(nombre_indice, JSON.stringify(datos.indice), "utf-8");
  console.log(`[ i ] ${datos.nombre_fichero_final} guardado`);
}

function separarReferencias(doc) {
  const regex = /\((.*?)\)/gm;
  return doc.map((x) => {
    // Definimos el objeto referencias
    x.referencias = [];

    // Obtenemos todas las posibles referencias ()
    let m;

    do {
      m = regex.exec(x.contenido);
      if (m) {
        x.referencias.push({
          descripcion: m[1],
        });
      }
    } while (m);

    let contador = 0;
    x.contenido = x.contenido.replace(
      /\(.*?\)/gm,
      (fullmatch, n) => `( [+[${contador++}]+] )`
    );

    return x;
  });
}

function terminar(doc) {
  let docLimpio = separarReferencias(doc);

  cli_progress_bar.stop();

  const diferencias = obtenerDiferenciaDePuntos(docLimpio);
  diferencias[urls] = urlsRegistro;

  console.log("[ + ] Generando indice");
  const indice = require('./generacion_de_indices').generar_indice(docLimpio)

  console.log("[ + ] Escribiendo documentos");
  escribir_fichero_principal_e_indice({
    documento: docLimpio,
    dir,
    nombre_fichero_final,
    indice
  });

  // console.log("[ + ] Escribiendo diferencias en un fichero");
  // fs.appendFile(
  //   `${dir}/diferencias_${nombre_fichero_final}.json`,
  //   JSON.stringify(diferencias),
  //   function (err) {
  //     if (err) return console.error(err);
  //     console.log("[i] diferencias.json guarado");
  //   }
  // );

  // Copiamos el resultado a la carpeta de documentos
  // del front.
  let ruta_front = "../frontend/src/assets/documentos";
  console.log(`[i] Copiando fichero a frontend`);

  fs.rmSync(`${ruta_front}/${nombre_fichero_final}.json`, {
    force: true,
  });

  fs.copyFileSync(
    `${dir}/${nombre_fichero_final}.json`,
    `${ruta_front}/${nombre_fichero_final}.json`
  );
}
