import { GeneralService } from "./services/services";
import axios, { AxiosResponse } from "axios";
import fs from "fs";
import type { Document } from "linkedom";
const { DOMParser, parseHTML } = require("linkedom");
import { TrasnportData } from "./models/transport_data.model";
import { Biblia } from "./models/biblia.model";
import pkg from "./package.json";
import { ColaDescarga, ColaDescargaItem } from "./models/cola_descarga.model";
import { ConfigDocumento } from "./models/config_documento.model";
import { DocumentoGenerico } from "./models/documento_generico.model";

export class DownloadData {
  url_to_donwload!: string;
  file_name!: string;
  local_directory!: string;
  document_name!: string;
}

export class GeneralDownload {

  cola: ColaDescarga = new ColaDescarga();
  maxTotalLinks: number = 5;
  totalProcessed: number = 0;
  defaultConfig: ConfigDocumento = {
    baseUrl: "https://www.vatican.va",
    selectors: {
      content: "body",
      links: "a[href]",
    },
    linkFilters: {
      includePattern: /vatican\.va/,
    },
    maxDepth: 3,
    documentType: "generic",
  };
  general_service = GeneralService;
  /**
   * Estructura: Antiguo/Nvo testametno > libro > capitulo > {versiuclos:[]}
   * @type {*} */
  document_processed: Biblia = {};
  steps = 0;
  previous_page = "";
  current_page = this.get_download_data().url_to_donwload;

  constructor() {}

  get_config(): ConfigDocumento {
    return this.defaultConfig;
  }

  /****************
   * GENERAL USE. *
   ****************/

  /**
   *Obtiene la pagina que se le pase como url.
   *
   * @param {*} url
   * @returns
   */
  fetch_page(url: string): Promise<{ data: string; url: string }> {
    return new Promise((resolve, reject) => {
      axios
        .get(url)
        .then((respuesta: AxiosResponse) =>
          resolve({ data: respuesta.data, url }),
        )
        .catch((_) => reject(_));
    });
  }

  _clean_special_characters(texto: string) {
    let procesado = texto;
    if (procesado) procesado = procesado.replace("\n", " ");

    return procesado;
  }

