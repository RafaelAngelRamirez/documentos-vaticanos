/**
 * Compendio de la Doctrina Social de la Iglesia (CDS) — Spanish single-page.
 *
 * Numbered units appear as:
 *   A) <p><b> <a name="N">N</a> </b>…text…
 *   B) <p><b> N </b>…text…   (a few paragraphs, e.g. 274, 536)
 *
 * Expected ~583 paragraphs. Front matter / TOC without these patterns is skipped.
 */
import type { TrasnportData, Reference } from "../../models/transport_data.model";
import type {
  AdapterContext,
  ParsedPage,
  SourceAdapter,
  SourceConfig,
} from "./types";

const { parseHTML } = require("linkedom");

export const CDS_ADAPTER_ID = "cds";

function cleanText(raw: string): string {
  return raw
    .replace(/\[\s*\]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function stripNoiseFromParagraph(el: Element): void {
  el.querySelectorAll(
    'a[href*="_ftn"], a[name*="_ftn"], a[href*="#_ftn"], sup',
  ).forEach((n) => n.remove());
}

function extractParentheticals(contenido: string): {
  contenido: string;
  referencias: Reference[];
} {
  const referencias: Reference[] = [];
  const regex = /\((.*?)\)/gm;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(contenido)) !== null) {
    referencias.push({ descripcion: m[1] });
  }
  let contador = 0;
  const finalText = contenido.replace(
    /\(.*?\)/gm,
    () => `( [+[${contador++}]+] )`,
  );
  return { contenido: finalText, referencias };
}

/** Detect leading section number from a paragraph element. */
function extractNumber(p: Element): { n: string; body: string } | null {
  // Pattern A: <a name="N">N</a> inside bold
  const anchors = Array.from(p.querySelectorAll("a[name]")) as Element[];
  for (const a of anchors) {
    const name = (a.getAttribute("name") || "").trim();
    if (!/^\d+$/.test(name)) continue;
    const label = cleanText(a.textContent || "");
    if (label && label !== name) continue;
    // Clone to strip the number marker from body text
    const clone = p.cloneNode(true) as Element;
    clone
      .querySelectorAll(`a[name="${name}"]`)
      .forEach((node) => {
        const parent = node.parentElement;
        node.remove();
        // Drop empty <b> wrappers left behind
        if (parent && !cleanText(parent.textContent || "") && parent.tagName === "B") {
          parent.remove();
        }
      });
    stripNoiseFromParagraph(clone);
    const body = cleanText(clone.textContent || "");
    if (!body) return null;
    return { n: name, body };
  }

  // Pattern B: leading bold number only — <b> N </b> or text "N. …"
  const firstB = p.querySelector("b");
  if (firstB) {
    const boldText = cleanText(firstB.textContent || "");
    const m = boldText.match(/^(\d+)$/);
    if (m) {
      const clone = p.cloneNode(true) as Element;
      const b0 = clone.querySelector("b");
      if (b0) b0.remove();
      stripNoiseFromParagraph(clone);
      const body = cleanText(clone.textContent || "");
      if (!body) return null;
      return { n: m[1], body };
    }
  }

  const text = cleanText(p.textContent || "");
  const lead = text.match(/^(\d+)\.\s+([\s\S]+)$/);
  if (lead) {
    return { n: lead[1], body: cleanText(lead[2]) };
  }

  return null;
}

function unitFromFound(found: { n: string; body: string }): TrasnportData {
  let unit: TrasnportData = {
    consecutivo: found.n,
    contenido: `${found.n}. ${found.body}`,
    referencias: [],
  };
  const extracted = extractParentheticals(unit.contenido);
  return {
    ...unit,
    contenido: extracted.contenido,
    referencias: extracted.referencias,
  };
}

/**
 * Parse CDS HTML into numbered transport units.
 *
 * Two-pass strategy (quality):
 * 1. Prefer body paragraphs with `<a name="N">` (main text §§1–583).
 * 2. Fill gaps with bare `<b>N</b>` patterns (e.g. 274, 536).
 * This avoids the front letter/presentation renumbering (1–5) stealing anchors.
 */
export function parseCdsHtml(html: string): ParsedPage {
  const { document } = parseHTML(html);
  const root =
    document.querySelector("#corpo") ||
    document.querySelector("body") ||
    document;

  const paragraphs = Array.from(root.querySelectorAll("p")) as Element[];
  const byNum = new Map<string, TrasnportData>();
  const headings: string[] = [];

  // Pass 1: anchor-based only
  for (const p of paragraphs) {
    const rawPreview = cleanText(p.textContent || "");
    if (!rawPreview) continue;

    const anchors = Array.from(p.querySelectorAll("a[name]")) as Element[];
    const numericAnchor = anchors.find((a) =>
      /^\d+$/.test((a.getAttribute("name") || "").trim()),
    );
    if (!numericAnchor) {
      const align = p.getAttribute?.("align");
      if (
        align === "center" ||
        /^(CAPÍTULO|CAPITULO|PRIMERA PARTE|SEGUNDA PARTE|TERCERA PARTE|INTRODUCCIÓN|INTRODUCCION|CONCLUSIÓN|CONCLUSION)\b/i.test(
          rawPreview,
        )
      ) {
        headings.push(rawPreview.replace(/\s+/g, " ").trim());
      }
      continue;
    }

    const found = extractNumber(p);
    if (!found) continue;
    if (byNum.has(found.n)) continue;
    byNum.set(found.n, unitFromFound(found));
  }

  // Pass 2: fill missing numbers with bold/plain patterns
  for (const p of paragraphs) {
    const found = extractNumber(p);
    if (!found) continue;
    if (byNum.has(found.n)) continue;
    // Prefer short body gaps (274, 536 style); skip front-matter if number already
    // would only appear as low numbers without anchors — already filled in pass 1.
    byNum.set(found.n, unitFromFound(found));
  }

  const units = Array.from(byNum.values()).sort(
    (a, b) => parseInt(a.consecutivo, 10) - parseInt(b.consecutivo, 10),
  );

  const nums = units.map((u) => parseInt(u.consecutivo, 10));
  const max = nums.length ? Math.max(...nums) : 0;
  const missing: number[] = [];
  if (max > 0) {
    const set = new Set(nums);
    for (let i = 1; i <= max; i++) {
      if (!set.has(i)) missing.push(i);
    }
  }

  return {
    units,
    headings,
    meta: {
      numberedCount: units.length,
      headingCount: headings.length,
      maxNumber: max,
      missingCount: missing.length,
      missingSample: missing.slice(0, 20),
    },
  };
}

export const cdsAdapter: SourceAdapter = {
  id: CDS_ADAPTER_ID,
  supportsLiveScrape: true,

  expandSeeds(seeds: string[]): string[] {
    return [...seeds];
  },

  parsePage(
    html: string,
    _url: string,
    _config: SourceConfig,
    _ctx?: AdapterContext,
  ): ParsedPage {
    return parseCdsHtml(html);
  },

  finalize(units: TrasnportData[]): TrasnportData[] {
    return units;
  },
};
