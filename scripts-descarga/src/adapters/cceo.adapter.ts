/**
 * Codex Canonum Ecclesiarum Orientalium (CCEO) — multi-page Latin on vatican.va.
 *
 * Spanish full HTML is not published on vatican.va (index stubs only link to LA).
 * Official public text: 3 pages under John Paul II apostolic constitutions.
 *
 * Markup: <b>Can. N</b> - text… (§ continuations may follow).
 */
import fs from "fs";
import path from "path";
import type { TrasnportData } from "../../models/transport_data.model";
import type {
  AdapterContext,
  ParsedPage,
  SourceAdapter,
  SourceConfig,
} from "./types";

const { parseHTML } = require("linkedom");

export const CCEO_ADAPTER_ID = "cceo";

const INDEX_URL =
  "https://www.vatican.va/content/john-paul-ii/la/apost_constitutions/documents/hf_jp-ii_apc_19901018_index-codex-can-eccl-orient.html";
const PAGE_RE = /hf_jp-ii_apc_19901018_codex-can-eccl-orient-(\d+)\.html/i;

function cleanText(raw: string): string {
  return raw
    .replace(/\u00a0/g, " ")
    .replace(/&#xa7;/gi, "§")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function absolutize(href: string, baseUrl: string): string {
  if (!href) return "";
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  if (href.startsWith("//")) return `https:${href}`;
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
}

function normalizePageUrl(url: string): string {
  return url.split("#")[0].split("?")[0];
}

/** Extract unique CCEO page URLs from the Latin index HTML. */
export function expandCceoIndexHtml(
  html: string,
  indexUrl: string = INDEX_URL,
): string[] {
  const { document } = parseHTML(html);
  const links = Array.from(document.querySelectorAll("a[href]")) as Element[];
  const byNum = new Map<number, string>();

  for (const a of links) {
    const href = a.getAttribute("href") || "";
    const m = href.match(PAGE_RE);
    if (!m) continue;
    const n = parseInt(m[1], 10);
    const abs = normalizePageUrl(absolutize(href, indexUrl));
    // Prefer /content/john-paul-ii/la/ paths
    if (!byNum.has(n) || abs.includes("/la/")) {
      byNum.set(n, abs);
    }
  }

  // Fallback: known 3-page layout if index parse fails
  if (byNum.size === 0) {
    for (let n = 1; n <= 3; n++) {
      byNum.set(
        n,
        `https://www.vatican.va/content/john-paul-ii/la/apost_constitutions/documents/hf_jp-ii_apc_19901018_codex-can-eccl-orient-${n}.html`,
      );
    }
  }

  return Array.from(byNum.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, url]) => url);
}

function startCanon(num: string, body: string): TrasnportData {
  const b = cleanText(body);
  return {
    consecutivo: num,
    contenido: b ? `Can. ${num}. ${b}` : `Can. ${num}.`,
    referencias: [],
  };
}

/**
 * Parse one CCEO page: units keyed by canon number.
 *
 * Vatican HTML often packs many canons into a single <p>, separated by
 * <br> and <b>Can. N</b> labels. We split on those bold markers first.
 */
export function parseCceoPageHtml(html: string, pageUrl = ""): ParsedPage {
  const { document } = parseHTML(html);
  const root =
    document.querySelector(".documento") ||
    document.querySelector(".testo") ||
    document.querySelector("#corpo") ||
    document.querySelector("body") ||
    document;

  // Prefer splitting raw HTML of the content root on <b>Can. N</b>
  const rootHtml = (root as Element).innerHTML || html;
  // Normalize br to spaces so § paragraphs join cleanly
  const normalized = rootHtml
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/&nbsp;/gi, " ");

  // Split keeping the Can. N delimiter
  const parts = normalized.split(/(?=<b>\s*Can\.?\s*\d+\s*<\/b>)/i);
  const units: TrasnportData[] = [];
  const headings: string[] = [];
  const seen = new Set<string>();

  for (const part of parts) {
    // Extract bold label
    const label = part.match(/<b>\s*(Can\.?\s*\d+)\s*<\/b>/i);
    if (!label) {
      // leading TOC / titles — strip tags
      const plain = cleanText(
        part.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "),
      );
      if (
        plain &&
        /^(TITULUS|CAPUT|ARTICULUS|CODEX|PRAEFATIO)\b/i.test(plain) &&
        plain.length < 200
      ) {
        headings.push(plain);
      }
      continue;
    }

    const numMatch = label[1].match(/(\d+)/);
    if (!numMatch) continue;
    const num = numMatch[1];
    if (seen.has(num)) continue;
    seen.add(num);

    // Body after the bold label
    const after = part.slice(part.indexOf(label[0]) + label[0].length);
    let body = after
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    body = body.replace(/^[-–.]\s*/, "");
    body = cleanText(body);
    if (!body) continue;
    units.push(startCanon(num, body));
  }

  // Fallback: plain-text scan if bold split failed
  if (units.length < 10) {
    const text = cleanText(
      (root.textContent || "").replace(/\u00a0/g, " "),
    );
    const re = /Can\.?\s*(\d+)\s*[-–.]?\s*/gi;
    const idxs: { n: string; at: number; endLabel: number }[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      idxs.push({ n: m[1], at: m.index, endLabel: m.index + m[0].length });
    }
    for (let i = 0; i < idxs.length; i++) {
      const { n, endLabel } = idxs[i];
      if (seen.has(n)) continue;
      seen.add(n);
      const end = i + 1 < idxs.length ? idxs[i + 1].at : text.length;
      const body = cleanText(text.slice(endLabel, end));
      if (body) units.push(startCanon(n, body));
    }
  }

  // Sort by canon number
  units.sort(
    (a, b) => parseInt(a.consecutivo, 10) - parseInt(b.consecutivo, 10),
  );

  return {
    units,
    headings,
    meta: {
      pageUrl,
      numberedCount: units.length,
      headingCount: headings.length,
    },
  };
}