  /**
   * Elimina todos los diacriticos menos la Ñ.
   * https://es.stackoverflow.com/questions/62031/eliminar-signos-diacríticos-en-javascript-eliminar-tildes-acentos-ortográficos
   * @param {string} texto
   * @returns El texto sin acentos, diacritos, menos Ñ
   */
  eliminar_diacriticos(texto: string) {
    return texto
      .normalize("NFD")
      .replace(
        /([^n\u0300-\u036f]|n(?!\u0303(?![\u0300-\u036f])))[\u0300-\u036f]+/gi,
        "$1",
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
  eliminar_caracteres_innecesarios_para_indice(texto: string) {
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

  eliminar_consecutivo_de_punto(texto: string, consecutivo: string) {
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
  _generar_indice(documento: TrasnportData[]) {
    if (!documento) throw new Error("No se recibio ningún documento");
    let indice: any = {};
    // Esta es una referencia rápida para encontrar el
    // punto contra el indice del arreglo en que está almacenado.
    // Esto lo hago así principalmente para que en la interfaz
    // obtengamos de manera rápida la ubiación del punto.
    let indice_por_punto: any = {};
    let i = -1;
    for (const punto of documento) {
      let contenido = punto.contenido;
      let modificado = contenido;
      modificado = this.eliminar_diacriticos(modificado);
      modificado =
        this.eliminar_caracteres_innecesarios_para_indice(modificado);
      modificado = modificado.toLowerCase();
      modificado = this.eliminar_consecutivo_de_punto(
        modificado,
        punto.consecutivo,
      );
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

  generar_indice(docLimpio: TrasnportData[]) {
    this.general_service.log("[+] Generando indice");
    const packed = this._generar_indice(docLimpio);

    // No queremos nulos.

    type keyi = keyof typeof packed;
    for (const key_indice in packed) {
      const sub_indice = packed[key_indice as keyi];

      for (const key in sub_indice) {
        const valor = sub_indice[key];

        if (valor == "null") {
          this.general_service.log([
            "eliminando: ",
            key,
            "valor; ",
            packed[key as keyi],
          ]);
          delete sub_indice[key];
        }
      }
    }

    this.escribir_fichero(packed, true);
  }

  escribir_fichero(
    documento: TrasnportData[] | Record<string, unknown> | any,
    is_index = false,
    special_name = "",
    file_format = "json",
  ) {
    const file_name = this.get_download_data().file_name;
    const index_name = is_index ? ".index" : "";
    const special_name_final = special_name ? `.${special_name}` : "";
    const all_name = `${file_name}${index_name}${special_name_final}.${file_format}`;

    const nombre_documento = `documentos/${all_name}`;

    fs.writeFileSync(nombre_documento, JSON.stringify(documento), "utf-8");
  }

  /********************************************
   * THIS SECTIONS IS FOR OVERRIDABLE METHODS *
   ********************************************/

  /**
   * Retrieves the title.
   *
   * @returns The title as a string.
   * @override
   */
  get_title(): string {
    return "+ DESCARGA DE DOCUMENTOS VATICANOS v" + pkg.version;
  }

  /**
   * Retrieves the download data.
   *
   * @returns The download data.
   */
  get_download_data(): DownloadData {
    throw new Error("Method not implemented");
  }

  /**
   * Downloads the specified data.
   *
   * @param data - The data to be downloaded.
   * @throws {Error} - If the method is not implemented.
   */
  execute_download(data: DownloadData) {
    throw new Error("Method not implemented.");
  }

  create_directory(data: DownloadData) {
    if (!fs.existsSync(data.local_directory)) {
      fs.mkdirSync(data.local_directory);
    }
  }

  extract_links(
    document: any,
    currentUrl: string,
    config: ConfigDocumento,
  ): string[] {
    const links: string[] = [];
    const anchors = document.querySelectorAll("a[href]");
    for (const anchor of anchors) {
      const href = anchor.getAttribute("href");
      if (href) {
        let fullUrl = href;
        if (!href.startsWith("http")) {
          fullUrl = new URL(href, currentUrl).href;
        }
        if (
          config.linkFilters.includePattern?.test(fullUrl) &&
          !config.linkFilters.excludePattern?.test(fullUrl)
        ) {
          links.push(fullUrl);
        }
      }
    }
    return [...new Set(links)]; // unique
  }

  async process_pending_links() {
    this.totalProcessed = 0;
    this.general_service.log("Iniciando procesamiento de " + this.cola.size() + " sublinks");
    while (!this.cola.isEmpty()) {
      const item = this.cola.next();
      if (item) {
        this.totalProcessed++;
        if (this.totalProcessed > this.maxTotalLinks) {
          this.general_service.log(`Límite total de ${this.maxTotalLinks} enlaces alcanzado, deteniendo.`);
          break;
        }
        const filename = item.url.replace(/[^a-zA-Z0-9]/g, "_") + ".json";
        const filepath = `${this.get_download_data().local_directory}/${filename}`;
        if (fs.existsSync(filepath)) {
          this.general_service.log(`Documento ya existe, saltando: ${filepath}`);
          continue;
        }
        this.general_service.log(
          `Procesando enlace: ${item.url} (depth: ${item.depth}), cola restante: ${this.cola.size()}`,
        );
        try {
          const { data } = await this.fetch_page(item.url);
          const document = parseHTML(data).document;
          const config = this.get_config();
          this.general_service.log(
            `Documento procesado, enlaces encontrados: ${this.extract_links(document, item.url, config).length}`,
          );
          const newLinks = this.extract_links(
            document,
            item.url,
            config,
          );
          // Crear y guardar documento genérico
          const title = document.querySelector("title")?.textContent?.trim() || "Sin título";
          const content = document.body?.textContent?.trim() || "";
          const doc: DocumentoGenerico = {
            url: item.url,
            title,
            content,
            metadata: {},
            links: newLinks,
            depth: item.depth,
            parentUrl: item.parentUrl
          };
          fs.writeFileSync(filepath, JSON.stringify(doc, null, 2));
          this.general_service.log(`Documento guardado: ${filepath}`);
          for (const link of newLinks) {
            this.cola.add(link, item.depth + 1, item.url);
          }
        } catch (error: any) {
          this.general_service.log(`Error procesando ${item.url}: ${error}`);
        }
        // Rate limiting
        this.general_service.log("Rate limiting: esperando 1s");
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  donwload() {
    const data = this.get_download_data();
    this.general_service.init_banner(this.get_title());
    this.create_directory(data);
    this.execute_download(data);
  }
}
