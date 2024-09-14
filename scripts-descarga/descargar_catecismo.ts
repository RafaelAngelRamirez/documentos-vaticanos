import { DonwloadData, GeneralDownload } from "./general_download";
import { GeneralService } from "./services/services";
import fs from "fs";

import cliProgress from "cli-progress";
import { CatechismArquetype } from "./models/catechism-arquetype.model";
import { TrasnportData } from "./models/transport_data.model";

export class Catechism extends GeneralDownload {
  log = GeneralService.log;
  urls: (string | undefined)[] = [];

  get_download_data(): DonwloadData {
    return {
      url_to_donwload: "https://www.vatican.va/archive/catechism_sp",
      file_name: "catecismo",
      local_directory: "documentos",
      document_name: "catecismo",
    };
  }

  cli_progress_bar = new cliProgress.SingleBar(
    {
      format: "{bar} | {percentage}% | ETA: {eta}s | {fileName}",
    },
    cliProgress.Presets.legacy
  );

  totalDePuntos = 2865;
  // Cached clean document
  documento: CatechismArquetype[] = [];
  urlsRegistro: string[] = [];

  execute_download(data: DonwloadData): void {
    this.log("[ + ] Preparando descarga del Catecismo");

    const indice = this.get_download_data().url_to_donwload + "/index_sp.html";

    // Nos conectamos al indice para empezar todo el merequetengue
    this.log(`[i] Indice: ${indice}`);

    this.fetch_page(indice)
      .then((r) => {
        this.urlsRegistro = this.obtenerIndice(r).filter((x) => x !== undefined);
        this.urls = JSON.parse(JSON.stringify(this.urlsRegistro)) as string[];
        this.log(
          `[ + ] ${this.urlsRegistro.length} entradas del indice para procesarse.`
        );
        this.cli_progress_bar.start(this.urls.length, 0);
        this.obtenerPuntos(this.urls.shift());
      })
      .catch((_) => this.log(["[ERROR]=>", _]));
  }

  obtenerIndice(res_doc_html: {data: string, url:string}) {
    this.log("[ + ] Procesando indice: ");

    // Convertimos el texto en html
    const { document } = require("linkedom").parseHTML(res_doc_html.data);
    // Buscamos unicamente las url que es lo que nos intersa.
    const todasLasUrl = document.querySelectorAll("a") as HTMLAnchorElement[];
    const urlArreglo = Array.from(todasLasUrl);

    // Obtenemos solo las url que contengan esta estructura y eliminamos
    // Las que no nos interesan.
    this.urls = urlArreglo
      // Obtenemos solo el valor de href
      .map((x) => x.href)
      .map((x) => {
        const d = "html#";
        if (!x.includes(d)) return x;
        return x.split("#").shift();
      })
      // Debe estar nombrada como sp
      .filter((x) => x?.includes("_sp"));
    // Quitamos los duplicados
    this.urls = Array.from(new Set(this.urls));

    return [...this.urls];
  }

  /**
   *Obtiene los puntos de cada una de las url obtenidoas en el indice.
   *
   * @param {*} url
   */

  contador = 0;
  obtenerPuntos(url: string | undefined) {
    this.contador++;
    this.cli_progress_bar.update(this.contador, {
      fileName: `Por procesar: ${
        this.urlsRegistro.length - this.contador
      } , URL: ${url}`,
    });
    // Obtenemos una url para evaluarla.
    const nuevaUrl = this.get_download_data().url_to_donwload.concat(`/${url}`);
    // Nos conectamos
    this.fetch_page(nuevaUrl)
      .then((response) => {
        const etiquetas = this.buscarEtiquetaObjetivo(response.data)
          // Limpiamos y reorganizamos

          .map((x) => {
            let consecutivo = this.obtenerConsecutivo(x);
            let contenido = x.innerText;

            return {
              consecutivo,
              contenido,
            };
          });

        this.documento.push(...etiquetas);
        if (this.urls.length) this.obtenerPuntos(this.urls?.shift());
        else this.terminar(this.documento);
      })
      .catch((_) => this.log(_));
  }

  buscarEtiquetaObjetivo(htmlString: string) {
    const { document } = require("linkedom").parseHTML(htmlString);
    return document.querySelectorAll("p") as HTMLParagraphElement[];
  }

  obtenerConsecutivo(etiqueta: {
    querySelector: (arg0: string) => { (): any; new (): any; innerText: any };
  }) {
    //Los consecutivos son los puntos con los que se documenta
    // el texto y por tanto debe ser un digito
    let consecutivo = etiqueta.querySelector("b")?.innerText;
    if (isNaN(consecutivo) || !consecutivo) return "no-encontrado";
    return consecutivo;
  }

  obtenerDiferenciaDePuntos(doc: any[]) {
    const soloPuntosExistentes = doc
      .map((x: { consecutivo: number }) => x.consecutivo * 1)
      .sort((a: number, b: number) => a - b);
    const masAlto = soloPuntosExistentes[soloPuntosExistentes.length - 1];

    let contador = 1;
    const puntosInexistentes = Array.from(
      Array(this.totalDePuntos),
      () => contador++
    ).filter((x) => !soloPuntosExistentes.includes(x));

    const total = doc.length;
    this.log("[ i ] -----------------------------");
    this.log("[ ! ] Puntos capturados: " + total);
    this.log("[ ! ] Puntos estimados: " + masAlto);
    this.log("[ + ] Total de puntos: " + this.totalDePuntos);
    this.log("[ + ] Puntos inexistentes: " + puntosInexistentes);
    this.log("[ i ] -----------------------------");

    return {
      total,
      masAlto,
      totalDePuntos: this.totalDePuntos,
      puntosInexistentes,
    };
  }

  separarReferencias(doc: CatechismArquetype[]) {
    const regex = /\((.*?)\)/gm;
    return doc.map((x) => {
      // Definimos el objeto referencias

      const transport_data: TrasnportData = {
        contenido: x.contenido,
        referencias: [],
        consecutivo: x.consecutivo + "",
      };

      // Obtenemos todas las posibles referencias ()
      let m: any[] | null;

      do {
        m = regex.exec(x.contenido);
        if (m) {
          transport_data?.referencias?.push({
            descripcion: m[1],
          });
        }
      } while (m);

      let contador = 0;
      transport_data.contenido = transport_data.contenido.replace(
        /\(.*?\)/gm,
        (fullmatch: any, n: any) => `( [+[${contador++}]+] )`
      );

      return transport_data;
    });
  }

  terminar(doc: CatechismArquetype[]) {
    let docLimpio = this.separarReferencias(doc);

    this.cli_progress_bar.stop();

    this.log("[ + ] Escribiendo documentos");
    const data = this.get_download_data();
    this.escribir_fichero({
      documento: docLimpio,
      nombre_fichero_final: data.file_name,
    });
  }
}

new Catechism().donwload();
