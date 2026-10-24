/**
 * Multi-source scrape CLI.
 *
 * Usage:
 *   npx ts-node --transpile-only scrape_source.ts --source lg
 *   npm run scrape -- --source lg
 *   npm run scrape:cds
 *   npm run scrape:cdc
 *   npm run scrape -- --source cds --offline
 *   npm run scrape -- --source cds --force          # re-scrape even if unitCount low
 *
 * Re-scrape is idempotent: same corpusDocId overwrites content/index/meta and
 * merges a single entry into manifest.json (no duplicates).
 *
 * Does not replace `npm run biblia` / `npm run catecismo` (legacy adapters).
 */
import fs from "fs";
import path from "path";
import axios, { AxiosResponse } from "axios";
import {
  getAdapterForSource,
  getSourceConfig,
  listAdapterIds,
  loadSourcesFile,
} from "./src/adapters/registry";
import type { AdapterContext, SourceConfig } from "./src/adapters/types";
import type { TrasnportData } from "./models/transport_data.model";
import {
  saveFixture,
  writeCorpusDocument,
} from "./src/pipeline/write_corpus";

const ROOT = path.resolve(__dirname);

/** Default concurrent fetches for multi-page sources. */
const DEFAULT_CONCURRENCY = 4;
/** Abort write when unitCount < this fraction of expectedUnitCount (unless --force). */
const MIN_EXPECTED_RATIO = 0.8;

function parseArgs(argv: string[]): {
  source?: string;
  offline: boolean;
  fixture?: string;
  skipWrite: boolean;
  list: boolean;
  help: boolean;
  force: boolean;
  concurrency: number;
} {
  const out = {
    source: undefined as string | undefined,
    offline: false,
    fixture: undefined as string | undefined,
    skipWrite: false,
    list: false,
    help: false,
    force: false,
    concurrency: DEFAULT_CONCURRENCY,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--source" || a === "-s") out.source = argv[++i];
    else if (a.startsWith("--source=")) out.source = a.slice("--source=".length);
    else if (a === "--offline") out.offline = true;
    else if (a === "--fixture") out.fixture = argv[++i];
    else if (a.startsWith("--fixture=")) out.fixture = a.slice("--fixture=".length);
    else if (a === "--skip-write") out.skipWrite = true;
    else if (a === "--list") out.list = true;
    else if (a === "--help" || a === "-h") out.help = true;
    else if (a === "--force" || a === "--rescrape") out.force = true;
    else if (a === "--concurrency" || a === "-c") {
      out.concurrency = Math.max(1, parseInt(argv[++i], 10) || DEFAULT_CONCURRENCY);
    } else if (a.startsWith("--concurrency=")) {
      out.concurrency = Math.max(
        1,
        parseInt(a.slice("--concurrency=".length), 10) || DEFAULT_CONCURRENCY,
      );
    }
  }
  return out;
}

function printHelp(): void {
  console.log(`scrape_source — multi-source Vatican document scraper

Options:
  --source, -s <id>     Source id from config/sources.json (e.g. cds, cdc, lg)
  --offline             Prefer fixture HTML (no network)
  --fixture <path>      Explicit HTML file or fixture dir (implies offline)
  --skip-write          Parse only; do not write corpus
  --force, --rescrape   Re-scrape / write even if unitCount << expectedUnitCount
  --concurrency, -c N   Parallel fetches for multi-page sources (default ${DEFAULT_CONCURRENCY})
  --list                List configured sources
  --help                This help

Re-scrape:
  Running the same --source again overwrites documents/<corpusDocId>/ and
  upserts a single manifest entry (no duplicates). Fixtures refresh on live fetch.

Examples:
  npm run scrape:cds
  npm run scrape:cdc
  npm run scrape -- --source cds --offline
  npm run scrape -- --source cdc --force
  npm run scrape -- --source lg --offline

Legacy (unchanged):
  npm run biblia
  npm run catecismo          # re-scrape Catechism (cic-es)

Adapters: ${listAdapterIds().join(", ")}
`);
}

async function fetchHtml(url: string): Promise<string> {
  // Vatican pages are often iso-8859-1 with HTML entities; latin1 + linkedom is reliable.
  // Prefer curl when available — axios sometimes truncates large vatican.va responses.
  try {
    const { execFileSync } = require("child_process") as typeof import("child_process");
    const buf = execFileSync(
      "curl",
      [
        "-sL",
        "--max-time",
        "90",
        "-A",
        "Mozilla/5.0 documentos-vaticanos-scraper/0.1",
        url,
      ],
      { maxBuffer: 20 * 1024 * 1024 },
    );
    if (buf && buf.length > 1000) {
      return Buffer.from(buf).toString("latin1");
    }
  } catch {
    /* fall through to axios */
  }

  const res: AxiosResponse<ArrayBuffer> = await axios.get(url, {
    responseType: "arraybuffer",
    headers: {
      "User-Agent":
        "Mozilla/5.0 documentos-vaticanos-scraper/0.1 (+research)",
      Accept: "text/html,application/xhtml+xml",
    },
    timeout: 90_000,
    maxContentLength: 20 * 1024 * 1024,
    maxBodyLength: 20 * 1024 * 1024,
  });
  const buf = Buffer.from(res.data);
  return buf.toString("latin1");
}

