/**
 * Generic AI twin importer: base pack → target locale pack.
 *
 * Id rules:
 *   - `{family}-{locale}` when no official pack occupies that id
 *   - `{family}-{locale}-ai` when official `{family}-{locale}` already exists
 *
 * Never sets docCode. Writes dual corpus via writeCorpusDocument.
 * Units aligned 1:1 with base consecutivo order.
 *
 *   npx ts-node --transpile-only import_locale_twin.ts \
 *     --base lg-es --locale en --file /path/to/lg-en.content.json
 *   npx ts-node --transpile-only import_locale_twin.ts \
 *     --base cceo-la --locale es --from-content --skip-write
 *   npm run import:locale-twin -- --base lg-es --locale en --file …
 */
import fs from "fs";
import path from "path";
import { writeCorpusDocument } from "./src/pipeline/write_corpus";
import {
  isLabeledUnitDump,
  labeledUnitsToTransport,
} from "./src/pipeline/roman_catechism_units";
import {
  aiDisclaimer,
  familyKey,
  mapOfficialLocaleUrl,
  resolveAiTwinIdWithMeta,
  type LocaleDocMeta,
} from "./src/pipeline/locale_provenance";
import type { SourceConfig } from "./src/adapters/types";
import type { TrasnportData } from "./models/transport_data.model";
import type { DocumentMeta } from "./models/corpus.model";

const REPO = path.resolve(__dirname, "..");
const CORPUS = path.join(REPO, "documentos/corpus");

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i === -1 || i + 1 >= process.argv.length) return undefined;
  return process.argv[i + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function loadJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, "utf-8")) as T;
}

function loadManifestDocs(): LocaleDocMeta[] {
  const p = path.join(CORPUS, "manifest.json");
  if (!fs.existsSync(p)) return [];
  const man = loadJson<{ documents: LocaleDocMeta[] }>(p);
  return man.documents ?? [];
}

function loadBaseMeta(baseId: string): DocumentMeta {
  const metaPath = path.join(CORPUS, "documents", baseId, "meta.json");
  if (fs.existsSync(metaPath)) {
    return loadJson<DocumentMeta>(metaPath);
  }
  const man = loadManifestDocs();
  const hit = man.find((d) => d.id === baseId);
  if (!hit) {
    throw new Error(`base pack not found: ${baseId}`);
  }
  return hit as DocumentMeta;
}

function loadBaseUnits(baseId: string): TrasnportData[] {
  const p = path.join(CORPUS, "documents", baseId, "content.json");
  if (!fs.existsSync(p)) {
    throw new Error(`missing base content: ${p}`);
  }
  const raw = loadJson<TrasnportData[]>(p);
  return raw.map((u) => ({
    consecutivo: String(u.consecutivo),
    contenido: (u.contenido || "").trim(),
    referencias: u.referencias || [],
  }));
}

function loadUnitsFromFile(filePath: string): TrasnportData[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`missing file: ${filePath}`);
  }
  const text = fs.readFileSync(filePath, "utf-8");
  if (filePath.endsWith(".json")) {
    const raw = JSON.parse(text) as TrasnportData[];
    return raw.map((u) => ({
      consecutivo: String(u.consecutivo),
      contenido: (u.contenido || "").trim(),
      referencias: u.referencias || [],
    }));
  }
  if (!isLabeledUnitDump(text) && !text.trim().match(/^\S+\n/m)) {
    console.warn("[warn] file does not look like labeled dump; parsing anyway");
  }
  return labeledUnitsToTransport(text, { minLength: 0 }).filter(
    (u) => (u.contenido || "").trim().length > 0,
  );
}

function defaultContentPath(family: string, locale: string): string {
  return path.join(
    REPO,
    "documentos/magisterium-source/clean",
    `${family}-${locale}.content.json`,
  );
}

function defaultLabeledPath(family: string, locale: string): string {
  return path.join(
    REPO,
    "documentos/magisterium-source/clean",
    `${family}-${locale}.txt`,
  );
}

