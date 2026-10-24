/**
 * Prose (unnumbered) Vatican HTML → corpus units.
 * Used for short magisterial texts (e.g. Paul VI Missale Romanum APC)
 * where body is paragraphs under `.testo` / `.documento`, not `N. …` sections.
 */
import type { TrasnportData } from "../../models/transport_data.model";
import type {
  AdapterContext,
  ParsedPage,
  SourceAdapter,
  SourceConfig,
} from "./types";

const { parseHTML } = require("linkedom");

function cleanText(raw: string): string {
  return raw
    .replace(/\[\s*\]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/**
 * Footnotes on holy-father pages are numbered paras ("1. Cf. …", "15. II Vatican…").
 * Body of short constitutions is unnumbered prose — treat any leading N. as footnote.
 */
const LEADING_NUMBER_FOOTNOTE = /^\d{1,3}\.\s+\S/;

/** Chrome / chrome-adjacent short lines to drop. */
const CHROME_LINE =
  /^(DE\s*[-–]\s*EN|Copyright|©|Share|SocialBar|The Holy See|La Santa Sede|Sancta Sedes|Aperçu|Traduzione)\b/i;

function isChromeOrFootnote(text: string): boolean {
  if (!text || text.length < 40) return true;
  if (CHROME_LINE.test(text)) return true;
  if (LEADING_NUMBER_FOOTNOTE.test(text)) return true;
  // Pure language switcher
  if (
    /^(DE|EN|IT|LA|PT|ES|FR|PL)(\s*[-–]\s*(DE|EN|IT|LA|PT|ES|FR|PL))+\.?$/i.test(
      text,
    )
  ) {
    return true;
  }
  // Bracketed endnotes block leftovers
  if (/^\[\d+\]\s/.test(text) && text.length < 500) return true;
  return false;
}

/**
 * Parse body paragraphs from modern vatican.va holy-father pages.
 * Prefer `.testo`, then `.documento`, then body.
 */
export function parseVaticanProseParagraphs(html: string): ParsedPage {
  const { document } = parseHTML(html);

  let root: Element | Document = document;
  for (const sel of [".testo", ".documento", "#corpo", "main", "body"]) {
    const found = document.querySelector(sel);
    if (found) {
      root = found;
      break;
    }
  }

  const paragraphs = Array.from(root.querySelectorAll("p"));
  const units: TrasnportData[] = [];
  const headings: string[] = [];
  let n = 0;

  for (const p of paragraphs) {
    const text = cleanText((p as Element).textContent || "");
    if (!text) continue;
    if (isChromeOrFootnote(text)) continue;

    const align = (p as Element).getAttribute?.("align");
    // Centered short lines → headings (titles, salutations)
    if (
      (align === "center" || text === text.toUpperCase()) &&
      text.length < 180 &&
      !/[.!?…]$/.test(text)
    ) {
      headings.push(text.replace(/\s+/g, " ").trim());
      // Still include as a unit so the reader shows the title structure
    }

    n += 1;
    units.push({
      consecutivo: String(n),
      contenido: text,
      referencias: [],
    });
  }

  // Fallback: if almost nothing, try splitting full testo text by blank lines
  if (units.length < 3 && root !== document) {
    const blob = cleanText((root as Element).textContent || "");
    const parts = blob
      .split(/\n{2,}/)
      .map((s) => s.replace(/\s+/g, " ").trim())
      .filter((s) => s.length >= 80 && !isChromeOrFootnote(s));
    if (parts.length > units.length) {
      units.length = 0;
      parts.forEach((contenido, i) => {
        units.push({
          consecutivo: String(i + 1),
          contenido,
          referencias: [],
        });
      });
    }
  }

  return {
    units,
    headings,
    meta: {
      proseCount: units.length,
      parser: "vatican_prose",
    },
  };
}

export const vaticanProseAdapter: SourceAdapter = {
  id: "vatican_prose",
  supportsLiveScrape: true,

  parsePage(
    html: string,
    _url: string,
    _config: SourceConfig,
    _ctx?: AdapterContext,
  ): ParsedPage {
    return parseVaticanProseParagraphs(html);
  },

  finalize(units: TrasnportData[]): TrasnportData[] {
    return units.filter((u) => (u.contenido || "").trim().length >= 20);
  },
};
