/**
 * Código de Derecho Canónico 1983 (CDC) — Spanish multi-page.
 *
 * Seed: cic_index_sp.html → expand to esp/documents/cic_libro*_sp.html only.
 *
 * Canon markup variants:
 *   A) <p><b>1</b> texto…          (classic books)
 *   B) <p><b>Can. 1311 -</b> texto… (Libro VI after Pascite Gregem Dei)
 *
 * One transport unit per canon number; § paragraphs append to the same unit.
 *
 * docCode is CDC (not CIC — CIC is the Catechism in this repo).
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

export const CDC_ADAPTER_ID = "cdc";

const INDEX_BASE = "https://www.vatican.va/archive/cod-iuris-canonici";
const PAGE_PATH_RE = /esp\/documents\/cic_libro[^"'#?\s]+\.html/i;

function cleanText(raw: string): string {
  return raw
    .replace(/\u00a0/g, " ")
    .replace(/&#xa7;/gi, "§")
    .replace(/&#x2013;/gi, "–")
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

/** Extract unique canon page URLs from index HTML. */
export function expandCdcIndexHtml(
  html: string,
  indexUrl: string = `${INDEX_BASE}/cic_index_sp.html`,
): string[] {
  const { document } = parseHTML(html);
  const links = Array.from(document.querySelectorAll("a[href]")) as Element[];
  const found = new Set<string>();

  for (const a of links) {
    const href = a.getAttribute("href") || "";
    if (!PAGE_PATH_RE.test(href)) continue;
    if (/javascript:|mailto:/i.test(href)) continue;
    const abs = normalizePageUrl(absolutize(href, indexUrl));
    if (!/\/esp\/documents\/cic_libro/i.test(abs)) continue;
    if (!/_sp\.html$/i.test(abs)) continue;
    found.add(abs);
  }

  return Array.from(found).sort();
}

/** Match canon id from a <b> label: "1", "1675.", "Can. 1311 -" */
function parseCanonLabel(boldText: string): string | null {
  const t = boldText.trim();
  const mCan = t.match(/^Can\.?\s*(\d+)\s*[-–.]?\s*$/i);
  if (mCan) return mCan[1];
  const mNum = t.match(/^(\d+)\.?\s*$/);
  if (mNum) return mNum[1];
  return null;
}

function startCanon(num: string, body: string): TrasnportData {
  const b = cleanText(body);
  return {
    consecutivo: num,
    contenido: b ? `${num}. ${b}` : `${num}.`,
    referencias: [],
  };
}

/**
 * Parse a single CDC page into canon units.
 * Continuation § paragraphs merge into the last opened canon.
 *
 * Markup variants:
 *   <p><b>1</b> texto
 *   <p><b>1675.</b> texto
 *   <p><b>Can. 1311 -</b> texto
 *   <p>642 Con vigilante…   (bare number + capital)
 *   <p>994&nbsp;&nbsp; Todo… (bare number + nbsp)
 * Mid-paragraph glued canons: "…tiene. 1482 § 1. …" are split when possible.
 */
