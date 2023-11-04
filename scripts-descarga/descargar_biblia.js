const fs = require("fs");
const axios = require("axios").default;
const linkedom = require("linkedom");

const abreviaciones = console.log(
  "+++++++++++++++++++++++++++++++++++++++++++++++"
);
console.log(
  "+ DESCARGA DE DOCUMENTOS VATICANOS v" + require("./package.json").version
);
console.log("+++++++++++++++++++++++++++++++++++++++++++++++");
console.log("[ + ] Preparando descarga de Biblia Pueblo de Dios");

//Pagina base de donde se estructura el documento.
const url_de_documento_a_descargar =
  "https://www.vatican.va/archive/ESL0506/__P1.HTM";
const nombre_fichero_final = "biblia_pueblo_de_Dios";
// La pagina que contiene el indice.

let dir = "documentos";
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir);
}

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
      .then((respuesta) => resolve({ data: respuesta.data, url }))
      .catch((_) => reject(_));
  });
}

function _formatear_resultado_general(texto) {
  return texto.trim().toLowerCase();
}

function obtener_testamento(document) {
  const li = document.querySelector("font > font > ul > li");
  const hijo = li.querySelector("ul");
  if (hijo) li.removeChild(hijo);
  return _formatear_resultado_general(li.textContent);
}

function obtener_titulo_libro(document) {
  const ul = document.querySelector("font > font > ul > li > ul >li");

  const hijo = ul.querySelector("ul");
  if (hijo) ul.removeChild(hijo);

  return _formatear_resultado_general(ul.textContent);
}

function obtener_capitulo(document) {
  const ul = document.querySelector("font > font > ul > li > ul >li > ul");
  // Las introducciones no tienen este nodo.
  if (!ul) return _formatear_resultado_general("0");

  return _formatear_resultado_general(ul.textContent);
}

function _limpiar_caracteres_especiales(texto) {
  let procesado = texto;
  if (procesado) procesado = procesado.replace("\n", " ");

  return procesado;
}

const versiculo = {
  versiculo: 0,
  contenido: "",
};

function nuevo_versiculo() {
  return JSON.parse(JSON.stringify(versiculo));
}

function _obtener_contenido_capitulo(datos) {
  const document = datos.document;
  function obtener_versiculo(versiculo) {
    // El versiculo más grande es el 176, entonces
    // solo necesitamos comprobar los tres primeros
    // digitos para saber el número.
    let tres_caracteres = versiculo.slice(0, 3);
    let vers = tres_caracteres.trim();
    try {
      vers = parseInt(vers);
      return vers;
    } catch (error) {
      return undefined;
    }
  }

  const versiculos = [];
  Array.from(document.querySelectorAll("p.MsoNormal")).forEach((p) => {
    let contenido = p.textContent;
    contenido = _limpiar_caracteres_especiales(contenido);
    contenido = contenido.trim();

    const num_versiculo = obtener_versiculo(contenido);
    // En el caso de los salmos, por algúna extraña razón, en lugar
    // de utilizar un \n para el salto de linea crearon otro objeto
    // p.MsoNormal. Entonces, cuando no tengamos un versiculo válido
    // hay que concatenarlo al anterior.

    contenido = _limpiar_caracteres_especiales(contenido);
    let _nuevo_vers = nuevo_versiculo();
    if (!num_versiculo) {
      _nuevo_vers.contenido.concat(" " + contenido);
    } else {
      _nuevo_vers.versiculo = num_versiculo;
      _nuevo_vers.contenido = contenido;
      versiculos.push(_nuevo_vers);
    }
  });

  return versiculos;
}

function _obtener_contenido_intro(datos) {
  const document = datos.document;
  let enunciado = document.querySelector(".Enunciado").textContent;
  enunciado = _limpiar_caracteres_especiales(enunciado);

  const v = nuevo_versiculo();
  v.versiculo = 0;
  v.contenido = enunciado;

  return [v];
}

