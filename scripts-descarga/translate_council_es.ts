/**
 * Scaffold / checklist for Spanish council translations.
 * Actual translation text lives in clean/*-es.txt (produced by the agent or editor).
 *
 *   npx ts-node --transpile-only translate_council_es.ts --status
 *   npx ts-node --transpile-only translate_council_es.ts --id nicea-i --from-content
 *
 * --from-content: if clean/*-es.txt missing, copy structure from corpus *-la content.json
 *   as a STUB with [TRADUCIR] markers (not for production import).
 */
import fs from "fs";
import path from "path";

const REPO = path.resolve(__dirname, "..");
const CLEAN = path.join(REPO, "documentos/concilios-source/clean");
const CORPUS = path.join(REPO, "documentos/corpus/documents");
const INVENTORY = path.join(
  REPO,
  "documentos/concilios-source/inventory/councils.json",
);

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i === -1 || i + 1 >= process.argv.length) return undefined;
  return process.argv[i + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function status(): void {
  const inv = JSON.parse(fs.readFileSync(INVENTORY, "utf-8")) as {
    sources: Array<{ id: string; corpusDocId: string | null; status?: string }>;
  };
  let ready = 0;
  let missing = 0;
  for (const s of inv.sources) {
    if (!s.corpusDocId || s.status === "skipped-existing") continue;
    const es = s.corpusDocId.replace(/-la$/, "-es");
    const p = path.join(CLEAN, `${es}.txt`);
    const ok = fs.existsSync(p) && fs.statSync(p).size > 100;
    if (ok) ready++;
    else missing++;
    console.log(
      `${s.id.padEnd(22)} ${ok ? "ES ready" : "ES MISSING"}  ${p}`,
    );
  }
  console.log(`\nready=${ready} missing=${missing}`);
  console.log(
    "Write clean/<id>-es.txt (same blocks as *-la), then: npm run concilios:import-es -- --id <id>",
  );
  console.log(
    "Disclaimer is applied automatically on import (see import_council_es.ts).",
  );
}

function main(): void {
  if (hasFlag("--status") || process.argv.length <= 2) {
    status();
    return;
  }
  console.error(
    "Translations are written as clean/*-es.txt by the editorial/AI pass.\n" +
      "Use --status to see progress. Import with concilios:import-es.",
  );
  process.exit(1);
}

main();
