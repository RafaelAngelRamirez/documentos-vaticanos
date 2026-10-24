/**
 * Thin registry wrapper for the existing Bible scraper.
 * Full download remains in descargar_biblia.ts (`npm run biblia`).
 *
 * Do NOT import descargar_biblia.ts here — that module auto-starts download.
 */
import type { SourceAdapter, SourceConfig } from "./types";

export const bibleAdapter: SourceAdapter = {
  id: "bible",
  supportsLiveScrape: false,
  parsePage() {
    throw new Error(
      "Bible full scrape is not wired through scrape_source yet. " +
        "Use legacy: npm run biblia",
    );
  },
  expandSeeds(seeds: string[], config: SourceConfig) {
    return config.seedUrls?.length ? [...config.seedUrls] : [...seeds];
  },
};
