/**
 * Offline search index builder — same shape as reindex_offline / GeneralDownload.
 */
import type { TrasnportData } from "../../models/transport_data.model";
import type { CorpusIndex } from "../../models/corpus.model";

function eliminar_diacriticos(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(
      /([^n\u0300-\u036f]|n(?!\u0303(?![\u0300-\u036f])))[\u0300-\u036f]+/gi,
      "$1",
    )
    .normalize();
}

function eliminar_caracteres_innecesarios_para_indice(texto: string): string {
  return texto
    .replace(/[,"\.«»“”:;!¡¿?—']/gi, "")
    .replace(/\( \[\+\[\d*\]\+\] \)/gi, "")
    .replace(/\s/gi, "###")
    .replace(/#{3,21}/gi, " ")
    .replace(/[\[\]”]/gi, "")
    .replace(/[-\(\)\*\/`‘–…]/gi, "")
    .trim();
}

function eliminar_consecutivo_de_punto(
  texto: string,
  consecutivo: string,
): string {
  return texto.replace(consecutivo + " ", "");
}

export function buildIndex(documento: TrasnportData[]): CorpusIndex {
  if (!documento) throw new Error("No se recibio ningún documento");

  const indice: Record<string, Set<number> | number[]> = {};
  const indice_por_punto: Record<number, number | null> = {};
  let i = -1;

  for (const punto of documento) {
    let modificado = punto.contenido ?? "";
    modificado = eliminar_diacriticos(modificado);
    modificado = eliminar_caracteres_innecesarios_para_indice(modificado);
    modificado = modificado.toLowerCase();
    modificado = eliminar_consecutivo_de_punto(modificado, punto.consecutivo);
    i++;

    if (punto.consecutivo !== "no-encontrado") {
      const n = parseInt(punto.consecutivo, 10);
      if (!Number.isNaN(n)) indice_por_punto[i] = n;
    }

    if (modificado.length === 0) continue;

    modificado.split(" ").forEach((palabra) => {
      if (!palabra) return;
      if (!Object.prototype.hasOwnProperty.call(indice, palabra)) {
        indice[palabra] = new Set<number>();
      }
      (indice[palabra] as Set<number>).add(i);
    });
  }

  for (const k of Object.keys(indice)) {
    indice[k] = [...(indice[k] as Set<number>)];
  }

  return {
    indice: indice as CorpusIndex["indice"],
    indice_por_punto: indice_por_punto as CorpusIndex["indice_por_punto"],
  };
}
