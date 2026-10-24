/**
 * Shared parser for magisterial documents whose body is
 * `<p>N. …text…</p>` (Vatican HTML for many Vat. II / encyclical pages).
 */
import type { TrasnportData, Reference } from "../../models/transport_data.model";
import type {
  AdapterContext,
  ParsedPage,
  SourceAdapter,
  SourceConfig,
} from "./types";
import {
  collectFootnoteMap,
  collectFootnoteRefIds,
  mergeReferences,
  refsFromNoteIds,
  stripAllFootnoteAnchors,
} from "./footnote_harvest";

const { parseHTML } = require("linkedom");

/** Leading section number: "12. Text…" */
const LEADING_NUMBER = /^(\d+)\.\s+([\s\S]*)$/;

export interface NumberedParseOptions {
  /** CSS root for content (default: body / #corpo). */
  contentSelector?: string;
  /** Drop empty/whitespace units. */
  dropEmpty?: boolean;
  /** Extract parenthetical `(…)` groups as referencias (catechism-style). */
  extractParentheticalRefs?: boolean;
  /** Strip Vatican footnote anchors `[_ftnN]` / `[N]` markers. */
  stripFootnotes?: boolean;
  /** Keep only unique consecutivo (first wins). */
  uniqueConsecutivo?: boolean;
}

const DEFAULT_OPTS: Required<NumberedParseOptions> = {
  contentSelector: "#corpo, body",
  dropEmpty: true,
  extractParentheticalRefs: true,
  stripFootnotes: true,
  uniqueConsecutivo: true,
};

function cleanText(raw: string): string {
  return raw
    .replace(/\[\s*\]/g, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Catechism-compatible: pull `(…)` into referencias[] and placeholder tokens. */
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

/**
 * Parse numbered `<p>N. text</p>` units from HTML.
 */
export function parseNumberedParagraphs(
  html: string,
  options: NumberedParseOptions = {},
): ParsedPage {
  const opts = { ...DEFAULT_OPTS, ...options };
  const { document } = parseHTML(html);

  let root: Element | Document = document;
  for (const sel of opts.contentSelector.split(",").map((s) => s.trim())) {
    const found = document.querySelector(sel);
    if (found) {
      root = found;
      break;
    }
  }

  const paragraphs = Array.from(root.querySelectorAll("p"));
  const units: TrasnportData[] = [];
  const headings: string[] = [];
  const seen = new Set<string>();
  const harvest = opts.stripFootnotes
    ? collectFootnoteMap(root as Element)
    : { map: new Map<string, string>(), skipParagraphs: new Set<Element>() };

  for (const p of paragraphs) {
    const el = p as Element;
    if (harvest.skipParagraphs.has(el)) continue;

    const noteIds = opts.stripFootnotes ? collectFootnoteRefIds(el) : [];
    if (opts.stripFootnotes) {
      stripAllFootnoteAnchors(el);
    }
    const text = cleanText(el.textContent || "");
    if (!text) continue;

    const align = el.getAttribute?.("align");
    if (align === "center" || /^(CAPÍTULO|CAPITULO)\b/i.test(text)) {
      headings.push(text.replace(/\s+/g, " ").trim());
      continue;
    }

    const match = text.match(LEADING_NUMBER);
    if (!match) continue;

    const consecutivo = match[1];
    const body = cleanText(match[2]);
    if (opts.dropEmpty && !body) continue;
    if (opts.uniqueConsecutivo && seen.has(consecutivo)) continue;
    seen.add(consecutivo);

    const footnoteRefs = refsFromNoteIds(noteIds, harvest.map);
    let unit: TrasnportData = {
      consecutivo,
      contenido: `${consecutivo}. ${body}`,
      referencias: footnoteRefs,
    };

    if (opts.extractParentheticalRefs) {
      const extracted = extractParentheticals(unit.contenido);
      unit = {
        ...unit,
        contenido: extracted.contenido,
        referencias: mergeReferences(footnoteRefs, extracted.referencias),
      };
    }

    units.push(unit);
  }

  units.sort((a, b) => {
    const na = parseInt(a.consecutivo, 10);
    const nb = parseInt(b.consecutivo, 10);
    if (Number.isNaN(na) || Number.isNaN(nb)) return 0;
    return na - nb;
  });

  return {
    units,
    headings,
    meta: {
      numberedCount: units.length,
      headingCount: headings.length,
    },
  };
}

/**
 * Generic adapter instance (id = "generic_numbered").
 * Prefer document-specific adapters that wrap this.
 */
export const genericNumberedAdapter: SourceAdapter = {
  id: "generic_numbered",
  supportsLiveScrape: true,
  expandSeeds(seeds: string[]): string[] {
    return [...seeds];
  },
  parsePage(html: string, _url: string, _config: SourceConfig): ParsedPage {
    return parseNumberedParagraphs(html);
  },
  finalize(units: TrasnportData[]): TrasnportData[] {
    return units;
  },
};

export function createNumberedAdapter(
  id: string,
  options: NumberedParseOptions = {},
): SourceAdapter {
  return {
    id,
    supportsLiveScrape: true,
    expandSeeds(seeds) {
      return [...seeds];
    },
    parsePage(html, _url, _config, _ctx?: AdapterContext) {
      return parseNumberedParagraphs(html, options);
    },
    finalize(units) {
      return units;
    },
  };
}