function loadOfflineIndex(
  config: SourceConfig,
  ctx?: AdapterContext,
): string | null {
  if (ctx?.fixtureAbsPath && fs.existsSync(ctx.fixtureAbsPath)) {
    if (fs.statSync(ctx.fixtureAbsPath).isFile()) {
      return fs.readFileSync(ctx.fixtureAbsPath, "utf-8");
    }
  }
  if (!config.fixturePath) return null;
  const base = path.isAbsolute(config.fixturePath)
    ? config.fixturePath
    : path.join(__dirname, "../../", config.fixturePath);
  const indexPath = fs.existsSync(path.join(base, "index.html"))
    ? path.join(base, "index.html")
    : base;
  if (fs.existsSync(indexPath) && fs.statSync(indexPath).isFile()) {
    return fs.readFileSync(indexPath, "utf-8");
  }
  return null;
}

export const cceoAdapter: SourceAdapter = {
  id: CCEO_ADAPTER_ID,
  supportsLiveScrape: true,

  async expandSeeds(
    seeds: string[],
    config: SourceConfig,
    ctx?: AdapterContext,
  ): Promise<string[]> {
    const seed = seeds[0] || INDEX_URL;

    if (ctx?.offline || ctx?.fixtureAbsPath) {
      const html = loadOfflineIndex(config, ctx);
      if (html) {
        const pages = expandCceoIndexHtml(html, seed);
        const fixtureRoot = path.isAbsolute(config.fixturePath || "")
          ? (config.fixturePath as string)
          : path.join(
              __dirname,
              "../../",
              config.fixturePath || "fixtures/cceo-la",
            );
        const pagesDir = path.join(fixtureRoot, "pages");
        if (fs.existsSync(pagesDir)) {
          const local = fs
            .readdirSync(pagesDir)
            .filter((f) => f.endsWith(".html") && PAGE_RE.test(f))
            .sort((a, b) => {
              const na = parseInt(a.match(PAGE_RE)?.[1] || "0", 10);
              const nb = parseInt(b.match(PAGE_RE)?.[1] || "0", 10);
              return na - nb;
            })
            .map((f) => {
              const match = pages.find((u) => u.endsWith(f));
              return match || `fixture://${f}`;
            });
          if (local.length) {
            console.log(`[cceo] offline expand: ${local.length} page(s)`);
            return local;
          }
        }
        console.log(`[cceo] offline expand from index: ${pages.length} page(s)`);
        return pages.length ? pages : expandCceoIndexHtml("", seed);
      }
      return expandCceoIndexHtml("", seed);
    }

    // Live: fetch index and expand to body pages
    const { execFileSync } = require("child_process") as typeof import("child_process");
    let html = "";
    try {
      const buf = execFileSync(
        "curl",
        [
          "-sL",
          "--max-time",
          "90",
          "-A",
          "Mozilla/5.0 documentos-vaticanos-scraper/0.1",
          seed,
        ],
        { maxBuffer: 10 * 1024 * 1024 },
      );
      html = Buffer.from(buf).toString("utf8");
    } catch (err) {
      throw new Error(
        `CCEO expandSeeds failed to fetch index: ${(err as Error).message}`,
      );
    }

    if (config.fixturePath) {
      const root = path.isAbsolute(config.fixturePath)
        ? config.fixturePath
        : path.join(__dirname, "../../", config.fixturePath);
      fs.mkdirSync(root, { recursive: true });
      fs.writeFileSync(path.join(root, "index.html"), html, "utf-8");
    }

    const pages = expandCceoIndexHtml(html, seed);
    console.log(`[cceo] live expand: ${pages.length} page(s) from index`);
    return pages.length ? pages : expandCceoIndexHtml("", seed);
  },

  parsePage(html: string, pageUrl: string, _config: SourceConfig): ParsedPage {
    if (/index-codex-can-eccl-orient/i.test(pageUrl)) {
      return { units: [], headings: [], meta: { pageUrl, numberedCount: 0 } };
    }
    return parseCceoPageHtml(html, pageUrl);
  },
};
