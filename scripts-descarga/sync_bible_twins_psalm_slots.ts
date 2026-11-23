/**
 * After repair_psalms_es.ts, keep locale twins (en/ar/hi/zh) on the same unit
 * grid: fold the phantom letter-suffix slots into the previous unit, drop them,
 * renumber, and rebuild index/meta. Does not invent translation text.
 *
 * Usage: npx ts-node --transpile-only sync_bible_twins_psalm_slots.ts
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { buildIndex } from "./src/pipeline/build_index";
import {
  CANONICAL_CORPUS_ROOT,
  syncDocToAssets,
  syncManifestToAssets,
} from "./src/pipeline/write_corpus";
import type { CorpusUnit } from "./models/transport_data.model";

const FIXTURE = path.join(
  __dirname,
  "fixtures",
  "psalms-es",
  "removed_phantom_indices.json",
);
const TWINS = [
  "bible-pueblo-de-dios-en",
  "bible-pueblo-de-dios-ar",
  "bible-pueblo-de-dios-hi",
  "bible-pueblo-de-dios-zh",
];

function hashContent(units: CorpusUnit[]): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(units))
    .digest("hex")
    .slice(0, 12);
}

function main(): void {
  const { indices } = JSON.parse(fs.readFileSync(FIXTURE, "utf8")) as {
    indices: number[];
  };
  const sorted = [...indices].sort((a, b) => b - a);
  const manifestPath = path.join(CANONICAL_CORPUS_ROOT, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
    documents: Array<{ id: string; unitCount?: number; contentHash?: string }>;
  };

  for (const id of TWINS) {
    const dir = path.join(CANONICAL_CORPUS_ROOT, "documents", id);
    const contentPath = path.join(dir, "content.json");
    const units = JSON.parse(
      fs.readFileSync(contentPath, "utf8"),
    ) as CorpusUnit[];
    for (const idx of sorted) {
      const frag = String(units[idx]?.contenido || "").trim();
      if (!frag) throw new Error(`${id}: empty phantom at ${idx}`);
      const prev = units[idx - 1];
      prev.contenido = `${String(prev.contenido || "").trim()} ${frag}`
        .replace(/\s+/g, " ")
        .trim();
      units.splice(idx, 1);
    }
    for (let i = 0; i < units.length; i++) {
      units[i].consecutivo = String(i);
      if (units[i].index_array != null) units[i].index_array = i;
      if (units[i].biblia) units[i].biblia!.index_general = String(i);
    }
    const index = buildIndex(units);
    const contentHash = hashContent(units);
    fs.writeFileSync(contentPath, JSON.stringify(units));
    fs.writeFileSync(path.join(dir, "index.json"), JSON.stringify(index));
    const metaPath = path.join(dir, "meta.json");
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8")) as Record<
      string,
      unknown
    >;
    meta.unitCount = units.length;
    meta.contentHash = contentHash;
    fs.writeFileSync(metaPath, JSON.stringify(meta));
    const entry = manifest.documents.find((d) => d.id === id);
    if (entry) {
      entry.unitCount = units.length;
      entry.contentHash = contentHash;
    }
    syncDocToAssets(id);
    console.log(`[✓] ${id} → ${units.length} ${contentHash}`);
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  syncManifestToAssets();
  console.log("[✓] sync_bible_twins_psalm_slots done");
}

main();