function obtener_contenido_capitulo(datos) {
  const versiculos = [];

  //Abdias no tiene intro.
  const excepciones = [
    "carta de jeremias",
    "abdias",
    "carta a filemon",
    "segunda carta de san juan",
    "tercera carta de san juan",
    "carta de san judas",
  ];

  if (excepciones.includes(datos._libro)) {
    console.log(`[!] ${datos._libro} ES UNA EXEPCIÓN`);
    const v_capitulo = _obtener_contenido_capitulo(datos);
    versiculos.push(...v_capitulo);
  } else if (datos._capitulo === "0") {
    const v_intro = _obtener_contenido_intro(datos);
    versiculos.push(...v_intro);
  } else {
    const v_capitulo = _obtener_contenido_capitulo(datos);

    versiculos.push(...v_capitulo);
  }

  return { versiculos };
}

function obtener_siguiente_pagina(document) {
  let url = Array.from(document.querySelectorAll("a")).pop().href;

  let ruta = url_de_documento_a_descargar.split("/");
  ruta.pop();
  ruta.push(url);
  url = ruta.join("/");

  return url;
}

/**
 * Estructura: Antiguo/Nvo testametno > libro > capitulo > {versiuclos:[]}
 * @type {*} */
const biblia = {};

let pasos = 0;

const pagina_anterior = "";
const pagina_actual = url_de_documento_a_descargar;

function ejecutar_proceso(pagina_actual, pagina_anterior) {
  console.log("Descargando página: " + pagina_actual, pasos);
  obtener_pagina(pagina_actual)
    .then((response) => {
      const { document } = linkedom.parseHTML(response.data);

      // El orden es importante por que eliminamos elementos
      // del documento.
      const _capitulo = obtener_capitulo(document);
      const _libro = obtener_titulo_libro(document);
      const _testamento = obtener_testamento(document);

      console.log({ _testamento, _libro, _capitulo });

      if (!(_testamento in biblia)) biblia[_testamento] = {};
      const testamento = biblia[_testamento];

      if (!(_libro in testamento)) testamento[_libro] = {};
      const libro = testamento[_libro];

      libro[_capitulo] = obtener_contenido_capitulo({
        _capitulo,
        _libro,
        _testamento,
        document,
      });

      pasos++;

      const siguiente_pagina = obtener_siguiente_pagina(document);
      if (siguiente_pagina === pagina_anterior) {
        fs.writeFileSync(
          "documentos/biblia.json",
          JSON.stringify(biblia, null, 4),
          "utf-8"
        );
        generar_estructura_tipo_puntos();
      } else ejecutar_proceso(siguiente_pagina, pagina_actual);
    })
    .catch((_) => console.log("[ERROR]=>", _));
}

function generar_punto(datos) {
  const libro = datos.k_libro_abr;
  const capitulo = datos.k_capitulo;
  let versiculo = datos.versiculo.versiculo;
  console.log(datos.versiculo);

  try {
    versiculo = parseInt(versiculo);
  } catch (error) {}

  const punto = {
    consecutivo: "",
    contenido: "",
    referencias: [],
    biblia: {
      versiculo,
      capitulo,
      libro: datos.k_libro,
      index_general: datos.index_general,
    },
  };

  punto.consecutivo = `${libro} ${capitulo}, ${versiculo}`;
  punto.contenido = datos.versiculo.contenido;

  return punto;
}

// ejecutar_proceso(pagina_actual, pagina_anterior);
function generar_estructura_tipo_puntos() {
  const BIBLIA = require("./documentos/biblia.json");
  const ABREVIATURAS = require("./abreviaciones_biblia.json");
  const puntos = [];
  let index_general = 0;

  for (const k_testamento in BIBLIA) {
    const testamento = BIBLIA[k_testamento];

    for (const k_libro in testamento) {
      const libro = testamento[k_libro];
      const abr = ABREVIATURAS.find((a) => a.libro === k_libro);

      for (const k_capitulo in libro) {
        const capitulo = libro[k_capitulo];

        for (const versiculo of capitulo.versiculos) {
          const punto = generar_punto({
            k_testamento,
            k_libro,
            k_libro_abr: abr.abreviacion,
            k_capitulo,
            versiculo,
            index_general,
          });
          puntos.push(punto);
          index_general++;

        }
      }
    }
  }

  fs.writeFileSync(
    "documentos/biblia_en_puntos.json",
    JSON.stringify(puntos),
    "utf-8"
  );
}

// generar_estructura_tipo_puntos();

function generar_indice()
{ 
  
  
}
