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
import {
  CANONICAL_CORPUS_ROOT,
  syncDocToAssets,
} from "./src/pipeline/write_corpus";

const BIBLE_ID = "bible-pueblo-de-dios-es";
const CANONICAL_BIBLE = path.join(
  CANONICAL_CORPUS_ROOT,
  "documents",
  BIBLE_ID,
  "content.json",
);
const WORK_COPY = path.join(__dirname, "documentos/biblia_pueblo_de_Dios.json");

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

  const readPath = fs.existsSync(CANONICAL_BIBLE) ? CANONICAL_BIBLE : WORK_COPY;
  if (!fs.existsSync(readPath)) throw new Error("No bible content found");
  const primary = JSON.parse(fs.readFileSync(readPath, "utf8")) as Unit[];

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
  fs.mkdirSync(path.dirname(CANONICAL_BIBLE), { recursive: true });
  fs.writeFileSync(CANONICAL_BIBLE, payload, "utf8");
  console.log(`[✓] ${CANONICAL_BIBLE}`);
  syncDocToAssets(BIBLE_ID);
  if (fs.existsSync(path.dirname(WORK_COPY))) {
    fs.writeFileSync(WORK_COPY, payload, "utf8");
    console.log(`[✓] ${WORK_COPY}`);
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
