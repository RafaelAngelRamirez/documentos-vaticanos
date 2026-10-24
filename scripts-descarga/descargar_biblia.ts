import * as fs from "fs";
import axios from "axios";
import { DOMParser, parseHTML } from "linkedom";
import { DownloadData, GeneralDownload } from "./general_download";
import { BibleBook, TrasnportData } from "./models/transport_data.model";
import { AxiosResponse, ResponseType } from "axios";
import { AbreviacionesBiblia } from "./models/abreviaciones_biblia.model";
import { GenerarPuntoBiblia } from "./models/punto-versiculo.model";
import { Biblia, Versiculo } from "./models/biblia.model";
import abreviaciones from "./models/data/abreviaciones_biblia.json";
import { ConfigDocumento } from "./models/config_documento.model";

export class Bible extends GeneralDownload {
  get_download_data(): DownloadData {
    return {
      url_to_donwload: "https://www.vatican.va/archive/ESL0506/__P1.HTM",
      file_name: "biblia_pueblo_de_Dios",
      local_directory: "documentos",
      document_name: "biblia",
    };
  }

  get_config(): ConfigDocumento {
    return {
      baseUrl: "https://www.vatican.va",
      selectors: {
        content: "body",
        links: "a[href]",
        nextPage: "a:contains('Siguiente')" // Assuming next link text
      },
      linkFilters: {
        includePattern: /vatican\.va/,
        excludePattern: /javascript:|mailto:/
      },
      maxDepth: 3,
      documentType: "bible"
    };
  }

  async execute_download(data: any): Promise<void> {
    this.general_service.log(
      "Preparando descarga de Biblia Pueblo de Dios"
    );

    await this.ejecutar_proceso(this.get_download_data().url_to_donwload);
    this.general_service.log("Cola tiene " + this.cola.size() + " enlaces para procesar");
    await this.process_pending_links();
  }

  get_title(): string { return "Biblia Pueblo de Dios"; }

  _formatear_resultado_general(texto: string) {
    return texto.trim().toLowerCase();
  }

  obtener_testamento(document: any) {
    const li = document.querySelector("font > font > ul > li");
    const hijo = li?.querySelector("ul");
    if (hijo) li?.removeChild(hijo);
    return this._formatear_resultado_general(li?.textContent ?? "");
  }

  obtener_titulo_libro(document: any) {
    const ul = document.querySelector("font > font > ul > li > ul >li");

    const hijo = ul?.querySelector("ul");
    if (hijo) ul?.removeChild(hijo);

    return this._formatear_resultado_general(ul?.textContent ?? "");
  }

  obtener_capitulo(document: any) {
    const ul = document.querySelector("font > font > ul > li > ul >li > ul");
    // Las introducciones no tienen este nodo.
    if (!ul) return this._formatear_resultado_general("0");

    return this._formatear_resultado_general(ul?.textContent ?? "");
  }

  versiculo = {
    versiculo: 0,
    contenido: "",
  };

  nuevo_versiculo() {
    return JSON.parse(JSON.stringify(this.versiculo));
  }