function alignWithBase(
  twin: TrasnportData[],
  base: TrasnportData[],
): TrasnportData[] {
  if (twin.length === base.length) {
    return base.map((bu, i) => ({
      consecutivo: String(bu.consecutivo),
      contenido: (twin[i].contenido || "").trim(),
      referencias: twin[i].referencias || [],
    }));
  }
  const byCon = new Map(twin.map((u) => [String(u.consecutivo), u]));
  const aligned: TrasnportData[] = [];
  let missing = 0;
  for (const bu of base) {
    const key = String(bu.consecutivo);
    const hit = byCon.get(key);
    if (!hit) {
      missing++;
      console.error(`[!] missing twin unit for consecutivo ${key}`);
      continue;
    }
    aligned.push({
      consecutivo: key,
      contenido: (hit.contenido || "").trim(),
      referencias: hit.referencias || [],
    });
  }
  if (missing) process.exitCode = 1;
  return aligned;
}

function main(): void {
  const baseId = arg("--base");
  const targetLocale = (arg("--locale") || "").toLowerCase();
  if (!baseId || !targetLocale) {
    console.error(
      "Usage: import_locale_twin.ts --base <docId> --locale <en|zh|hi|ar|…> [--file path] [--from-content] [--title …] [--short-title …] [--skip-write] [--force]",
    );
    process.exit(1);
  }

  const baseMeta = loadBaseMeta(baseId);
  const baseUnits = loadBaseUnits(baseId);
  const family = familyKey(baseId, baseMeta.locale);
  const existing = loadManifestDocs();
  const { corpusDocId, isCorrectionTwin } = resolveAiTwinIdWithMeta(
    family,
    targetLocale,
    existing,
  );

  let filePath = arg("--file");
  if (!filePath) {
    const content = defaultContentPath(family, targetLocale);
    const labeled = defaultLabeledPath(family, targetLocale);
    if (hasFlag("--from-content") || fs.existsSync(content)) {
      filePath = content;
    } else if (fs.existsSync(labeled)) {
      filePath = labeled;
    } else {
      console.error(
        `[!] provide --file or place ${content} / ${labeled}`,
      );
      process.exit(1);
    }
  }

  let units = loadUnitsFromFile(filePath);
  units = alignWithBase(units, baseUnits);

  console.log(
    `[i] base=${baseId} family=${family} → ${corpusDocId}` +
      ` (locale=${targetLocale}${isCorrectionTwin ? ", correction-twin" : ""})` +
      ` units=${units.length} (base=${baseUnits.length})`,
  );

  if (units.length === 0) {
    console.error("[!] no units");
    process.exit(1);
  }
  if (
    Math.abs(units.length - baseUnits.length) > 0 &&
    !hasFlag("--force")
  ) {
    console.error(
      `[!] unit count twin ${units.length} vs base ${baseUnits.length}; use --force to write anyway`,
    );
    process.exit(1);
  }

  const title =
    arg("--title") || baseMeta.title || family;
  const shortTitle =
    arg("--short-title") || baseMeta.shortTitle || family.toUpperCase();
  const baseLocale = baseMeta.locale || "es";
  const note = aiDisclaimer(targetLocale, title, baseId, baseLocale);
  const seed =
    mapOfficialLocaleUrl(baseMeta.sourceUrl, targetLocale) ||
    baseMeta.sourceUrl ||
    "";

  if (hasFlag("--skip-write")) {
    console.log("[i] --skip-write sample unit 0:");
    console.log(units[0]?.contenido?.slice(0, 240));
    console.log(`[i] sourceNote: ${note.slice(0, 160)}…`);
    return;
  }

  // Never set docCode on AI packs
  const config: SourceConfig = {
    id: `${family}-${targetLocale}${isCorrectionTwin ? "-ai" : ""}`,
    title,
    shortTitle,
    kind: baseMeta.kind || "magisterium",
    locale: targetLocale,
    corpusDocId,
    adapter: "plain-text",
    seedUrls: seed ? [seed] : [],
    sourceNote: note,
    notes: note,
    translationProvenance: "ai",
    author: baseMeta.author,
    compiler: baseMeta.compiler,
  };

  const result = writeCorpusDocument(config, units);
  console.log(
    `[✓] wrote ${result.unitCount} units → ${result.meta.id}` +
      ` (translationProvenance=ai; no docCode)`,
  );

  // Base pack must still exist
  const baseStill = path.join(CORPUS, "documents", baseId, "meta.json");
  if (!fs.existsSync(baseStill)) {
    console.error(`[!] unexpected: base ${baseId} missing after write`);
    process.exit(1);
  }
  console.log(`[✓] base ${baseId} still present`);
}

main();
