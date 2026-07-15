/**
 * Vatican.va discovery crawler (BFS, depth-limited).
 *
 * Separate from reading corpus scrapers. Writes:
 *   documentos/crawl/<seedId>/{graph.jsonl,state.json,cache/}
 *   documentos/organs/<seedId>.json
 *   documentos/discoveries/<seedId>-documents.json
 *
 * Usage:
 *   npm run crawl -- --seed romancuria-es --max-depth 2
 *   npm run crawl -- --seed romancuria-es --max-depth 8
 *   npm run crawl -- --seed romancuria-es --max-depth 8 --resume
 *   npm run crawl:update -- --seed romancuria-es
 */
import fs from "fs";
import path from "path";
import type { CrawlSeedsFile } from "./src/crawl/types";
import { runBfs } from "./src/crawl/bfs";

const ROOT = path.resolve(__dirname);
const REPO = path.resolve(__dirname, "..");
const DOCS = path.join(REPO, "documentos");
const SEEDS_PATH = path.join(ROOT, "config", "crawl-seeds.json");

function parseArgs(argv: string[]) {
  const out = {
    seed: "romancuria-es" as string,
    maxDepth: undefined as number | undefined,
    concurrency: undefined as number | undefined,
    resume: false,
    update: false,
    force: false,
    maxPages: undefined as number | undefined,
    list: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--seed" || a === "-s") out.seed = argv[++i];
    else if (a.startsWith("--seed=")) out.seed = a.slice("--seed=".length);
    else if (a === "--max-depth" || a === "-d")
      out.maxDepth = parseInt(argv[++i], 10);
    else if (a.startsWith("--max-depth="))
      out.maxDepth = parseInt(a.slice("--max-depth=".length), 10);
    else if (a === "--concurrency" || a === "-c")
      out.concurrency = parseInt(argv[++i], 10);
    else if (a.startsWith("--concurrency="))
      out.concurrency = parseInt(a.slice("--concurrency=".length), 10);
    else if (a === "--resume") out.resume = true;
    else if (a === "--update") out.update = true;
    else if (a === "--force") out.force = true;
    else if (a === "--max-pages") out.maxPages = parseInt(argv[++i], 10);
    else if (a.startsWith("--max-pages="))
      out.maxPages = parseInt(a.slice("--max-pages=".length), 10);
    else if (a === "--list") out.list = true;
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

function printHelp() {
  console.log(`crawl_source — BFS discovery crawler for vatican.va

Writes separate structures (NOT the reading corpus):
  documentos/crawl/<seedId>/
  documentos/organs/<seedId>.json
  documentos/discoveries/<seedId>-documents.json

Options:
  --seed, -s <id>       Seed id from config/crawl-seeds.json (default romancuria-es)
  --max-depth, -d N     BFS depth (default from seed config, usually 8)
  --concurrency, -c N   Parallel fetches (default 4)
  --resume              Continue from crawl state/queue
  --update              Re-fetch known expandable nodes (hash refresh)
  --force               Re-fetch even if URL already in reading corpus
  --max-pages N         Safety cap on fetched pages this run
  --list                List seeds
  --help

Examples:
  npm run crawl -- --seed romancuria-es --max-depth 2
  npm run crawl -- --seed romancuria-es --max-depth 8
  npm run crawl -- --seed romancuria-es --max-depth 8 --resume
  npm run crawl:update -- --seed romancuria-es

Locale policy: prefer Spanish (es/_sp); other languages cataloged without body fetch.
External hosts: catalog only (no expand).
`);
}

function loadSeeds(): CrawlSeedsFile {
  return JSON.parse(fs.readFileSync(SEEDS_PATH, "utf-8")) as CrawlSeedsFile;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }
  const file = loadSeeds();
  if (args.list) {
    console.log("Crawl seeds:");
    for (const s of file.seeds) {
      console.log(`  - ${s.id}: ${s.url}`);
    }
    return;
  }

  const seed = file.seeds.find((s) => s.id === args.seed);
  if (!seed) {
    console.error(
      `Unknown seed "${args.seed}". Known: ${file.seeds.map((s) => s.id).join(", ")}`,
    );
    process.exitCode = 1;
    return;
  }

  const maxDepth = args.maxDepth ?? file.defaults.maxDepth ?? 8;
  const concurrency = args.concurrency ?? file.defaults.concurrency ?? 4;

  console.log(`[+] crawl seed=${seed.id}`);
  console.log(`[+] url=${seed.url}`);
  console.log(`[+] maxDepth=${maxDepth} concurrency=${concurrency}`);
  console.log(
    `[+] resume=${args.resume} update=${args.update} force=${args.force}`,
  );

  const result = await runBfs({
    seed,
    defaults: file.defaults,
    maxDepth,
    concurrency,
    resume: args.resume,
    update: args.update,
    force: args.force,
    maxPages: args.maxPages,
    docsRoot: DOCS,
    preferLocales: file.defaults.preferLocales || ["es"],
  });

  console.log(
    `[✓] done nodes=${result.nodeCount} fetched=${result.stats.fetched} errors=${result.stats.errors}`,
  );
}

main().catch((err) => {
  console.error("[ERROR]", err?.message ?? err);
  process.exitCode = 1;
});