  _obtener_contenido_capitulo(datos: BibleBook) {
    const document = datos.document;
    function obtener_versiculo(versiculo: string) {
      // El versiculo más grande es el 176, entonces
      // solo necesitamos comprobar los tres primeros
      // digitos para saber el número.
      let tres_caracteres = versiculo.slice(0, 3);
      try {
        let vers = parseInt(tres_caracteres.trim());
        return vers;
       } catch (error: any) {
        return undefined;
      }
    }

    const versiculos: TrasnportData[] = [];
    Array.from(document.querySelectorAll("p.MsoNormal")).forEach((p) => {
      let contenido = p.textContent ?? "";
      contenido = this._clean_special_characters(contenido);
      contenido = contenido.trim();

      const num_versiculo = obtener_versiculo(contenido);
      // En el caso de los salmos, por algúna extraña razón, en lugar
      // de utilizar un \n para el salto de linea crearon otro objeto
      // p.MsoNormal. Entonces, cuando no tengamos un versiculo válido
      // hay que concatenarlo al anterior.

      contenido = this._clean_special_characters(contenido);
      let _nuevo_vers = this.nuevo_versiculo();
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

  _obtener_contenido_intro(datos: BibleBook) {
    const document = datos.document;
    let enunciado = document.querySelector(".Enunciado")?.textContent ?? "";
    enunciado = this._clean_special_characters(enunciado);

    const v = this.nuevo_versiculo();
    v.versiculo = 0;
    v.contenido = enunciado;

    return [v];
  }

  get_chapter_contains(datos: BibleBook) {
    const transpor_data: TrasnportData[] = [];

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
      this.general_service.log(`[!] ${datos._libro} ES UNA EXEPCIÓN`);
      const v_capitulo = this._obtener_contenido_capitulo(datos);
      transpor_data.push(...v_capitulo);
    } else if (datos._capitulo === "0") {
      const v_intro = this._obtener_contenido_intro(datos);
      transpor_data.push(...v_intro);
    } else {
      const v_capitulo = this._obtener_contenido_capitulo(datos);

      transpor_data.push(...v_capitulo);
    }

    return { versiculos: transpor_data };
  }

  get_next_page(document: any) {
    const a_elemnt = Array.from(document.querySelectorAll("a")).reverse();
    if (!a_elemnt) return null;

    let url = a_elemnt[0].href;

    let ruta = this.get_download_data().url_to_donwload.split("/");
    ruta.pop();
    ruta.push(url);
    url = ruta.join("/");

    return url;
  }

  async ejecutar_proceso(
    pagina_actual: string | null = null,
    pagina_anterior: string | null = null
  ): Promise<void> {
    try {
      this.general_service.log([
        "Descargando página: " + pagina_actual,
        this.steps,
      ]);
      const response = await this.fetch_page(pagina_actual ?? "");
      const { document } = parseHTML(response.data);
      // El orden es importante por que eliminamos elementos
      // del documento.
      const _capitulo = this.obtener_capitulo(document);
      const _libro = this.obtener_titulo_libro(document);
      const _testamento = this.obtener_testamento(document);

      this.general_service.log({ _testamento, _libro, _capitulo });

      if (!(_testamento in this.document_processed))
        this.document_processed[_testamento] = {};
      const testamento = this.document_processed[_testamento];

      if (!(_libro in testamento)) testamento[_libro] = {};
      const libro = testamento[_libro];

      libro[_capitulo] = this.get_chapter_contains({
        _capitulo,
        _libro,
        _testamento,
        document,
      });

      // Extract links
      const links = this.extract_links(document, pagina_actual ?? "", this.get_config());
      for (const link of links) {
        this.cola.add(link, 0, pagina_actual ?? "");
      }

      this.steps++;

      const siguiente_pagina = this.get_next_page(document);
      if (siguiente_pagina === pagina_anterior) {
        // Creates original structure.
        this.escribir_fichero(this.document_processed as any, false, "original_structure");
        this.generar_estructura_tipo_puntos(this.document_processed);
      } else {
        await this.ejecutar_proceso(siguiente_pagina, pagina_actual);
      }
     } catch (error: any) {
      this.general_service.log(["[ERROR]=>", error]);
    }
  }

  generar_punto(datos: GenerarPuntoBiblia) {
    const libro = datos.k_libro_abr;
    const capitulo = datos.k_capitulo;
    let versiculo = parseInt(datos.versiculo.versiculo);

    const punto: TrasnportData = {
      consecutivo: "",
      contenido: "",
      referencias: [],
      biblia: {
        consecutivo_versiculo: `${libro} ${capitulo}, ${versiculo}`,
        versiculo,
        capitulo,
        libro: datos.k_libro,
        index_general: datos.index_general,
      },
    };

    punto.contenido = datos.versiculo.contenido;

    return punto;
  }

  // ejecutar_proceso(pagina_actual, pagina_anterior);

  generar_estructura_tipo_puntos(BIBLIA: Biblia) {
    const NOMBRE_DOCUMENTO = this.get_download_data().document_name;
    const ABREVIATURAS =
      abreviaciones as AbreviacionesBiblia[];
    const puntos: TrasnportData[] = [];
    let index_general = 0;

    for (const k_testamento in BIBLIA) {
      const testamento = BIBLIA[k_testamento];

      for (const k_libro in testamento) {
        const libro = testamento[k_libro];
        const abr = ABREVIATURAS.find((a) => a.libro === k_libro);

        for (const k_capitulo in libro) {
          const capitulo = libro[k_capitulo];

          for (const versiculo of capitulo.versiculos) {
            const punto = this.generar_punto({
              k_testamento,
              k_libro,
              k_libro_abr: abr?.abreviacion ?? "",
              k_capitulo,
              versiculo: versiculo as Versiculo,
              index_general: index_general + "",
            });
            punto.index_array = index_general;
            punto.consecutivo = index_general + ""; //Nescesita ser un string
            puntos.push(punto);
            index_general++;
          }
        }
      }
    }

    this.escribir_fichero(puntos);
    this.generar_indice(puntos);
  }
}

new Bible().donwload();
