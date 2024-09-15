import { GeneralService } from "./services/services";
import axios, { AxiosResponse } from "axios";
import fs from "fs";
import { TrasnportData } from "./models/transport_data.model";
import { Biblia } from "./models/biblia.model";

export class DonwloadData {
  url_to_donwload!: string;
  file_name!: string;
  local_directory!: string;
  document_name!: string;
}

export class GeneralDownload {
  general_service = GeneralService;

  /**
   * Estructura: Antiguo/Nvo testametno > libro > capitulo > {versiuclos:[]}
   * @type {*} */
  document_processed: Biblia = {};
  steps = 0;
  previous_page = "";
  current_page = this.get_download_data().url_to_donwload;

  constructor() {}

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
          resolve({ data: respuesta.data, url })
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
        punto.consecutivo
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
    const indice = this._generar_indice(docLimpio);

    // No queremos nulos.

    type keyi = keyof typeof indice;
    for (const key_indice in indice) {
      const sub_indice = indice[key_indice as keyi];

      for (const key in sub_indice) {
        const valor = sub_indice[key];

        if (valor == "null") {
          this.general_service.log([
            "eliminando: ",
            key,
            "valor; ",
            indice[key as keyi],
          ]);
          delete sub_indice[key];
        }
      }
    }

    this.escribir_fichero(indice.indice, true);
  }

  escribir_fichero(
    documento: TrasnportData[] | any[],
    is_index = false,
    special_name = "",
    file_format = "json"
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
    return (
      "+ DESCARGA DE DOCUMENTOS VATICANOS v" + require("./package.json").version
    );
  }

  /**
   * Retrieves the download data.
   *
   * @returns The download data.
   */
  get_download_data(): DonwloadData {
    throw new Error("Method not implemented");
  }

  /**
   * Downloads the specified data.
   *
   * @param data - The data to be downloaded.
   * @throws {Error} - If the method is not implemented.
   */
  execute_download(data: DonwloadData) {
    throw new Error("Method not implemented.");
  }

  create_directory(data: DonwloadData) {
    if (!fs.existsSync(data.local_directory)) {
      fs.mkdirSync(data.local_directory);
    }
  }

  donwload() {
    const data = this.get_download_data();
    this.general_service.init_banner(this.get_title());
    this.create_directory(data);
    this.execute_download(data);
  }
}
