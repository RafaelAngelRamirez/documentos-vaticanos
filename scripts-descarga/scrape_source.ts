/**
 * Multi-source scrape CLI.
 *
 * Usage:
 *   npx ts-node --transpile-only scrape_source.ts --source lg
 *   npm run scrape -- --source lg
 *   npm run scrape:lg
 *   npm run scrape:lg -- --offline          # use fixtures/lg-es/source.html
 *   npm run scrape:lg -- --fixture /path/to.html
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

function parseArgs(argv: string[]): {
  source?: string;
  offline: boolean;
  fixture?: string;
  skipWrite: boolean;
  list: boolean;
  help: boolean;
} {
  const out = {
    source: undefined as string | undefined,
    offline: false,
    fixture: undefined as string | undefined,
    skipWrite: false,
    list: false,
    help: false,
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
  }
  return out;
}

function printHelp(): void {
  console.log(`scrape_source — multi-source Vatican document scraper

Options:
  --source, -s <id>   Source id from config/sources.json (e.g. lg)
  --offline           Prefer fixture HTML (no network)
  --fixture <path>    Explicit HTML file (implies offline for that fetch)
  --skip-write        Parse only; do not write corpus
  --list              List configured sources
  --help              This help

Examples:
  npm run scrape:lg
  npm run scrape -- --source lg --offline
  npm run scrape -- --source lg --fixture fixtures/lg-es/source.html

Legacy (unchanged):
  npm run biblia
  npm run catecismo

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

async function loadPageHtml(
  url: string,
  config: SourceConfig,
  ctx: AdapterContext,
): Promise<{ html: string; from: "network" | "fixture" }> {
  if (ctx.fixtureAbsPath && fs.existsSync(ctx.fixtureAbsPath)) {
    return {
      html: fs.readFileSync(ctx.fixtureAbsPath, "utf-8"),
      from: "fixture",
    };
  }
  if (ctx.offline) {
    const fix = resolveFixturePath(config);
    if (!fix) {
      throw new Error(
        `Offline mode but no fixture for ${config.id}. ` +
          `Expected ${config.fixturePath ?? "(none configured)"} or --fixture`,
      );
    }
    return { html: fs.readFileSync(fix, "utf-8"), from: "fixture" };
  }
  const html = await fetchHtml(url);
  return { html, from: "network" };
}

async function scrapeOne(config: SourceConfig, args: ReturnType<typeof parseArgs>) {
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

  const ctx: AdapterContext = {
    offline: args.offline || Boolean(args.fixture),
    fixtureAbsPath: args.fixture
      ? path.isAbsolute(args.fixture)
        ? args.fixture
        : path.join(ROOT, args.fixture)
      : undefined,
  };

  let urls =
    (await adapter.expandSeeds?.(config.seedUrls, config, ctx)) ??
    config.seedUrls;
  if (!urls.length) {
    throw new Error(`No URLs to scrape for source ${config.id}`);
  }

  console.log(`[+] source=${config.id} adapter=${adapter.id}`);
  console.log(`[+] corpusDocId=${config.corpusDocId}`);
  console.log(`[+] urls (${urls.length}): ${urls.join(", ")}`);

  let allUnits: TrasnportData[] = [];
  const allHeadings: string[] = [];

  for (const url of urls) {
    console.log(`[+] fetch ${url}`);
    const { html, from } = await loadPageHtml(url, config, ctx);
    console.log(`[i] loaded ${html.length} chars via ${from}`);

    // Cache network HTML as fixture for offline re-runs
    if (from === "network" && config.fixturePath) {
      saveFixture(config.fixturePath, html);
    }

    const parsed = await adapter.parsePage(html, url, config, ctx);
    console.log(
      `[i] parsed units=${parsed.units.length}` +
        (parsed.headings?.length
          ? ` headings=${parsed.headings.length}`
          : ""),
    );
    if (parsed.headings?.length) {
      allHeadings.push(...parsed.headings);
      console.log(`[i] sample headings: ${parsed.headings.slice(0, 4).join(" | ")}`);
    }
    allUnits.push(...parsed.units);

    if (parsed.discoveredUrls?.length) {
      for (const u of parsed.discoveredUrls) {
        if (!urls.includes(u)) urls.push(u);
      }
    }
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

  console.log(`[+] final units: ${allUnits.length}`);
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

  if (args.skipWrite) {
    console.log("[i] --skip-write: not writing corpus");
    return;
  }

  const result = writeCorpusDocument(config, allUnits);
  console.log(
    `[✓] wrote ${result.unitCount} units, ${result.termCount} index terms`,
  );
  console.log(
    `[i] next: npm run resolve:refs  # link CIC → ${config.docCode ?? config.id}`,
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