export function parseCdcPageHtml(html: string, pageUrl = ""): ParsedPage {
  const { document } = parseHTML(html);
  const root =
    document.querySelector("#corpo") ||
    document.querySelector("body") ||
    document;

  const paragraphs = Array.from(root.querySelectorAll("p")) as Element[];
  const units: TrasnportData[] = [];
  const headings: string[] = [];
  let current: TrasnportData | null = null;

  const pushCanon = (num: string, body: string) => {
    current = startCanon(num, body);
    units.push(current);
  };

  for (const p of paragraphs) {
    let text = cleanText(p.textContent || "");
    if (!text) continue;

    const align = p.getAttribute?.("align");
    if (align === "center") {
      headings.push(text.replace(/\s+/g, " ").trim());
      continue;
    }

    if (/^(LIBRO|TÍTULO|TITULO|CAPÍTULO|CAPITULO|PARTE|SECCIÓN|SECCION)\b/i.test(text)) {
      headings.push(text);
      continue;
    }

    const firstB = p.querySelector("b");
    const boldText = firstB ? cleanText(firstB.textContent || "") : "";
    let canonNum = boldText ? parseCanonLabel(boldText) : null;

    // Plain "Can. 1311 - text"
    if (!canonNum) {
      const m = text.match(/^Can\.?\s*(\d+)\s*[-–.]?\s*(.*)$/i);
      if (m) {
        pushCanon(m[1], m[2] || "");
        continue;
      }
    }

    // Bare leading number: "642 Con…" / "994 Todo…" (not list items "1 haya…")
    if (!canonNum) {
      const bare = text.match(/^(\d{1,4})[\s.\u00a0]+(\S[\s\S]*)$/);
      if (bare) {
        const n = bare[1];
        const rest = bare[2];
        const firstChar = rest.charAt(0);
        const looksLikeCanon =
          parseInt(n, 10) >= 100 ||
          /[A-ZÁÉÍÓÚÑÜ«"“§]/.test(firstChar) ||
          rest.startsWith("§");
        if (looksLikeCanon) {
          canonNum = n;
          text = `${n} ${rest}`;
        }
      }
    }

    if (canonNum) {
      let body = text;
      body = body.replace(
        new RegExp(`^Can\\.?\\s*${canonNum}\\s*[-–.]?\\s*`, "i"),
        "",
      );
      body = body.replace(new RegExp(`^${canonNum}\\.?\\s*`), "");
      body = cleanText(body);

      // Split glued following canons: "…texto. 1482 § 1. …"
      const glued = body.match(
        /^(.*?)(?:\.\s+|\s+)(\d{3,4})\s+(§|[\dA-ZÁÉÍÓÚÑ«])/i,
      );
      if (glued && glued[1].length > 20) {
        pushCanon(canonNum, glued[1] + (glued[1].endsWith(".") ? "" : ""));
        // Reprocess remainder as new paragraph text
        const restNum = glued[2];
        const restBody = body.slice(body.indexOf(restNum) + restNum.length);
        pushCanon(restNum, restBody);
        continue;
      }

      pushCanon(canonNum, body);
      continue;
    }

    // Mid-paragraph orphan: previous unit ends and "1482 § 1" appears without <p>
    const mid = text.match(/^(.*?\S)\s+(\d{3,4})\s+(§\s*[\dA-ZÁÉÍÓÚÑ]|[A-ZÁÉÍÓÚÑ«])/);
    if (mid && current && mid[1].length > 30) {
      current.contenido = `${current.contenido}\n${cleanText(mid[1])}`.trim();
      const rest = text.slice(text.indexOf(mid[2]));
      const m2 = rest.match(/^(\d{3,4})\s+([\s\S]+)$/);
      if (m2) {
        pushCanon(m2[1], m2[2]);
        continue;
      }
    }

    // § / continuation lines attach to current canon
    if (current && (text.startsWith("§") || text.length > 15)) {
      current.contenido = `${current.contenido}\n${text}`.trim();
    }
  }

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

export const cdcAdapter: SourceAdapter = {
  id: CDC_ADAPTER_ID,
  supportsLiveScrape: true,

  async expandSeeds(
    seeds: string[],
    config: SourceConfig,
    ctx?: AdapterContext,
  ): Promise<string[]> {
    const seed = seeds[0] || `${INDEX_BASE}/cic_index_sp.html`;

    // Offline / fixture: expand from local index only (may yield few pages)
    if (ctx?.offline || ctx?.fixtureAbsPath) {
      const html = loadOfflineIndex(config, ctx);
      if (!html) {
        console.warn(
          `[cdc] offline: no index fixture; using seed only (${seed})`,
        );
        return [seed];
      }
      const pages = expandCdcIndexHtml(html, seed);
      // Prefer fixture pages that exist on disk under fixtures/cdc-es/pages/
      const fixtureRoot = path.isAbsolute(config.fixturePath || "")
        ? (config.fixturePath as string)
        : path.join(__dirname, "../../", config.fixturePath || "fixtures/cdc-es");
      const pagesDir = path.join(fixtureRoot, "pages");
      if (fs.existsSync(pagesDir)) {
        const local = fs
          .readdirSync(pagesDir)
          .filter((f) => f.endsWith(".html"))
          .map((f) => {
            const match = pages.find((u) => u.endsWith(f));
            return match || `fixture://${f}`;
          });
        if (local.length) {
          console.log(
            `[cdc] offline expand: ${local.length} fixture page(s) (index listed ${pages.length})`,
          );
          return local;
        }
      }
      // Index only: limit to a few URLs so --offline without page cache is fast
      console.log(
        `[cdc] offline: no pages/ cache; using up to 5 index URLs (of ${pages.length})`,
      );
      return pages.length ? pages.slice(0, 5) : [seed];
    }

    // Live: fetch index via curl-friendly path left to scrape_source loadPageHtml;
    // expandSeeds itself must return URLs — fetch index here lightly.
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
      html = Buffer.from(buf).toString("latin1");
    } catch (err) {
      throw new Error(
        `CDC expandSeeds failed to fetch index: ${(err as Error).message}`,
      );
    }

    // Cache index fixture
    if (config.fixturePath) {
      const root = path.isAbsolute(config.fixturePath)
        ? config.fixturePath
        : path.join(__dirname, "../../", config.fixturePath);
      fs.mkdirSync(root, { recursive: true });
      fs.writeFileSync(path.join(root, "index.html"), html, "utf-8");
    }

    const pages = expandCdcIndexHtml(html, seed);
    console.log(`[cdc] expand: ${pages.length} unique page URL(s) from index`);
    if (pages.length < 50) {
      console.warn(
        `[cdc] warning: expected ~251 pages, got ${pages.length} — check index markup`,
      );
    }
    return pages;
  },

  parsePage(
    html: string,
    url: string,
    _config: SourceConfig,
    _ctx?: AdapterContext,
  ): ParsedPage {
    // Index pages have no canons
    if (/cic_index/i.test(url) || /cdc\/index/i.test(url)) {
      return { units: [], headings: [], meta: { skippedIndex: true, url } };
    }
    return parseCdcPageHtml(html, url);
  },

  finalize(units: TrasnportData[]): TrasnportData[] {
    // Merge duplicate canons (same number across pages — keep first, append body)
    const map = new Map<string, TrasnportData>();
    for (const u of units) {
      const key = u.consecutivo;
      if (key === "no-encontrado") continue;
      const prev = map.get(key);
      if (!prev) {
        map.set(key, { ...u });
      } else if (u.contenido && !prev.contenido.includes(u.contenido.slice(0, 40))) {
        prev.contenido = `${prev.contenido}\n${u.contenido}`.trim();
      }
    }
    const out = Array.from(map.values()).sort(
      (a, b) => parseInt(a.consecutivo, 10) - parseInt(b.consecutivo, 10),
    );

    const nums = out.map((u) => parseInt(u.consecutivo, 10)).filter((n) => !Number.isNaN(n));
    const max = nums.length ? Math.max(...nums) : 0;
    const set = new Set(nums);
    const missing: number[] = [];
    for (let i = 1; i <= max; i++) {
      if (!set.has(i)) missing.push(i);
    }
    console.log(
      `[cdc] finalize: ${out.length} canons (max ${max}, gaps ${missing.length})` +
        (missing.length
          ? ` sample gaps: ${missing.slice(0, 15).join(", ")}`
          : ""),
    );
    return out;
  },
};
