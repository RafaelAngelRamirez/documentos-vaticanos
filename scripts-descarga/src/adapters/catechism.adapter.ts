/**
 * Thin registry wrapper for the existing Catechism scraper.
 * Full download remains in descargar_catecismo.ts (`npm run catecismo`).
 *
 * Do NOT import descargar_catecismo.ts here — that module auto-starts download.
 */
import type { SourceAdapter, SourceConfig } from "./types";

export const catechismAdapter: SourceAdapter = {
  id: "catechism",
  supportsLiveScrape: false,
  parsePage() {
    throw new Error(
      "Catechism full scrape is not wired through scrape_source yet. " +
        "Use legacy: npm run catecismo",
    );
  },
  expandSeeds(seeds: string[], config: SourceConfig) {
    return config.seedUrls?.length ? [...config.seedUrls] : [...seeds];
  },
};
