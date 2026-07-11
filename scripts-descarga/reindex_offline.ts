/**
 * Offline reindex: rebuilds { indice, indice_por_punto } from existing
 * transport JSON without network. Used by PR0 stabilization.
 *
 * Usage: npx ts-node --transpile-only reindex_offline.ts
 */
import fs from "fs";
import path from "path";

interface TransportUnit {
  consecutivo: string;
  contenido: string;
  referencias?: unknown[];
  biblia?: unknown;
  index_array?: number;
}

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

function generar_indice(documento: TransportUnit[]) {
  if (!documento) throw new Error("No se recibio ningún documento");
  const indice: Record<string, Set<number> | number[]> = {};
  const indice_por_punto: Record<number, number> = {};
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

  return { indice, indice_por_punto };
}

const DOCS = [
  { base: "catecismo", label: "Catecismo" },
  { base: "biblia_pueblo_de_Dios", label: "Biblia" },
];

const root = path.join(__dirname, "documentos");
const frontendAssets = path.join(
  __dirname,
  "..",
  "frontend",
  "src",
  "assets",
  "documentos",
);

for (const doc of DOCS) {
  const inputPath = path.join(root, `${doc.base}.json`);
  const indexPath = path.join(root, `${doc.base}.index.json`);
  console.log(`[+] ${doc.label}: leyendo ${inputPath}`);
  const raw = fs.readFileSync(inputPath, "utf-8");
  const units = JSON.parse(raw) as TransportUnit[];
  console.log(`[+] ${doc.label}: ${units.length} unidades → generando índice`);
  const packed = generar_indice(units);
  const termCount = Object.keys(packed.indice).length;
  const puntoCount = Object.keys(packed.indice_por_punto).length;
  fs.writeFileSync(indexPath, JSON.stringify(packed), "utf-8");
  console.log(
    `[✓] ${doc.label}: términos=${termCount}, puntos_mapeados=${puntoCount} → ${indexPath}`,
  );

  if (fs.existsSync(frontendAssets)) {
    const dest = path.join(frontendAssets, `${doc.base}.index.json`);
    fs.copyFileSync(indexPath, dest);
    // also ensure body json is present
    const bodyDest = path.join(frontendAssets, `${doc.base}.json`);
    const bodySrc = path.join(root, `${doc.base}.json`);
    if (fs.existsSync(bodySrc)) fs.copyFileSync(bodySrc, bodyDest);
    console.log(`[✓] Copiado a frontend: ${dest}`);
  }
}

console.log("[✓] Reindex offline completado");
