/**
 * Adapter registry: source config.adapter → SourceAdapter implementation.
 */
import type { SourceAdapter, SourceConfig, SourcesFile } from "./types";
import { bibleAdapter } from "./bible.adapter";
import { catechismAdapter } from "./catechism.adapter";
import { lgAdapter } from "./lg.adapter";
import { genericNumberedAdapter } from "./generic_numbered.adapter";
import { cdsAdapter } from "./cds.adapter";
import { cdcAdapter } from "./cdc.adapter";
import fs from "fs";
import path from "path";

const ADAPTERS: Record<string, SourceAdapter> = {
  [bibleAdapter.id]: bibleAdapter,
  [catechismAdapter.id]: catechismAdapter,
  [lgAdapter.id]: lgAdapter,
  [genericNumberedAdapter.id]: genericNumberedAdapter,
  [cdsAdapter.id]: cdsAdapter,
  [cdcAdapter.id]: cdcAdapter,
};

export function listAdapterIds(): string[] {
  return Object.keys(ADAPTERS);
}

export function getAdapter(adapterId: string): SourceAdapter {
  const a = ADAPTERS[adapterId];
  if (!a) {
    throw new Error(
      `Unknown adapter "${adapterId}". Registered: ${listAdapterIds().join(", ")}`,
    );
  }
  return a;
}

export function getAdapterForSource(config: SourceConfig): SourceAdapter {
  return getAdapter(config.adapter);
}

export function loadSourcesFile(
  filePath = path.join(__dirname, "../../config/sources.json"),
): SourcesFile {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    throw new Error(`sources.json not found: ${abs}`);
  }
  return JSON.parse(fs.readFileSync(abs, "utf8")) as SourcesFile;
}

export function getSourceConfig(
  sourceId: string,
  sourcesFile?: SourcesFile,
): SourceConfig {
  const file = sourcesFile ?? loadSourcesFile();
  const found = file.sources.find(
    (s) => s.id === sourceId || s.corpusDocId === sourceId,
  );
  if (!found) {
    const ids = file.sources.map((s) => s.id).join(", ");
    throw new Error(`Unknown source "${sourceId}". Known: ${ids}`);
  }
  return found;
}

export function registerAdapter(adapter: SourceAdapter): void {
  ADAPTERS[adapter.id] = adapter;
}
