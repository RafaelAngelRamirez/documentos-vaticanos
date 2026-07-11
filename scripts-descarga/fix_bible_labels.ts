/**
 * Rebuild biblia.consecutivo_versiculo labels using corrected book-codes.json.
 * Does not re-scrape; only rewrites citation strings and re-syncs corpus.
 *
 * Usage: npx ts-node --transpile-only fix_bible_labels.ts
 */
import fs from "fs";
import path from "path";
import bookCodes from "./models/data/book-codes.json";
import type { BookCodeEntry } from "./src/refs/ref-parser";

const REPO = path.resolve(__dirname, "..");
const PATHS = [
  path.join(
    REPO,
    "documentos/corpus/documents/bible-pueblo-de-dios-es/content.json",
  ),
  path.join(
    REPO,
    "frontend/src/assets/corpus/documents/bible-pueblo-de-dios-es/content.json",
  ),
  path.join(__dirname, "documentos/biblia_pueblo_de_Dios.json"),
];

interface Unit {
  consecutivo: string;
  contenido: string;
  referencias?: unknown[];
  biblia?: {
    consecutivo_versiculo: string;
    versiculo: number;
    capitulo: string;
    libro: string;
    index_general: string;
  };
  index_array?: number;
}

function main() {
  const books = bookCodes as BookCodeEntry[];
  const codeBySlug = new Map(books.map((b) => [b.bookSlug, b.bookCode]));

  let primary: Unit[] | null = null;
  for (const p of PATHS) {
    if (!fs.existsSync(p)) continue;
    primary = JSON.parse(fs.readFileSync(p, "utf8")) as Unit[];
    break;
  }
  if (!primary) throw new Error("No bible content found");

  let fixed = 0;
  let unknown = 0;
  const unknownSlugs = new Set<string>();

  for (const u of primary) {
    if (!u.biblia) continue;
    const slug = u.biblia.libro;
    const code = codeBySlug.get(slug);
    if (!code) {
      unknown++;
      unknownSlugs.add(slug);
      continue;
    }
    const ch = u.biblia.capitulo;
    const v = u.biblia.versiculo;
    const next = `${code} ${ch}, ${v}`;
    if (u.biblia.consecutivo_versiculo !== next) {
      u.biblia.consecutivo_versiculo = next;
      fixed++;
    }
  }

  const payload = JSON.stringify(primary);
  for (const p of PATHS) {
    if (!fs.existsSync(path.dirname(p))) continue;
    fs.writeFileSync(p, payload, "utf8");
    console.log(`[✓] ${p}`);
  }

  console.log(
    JSON.stringify(
      {
        units: primary.length,
        labelsRewritten: fixed,
        unknownSlugs: [...unknownSlugs],
        unknownCount: unknown,
      },
      null,
      2,
    ),
  );
}

main();
