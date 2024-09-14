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
  fetch_page(url: string): Promise<{ data: unknown; url: string }> {
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

  generar_indice(docLimpio: TrasnportData[]) {
    this.general_service.log("[+] Generando indice");
    const indice = require("./generacion_de_indices").generar_indice(docLimpio);

    // No queremos nulos.

    for (const key_indice in indice) {
      const sub_indice = indice[key_indice];

      for (const key in sub_indice) {
        const valor = sub_indice[key];

        if (valor == "null") {
          this.general_service.log([
            "eliminando: ",
            key,
            "valor; ",
            indice[key],
          ]);
          delete sub_indice[key];
        }
      }
    }

    fs.writeFileSync(
      `${this.get_download_data().local_directory}/${
        this.get_download_data().local_directory
      }.index.json`,
      JSON.stringify(indice),
      "utf-8"
    );
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
