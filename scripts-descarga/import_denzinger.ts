/**
 * Import Denzinger-Schönmetzer (Spanish, public domain OCR text).
 *
 * Default source: Internet Archive item denzinger-schonmetzer
 *   https://archive.org/details/denzinger-schonmetzer
 *   Usage: Public Domain Mark 1.0
 *
 *   npx ts-node --transpile-only import_denzinger.ts
 *   npx ts-node --transpile-only import_denzinger.ts --file /path/to/txt
 */
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import type { TrasnportData } from "./models/transport_data.model";
import { writeCorpusDocument } from "./src/pipeline/write_corpus";

const ROOT = path.resolve(__dirname);
const DEFAULT_URL =
  "https://archive.org/download/denzinger-schonmetzer/Denzinger-Schonmetzer_djvu.txt";
const CORPUS_ID = "ds-es";
const TITLE = "Enchiridion symbolorum (Denzinger-Schönmetzer)";
const SHORT = "DS";

function downloadTxt(url: string, dest: string): void {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  console.log(`[+] download ${url}`);
  execFileSync(
    "curl",
    ["-sL", "--max-time", "180", "-A", "Mozilla/5.0 documentos-vaticanos/0.1", "-o", dest, url],
    { stdio: "inherit" },
  );
}

/** Bible / noise prefixes after a bare number (not DS). */
const BIBLE_NOISE =
  /^(Cor|Jn|Jo|Mt|Mc|Lc|Rom|Rm|Gal|Ga|Ef|Eph|Col|Tes|Tim|Tit|Heb|Sant|Pe|Ped|Ap|Apoc|Is|Jer|Ez|Dan|Sal|Prov|Gen|Ex|Lev|Num|Dt|Mac|Sab|Ecl|Job|Os|Am|Miq|Hab|Sof|Ag|Zac|Mal)\b/i;

/**
 * Split OCR text into units by Denzinger numbers.
 * Lines like "3912 Finalmente…" or "105 Y [Calixto]…".
 */
export function parseDenzingerText(raw: string): TrasnportData[] {
  let text = raw
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n");
  text = text.replace(/(\w)-\n(\w)/g, "$1$2");

  // Drop front matter before first "Capítulo"
  const cap = text.search(/Capítulo\s+1\b/i);
  if (cap > 0) text = text.slice(cap);

  const starts: { n: string; idx: number }[] = [];
  const re = /(?:^|\n)\s*(\d{1,4})\s+(?=[A-ZÁÉÍÓÚÑÜ«"“¿¡\(\[])/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const lineStart = m.index + (m[0].startsWith("\n") ? 1 : 0);
    const numMatch = text.slice(lineStart).match(/^\s*(\d{1,4})\s+(\S[\s\S]{0,40})/);
    if (!numMatch) continue;
    const rest = numMatch[2];
    // Skip bible abbreviations: "1 Cor.", "2 Jn"
    if (BIBLE_NOISE.test(rest)) continue;
    // Skip pure page-like tiny fragments when number is 1–3 and rest is too short pattern
    if (parseInt(numMatch[1], 10) < 10 && rest.length < 12 && !/[.!?«"]/.test(rest)) {
      continue;
    }
    const idx = lineStart + numMatch[0].indexOf(numMatch[1]);
    starts.push({ n: numMatch[1], idx });
  }

  const units: TrasnportData[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < starts.length; i++) {
    const { n, idx } = starts[i];
    if (seen.has(n)) continue;
    seen.add(n);
    const end = i + 1 < starts.length ? starts[i + 1].idx : text.length;
    let body = text.slice(idx, end).trim();
    body = body.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    if (body.length < 20) continue;
    units.push({
      consecutivo: n,
      contenido: body,
      referencias: [],
    });
  }

  units.sort((a, b) => parseInt(a.consecutivo, 10) - parseInt(b.consecutivo, 10));
  return units;
}

function parseArgs(argv: string[]): { file?: string; skipWrite: boolean } {
  const out: { file?: string; skipWrite: boolean } = { skipWrite: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--file") out.file = argv[++i];
    else if (argv[i] === "--skip-write") out.skipWrite = true;
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cache = path.join(ROOT, "../documentos/padres-source/raw/ds-es.denzinger.txt");
  // raw under padres is ok for cache; also allow clean path
  const localDefault = path.join(ROOT, "fixtures/ds-es/source.txt");
  let file = args.file;
  if (!file) {
    if (fs.existsSync(localDefault) && fs.statSync(localDefault).size > 10000) {
      file = localDefault;
    } else {
      fs.mkdirSync(path.dirname(localDefault), { recursive: true });
      downloadTxt(DEFAULT_URL, localDefault);
      file = localDefault;
    }
  }
  // also keep cache copy
  try {
    fs.mkdirSync(path.dirname(cache), { recursive: true });
    if (file !== cache) fs.copyFileSync(file, cache);
  } catch {
    /* ignore */
  }

  const raw = fs.readFileSync(file, "utf-8");
  const units = parseDenzingerText(raw);
  console.log(`[i] ${CORPUS_ID}: ${units.length} units from ${file}`);
  if (units.length) {
    console.log(`[i] first: ${units[0].contenido.slice(0, 80).replace(/\n/g, " ")}…`);
    console.log(
      `[i] last: ${units[units.length - 1].contenido.slice(0, 80).replace(/\n/g, " ")}…`,
    );
  }
  if (units.length < 500) {
    console.error(`[!] Too few units (${units.length}); abort write`);
    process.exitCode = 2;
    return;
  }
  if (args.skipWrite) {
    console.log("[i] --skip-write: not writing corpus");
    return;
  }

  const config = {
    id: "ds",
    title: TITLE,
    shortTitle: SHORT,
    kind: "magisterium" as const,
    locale: "es",
    corpusDocId: CORPUS_ID,
    docCode: "DS",
    adapter: "plain_text",
    seedUrls: ["https://archive.org/details/denzinger-schonmetzer"],
    notes:
      "Enchiridion symbolorum (Denzinger-Schönmetzer), texto español. Fuente pública Internet Archive (Public Domain Mark 1.0).",
    sourceNote:
      "Enchiridion symbolorum (Denzinger-Schönmetzer), texto español. Fuente pública Internet Archive (Public Domain Mark 1.0): https://archive.org/details/denzinger-schonmetzer.",
  };

  writeCorpusDocument(config as any, units);
  console.log(`[✓] imported ${CORPUS_ID} (${units.length} units)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
