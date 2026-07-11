/**
 * Lumen gentium (LG) — Spanish single-page Vatican HTML.
 * Sections are numbered paragraphs 1–69.
 */
import type { TrasnportData } from "../../models/transport_data.model";
import type {
  AdapterContext,
  ParsedPage,
  SourceAdapter,
  SourceConfig,
} from "./types";
import { parseNumberedParagraphs } from "./generic_numbered.adapter";

export const LG_ADAPTER_ID = "lg";

export const lgAdapter: SourceAdapter = {
  id: LG_ADAPTER_ID,
  supportsLiveScrape: true,

  expandSeeds(seeds: string[]): string[] {
    // Single-page constitution; seeds are already complete.
    return [...seeds];
  },

  parsePage(
    html: string,
    url: string,
    config: SourceConfig,
    _ctx?: AdapterContext,
  ): ParsedPage {
    const parsed = parseNumberedParagraphs(html, {
      contentSelector: "#corpo, body",
      stripFootnotes: true,
      extractParentheticalRefs: true,
      uniqueConsecutivo: true,
      dropEmpty: true,
    });

    parsed.meta = {
      ...parsed.meta,
      sourceUrl: url,
      corpusDocId: config.corpusDocId,
      docCode: config.docCode ?? "LG",
    };

    return parsed;
  },

  finalize(
    units: TrasnportData[],
    config: SourceConfig,
  ): TrasnportData[] {
    // Ensure consecutivo is string; drop pathological empties
    const cleaned = units
      .filter((u) => u.contenido && u.contenido.trim().length > 0)
      .map((u) => ({
        ...u,
        consecutivo: String(u.consecutivo),
        referencias: u.referencias ?? [],
      }));

    if (
      config.expectedUnitCount != null &&
      cleaned.length !== config.expectedUnitCount
    ) {
      console.warn(
        `[lg] expected ~${config.expectedUnitCount} units, got ${cleaned.length}`,
      );
    }

    return cleaned;
  },
};