function resolveFixturePath(
  config: SourceConfig,
  cliFixture?: string,
): string | null {
  if (cliFixture) {
    return path.isAbsolute(cliFixture)
      ? cliFixture
      : path.join(ROOT, cliFixture);
  }
  if (config.fixturePath) {
    const abs = path.join(ROOT, config.fixturePath);
    if (fs.existsSync(abs)) return abs;
  }
  return null;
}

/** Map a page URL to a multi-page fixture file under fixture dir. */
function fixtureFileForUrl(fixtureRoot: string, url: string): string | null {
  if (!fixtureRoot || !fs.existsSync(fixtureRoot)) return null;
  const base = path.basename(url.split("?")[0].split("#")[0]);
  if (fs.statSync(fixtureRoot).isFile()) {
    // Single-file fixture (CDS / LG style)
    return fixtureRoot;
  }
  // Directory layout: fixtures/cdc-es/index.html + pages/*.html
  const candidates = [
    path.join(fixtureRoot, base),
    path.join(fixtureRoot, "pages", base),
    path.join(fixtureRoot, "source.html"),
    path.join(fixtureRoot, "index.html"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}

function savePageFixture(config: SourceConfig, url: string, html: string): void {
  if (!config.fixturePath) return;
  const root = path.isAbsolute(config.fixturePath)
    ? config.fixturePath
    : path.join(ROOT, config.fixturePath);

  // Single-page sources: fixturePath points at a .html file
  if (config.fixturePath.endsWith(".html") || config.fixturePath.endsWith(".htm")) {
    saveFixture(config.fixturePath, html);
    return;
  }

  // Multi-page: directory with index.html + pages/<basename>
  fs.mkdirSync(path.join(root, "pages"), { recursive: true });
  const base = path.basename(url.split("?")[0].split("#")[0]);
  if (/cic_index|index_sp|index\.html/i.test(base) || /cic_index/i.test(url)) {
    fs.writeFileSync(path.join(root, "index.html"), html, "utf-8");
    console.log(`[✓] fixture → ${path.join(root, "index.html")}`);
    return;
  }
  if (/^fixture:\/\//.test(url)) return;
  const pagePath = path.join(root, "pages", base);
  fs.writeFileSync(pagePath, html, "utf-8");
  // Quiet per-page logs for large multi-page scrapes
}

async function loadPageHtml(
  url: string,
  config: SourceConfig,
  ctx: AdapterContext,
): Promise<{ html: string; from: "network" | "fixture" }> {
  // fixture://basename used by offline multi-page expand
  if (url.startsWith("fixture://")) {
    const name = url.slice("fixture://".length);
    const root = resolveFixturePath(config) || "";
    const file = fixtureFileForUrl(root, name) || path.join(root, "pages", name);
    if (!fs.existsSync(file)) {
      throw new Error(`Offline fixture missing for ${url}: ${file}`);
    }
    return { html: fs.readFileSync(file, "utf-8"), from: "fixture" };
  }

  if (ctx.fixtureAbsPath && fs.existsSync(ctx.fixtureAbsPath)) {
    const abs = ctx.fixtureAbsPath;
    if (fs.statSync(abs).isFile()) {
      return {
        html: fs.readFileSync(abs, "utf-8"),
        from: "fixture",
      };
    }
    const mapped = fixtureFileForUrl(abs, url);
    if (mapped) {
      return { html: fs.readFileSync(mapped, "utf-8"), from: "fixture" };
    }
  }

  if (ctx.offline) {
    const fix = resolveFixturePath(config);
    if (!fix) {
      throw new Error(
        `Offline mode but no fixture for ${config.id}. ` +
          `Expected ${config.fixturePath ?? "(none configured)"} or --fixture`,
      );
    }
    const mapped = fixtureFileForUrl(fix, url);
    if (!mapped) {
      throw new Error(
        `Offline fixture not found for URL ${url} under ${fix}`,
      );
    }
    return { html: fs.readFileSync(mapped, "utf-8"), from: "fixture" };
  }

  const html = await fetchHtml(url);
  return { html, from: "network" };
}

/** Simple promise pool. */
async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  const n = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}

async function scrapeOne(
  config: SourceConfig,
  args: ReturnType<typeof parseArgs>,
) {
  const adapter = getAdapterForSource(config);

  if (!adapter.supportsLiveScrape) {
    const legacy = config.legacyScript
      ? `npm run ${config.legacyScript}`
      : "(no legacy script configured)";
    console.error(
      `[!] Source "${config.id}" is not wired for scrape_source live pipeline.\n` +
        `    Use legacy script: ${legacy}\n` +
        `    Notes: ${config.notes ?? ""}`,
    );
    process.exitCode = 2;
    return;
  }

  // Only bind fixtureAbsPath when offline / explicit --fixture.
  // Live scrapes must hit the network and refresh fixtures (true re-scrape).
  const offline = args.offline || Boolean(args.fixture);
  let fixtureAbsPath: string | undefined;
  if (args.fixture) {
    fixtureAbsPath = path.isAbsolute(args.fixture)
      ? args.fixture
      : path.join(ROOT, args.fixture);
  } else if (offline && config.fixturePath) {
    fixtureAbsPath = path.join(ROOT, config.fixturePath);
  }

  const ctx: AdapterContext = {
    offline,
    fixtureAbsPath,
  };

  console.log(`[+] source=${config.id} adapter=${adapter.id}`);
  console.log(`[+] corpusDocId=${config.corpusDocId}`);
  if (args.force) console.log(`[+] force/rescrape enabled`);

  let urls =
    (await adapter.expandSeeds?.(config.seedUrls, config, ctx)) ??
    config.seedUrls;
  if (!urls.length) {
    throw new Error(`No URLs to scrape for source ${config.id}`);
  }

  // Dedup URLs
  urls = Array.from(new Set(urls.map((u) => u.split("#")[0])));
  console.log(`[+] expand → ${urls.length} URL(s)`);

  let allUnits: TrasnportData[] = [];
  const allHeadings: string[] = [];
  let fetched = 0;
  let parseErrors = 0;

  const processUrl = async (url: string, index: number) => {
    try {
      const { html, from } = await loadPageHtml(url, config, ctx);
      if (from === "network" && config.fixturePath) {
        savePageFixture(config, url, html);
      }
      const parsed = await adapter.parsePage(html, url, config, ctx);
      fetched++;
      if (urls.length <= 5 || (index + 1) % 25 === 0 || index === urls.length - 1) {
        console.log(
          `[i] ${index + 1}/${urls.length} units+=${parsed.units.length} via ${from}`,
        );
      }
      return parsed;
    } catch (err) {
      parseErrors++;
      console.warn(
        `[warn] fetch/parse failed (${url}): ${(err as Error).message}`,
      );
      return { units: [] as TrasnportData[], headings: [] as string[] };
    }
  };

  const concurrency =
    urls.length > 1 && !ctx.offline ? args.concurrency : 1;
  const parsedPages = await mapPool(urls, concurrency, processUrl);

  for (const parsed of parsedPages) {
    if (parsed.headings?.length) allHeadings.push(...parsed.headings);
    allUnits.push(...parsed.units);
  }

  if (adapter.finalize) {
    allUnits = await adapter.finalize(allUnits, config, ctx);
  }

  // Dedupe by consecutivo (first wins) after multi-page merge
  const seen = new Set<string>();
  allUnits = allUnits.filter((u) => {
    if (u.consecutivo === "no-encontrado") return true;
    if (seen.has(u.consecutivo)) return false;
    seen.add(u.consecutivo);
    return true;
  });

  console.log(
    `[+] final units: ${allUnits.length}` +
      (parseErrors ? ` (errors=${parseErrors})` : ""),
  );
  if (allUnits[0]) {
    console.log(
      `[i] first: §${allUnits[0].consecutivo} ${allUnits[0].contenido.slice(0, 80)}…`,
    );
  }
  if (allUnits.length) {
    const last = allUnits[allUnits.length - 1];
    console.log(
      `[i] last:  §${last.consecutivo} ${last.contenido.slice(0, 80)}…`,
    );
  }

  // Quality gate vs expectedUnitCount
  if (
    config.expectedUnitCount &&
    allUnits.length < config.expectedUnitCount * MIN_EXPECTED_RATIO
  ) {
    const msg =
      `unitCount ${allUnits.length} < ${MIN_EXPECTED_RATIO * 100}% of expected ${config.expectedUnitCount}`;
    if (!args.force && !args.skipWrite) {
      console.error(`[!] abort write: ${msg}. Use --force to write anyway.`);
      process.exitCode = 3;
      return;
    }
    console.warn(`[warn] ${msg} (continuing due to --force or --skip-write)`);
  }

  if (args.skipWrite) {
    console.log("[i] --skip-write: not writing corpus");
    return;
  }

  const result = writeCorpusDocument(config, allUnits);
  console.log(
    `[✓] wrote ${result.unitCount} units, ${result.termCount} index terms`,
  );
  console.log(
    `[i] next: npm run resolve:refs  # link refs → ${config.docCode ?? config.id}`,
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const sourcesFile = loadSourcesFile();

  if (args.list) {
    console.log("Configured sources:");
    for (const s of sourcesFile.sources) {
      console.log(
        `  - ${s.id} → ${s.corpusDocId} (adapter=${s.adapter}` +
          (s.legacyScript ? `, legacy=${s.legacyScript}` : "") +
          (s.expectedUnitCount ? `, expected≈${s.expectedUnitCount}` : "") +
          `)`,
      );
    }
    return;
  }

  if (!args.source) {
    printHelp();
    process.exitCode = 1;
    return;
  }

  const config = getSourceConfig(args.source, sourcesFile);
  await scrapeOne(config, args);
}

main().catch((err) => {
  console.error("[ERROR]", err?.message ?? err);
  process.exitCode = 1;
});
