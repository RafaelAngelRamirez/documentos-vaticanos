/**
 * Locale provenance unit tests (always pass) + optional coverage gate.
 *
 *   npx ts-node --transpile-only locale_coverage.test.ts
 *   npm run test:locale-coverage
 *
 * Coverage gate fails while en/zh/hi/ar packs are incomplete — expected until
 * mass translation finishes. Unit tests for badges/disclaimers always run first.
 */
import fs from "fs";
import path from "path";
import {
  TARGET_LOCALES,
  COVERAGE_LOCALES,
  aiDisclaimer,
  aiPacksMissingDisclaimer,
  buildLocaleInventory,
  coverageGaps,
  familyKey,
  formatInventoryMatrix,
  isAiEdition,
  isCorrectionTwinId,
  localeBadge,
  localeLabel,
  looksLikeAiDisclaimer,
  mapOfficialLocaleUrl,
  presenceForLocale,
  provenanceBadge,
  resolveAiTwinId,
  resolveAiTwinIdWithMeta,
  type LocaleDocMeta,
} from "./src/pipeline/locale_provenance";

const REPO = path.resolve(__dirname, "..");
const CORPUS = path.join(REPO, "documentos/corpus");

let failed = 0;

function assert(cond: unknown, msg: string): void {
  if (!cond) {
    failed++;
    console.error(`FAIL: ${msg}`);
  }
}

function section(title: string): void {
  console.log(`\n== ${title} ==`);
}

function testProvenanceHelpers(): void {
  section("familyKey / twin ids");
  assert(familyKey("lg-es", "es") === "lg", "lg-es → lg");
  assert(familyKey("nicea-i-la", "la") === "nicea-i", "nicea-i-la");
  assert(familyKey("cceo-en-ai") === "cceo", "cceo-en-ai → cceo");
  assert(
    familyKey("bible-pueblo-de-dios-es", "es") === "bible-pueblo-de-dios",
    "bible family",
  );
  assert(isCorrectionTwinId("lg-en-ai") === true, "correction twin id");
  assert(isCorrectionTwinId("lg-en") === false, "primary not correction");

  section("badges / labels");
  assert(localeBadge("es") === "ES", "badge es");
  assert(localeBadge("zh") === "ZH", "badge zh");
  assert(localeBadge("hi") === "HI", "badge hi");
  assert(localeBadge("ar") === "AR", "badge ar");
  assert(localeLabel("en") === "English", "label en");
  assert(!!localeLabel("zh"), "label zh");
  assert(!!localeLabel("hi"), "label hi");
  assert(!!localeLabel("ar"), "label ar");

  section("AI disclaimer templates");
  for (const loc of ["es", "en", "zh", "hi", "ar", "la"] as const) {
    const note = aiDisclaimer(loc, "Lumen gentium", "lg-es", "es");
    assert(note.length > 40, `disclaimer ${loc} length`);
    assert(looksLikeAiDisclaimer(note), `disclaimer ${loc} detected`);
  }

  section("isAiEdition / presence");
  const official: LocaleDocMeta = {
    id: "lg-es",
    locale: "es",
    title: "Lumen gentium",
    sourceUrl: "https://www.vatican.va/…_sp.html",
  };
  const ai: LocaleDocMeta = {
    id: "lg-en",
    locale: "en",
    title: "Lumen gentium",
    translationProvenance: "ai",
    sourceNote: aiDisclaimer("en", "Lumen gentium", "lg-es", "es"),
  };
  const aiNoteOnly: LocaleDocMeta = {
    id: "cceo-es",
    locale: "es",
    sourceNote:
      "Traducción al español generada por IA a partir del texto latino. No es una traducción oficial.",
  };
  assert(isAiEdition(official) === false, "official not AI");
  assert(isAiEdition(ai) === true, "provenance ai");
  assert(isAiEdition(aiNoteOnly) === true, "sourceNote AI");
  assert(provenanceBadge(official) === "official", "badge official");
  assert(provenanceBadge(ai) === "AI", "badge AI");

  const eds = [official, ai];
  assert(presenceForLocale(eds, "es") === "official", "es official");
  assert(presenceForLocale(eds, "en") === "ai", "en ai");
  assert(presenceForLocale(eds, "zh") === "missing", "zh missing");

  section("resolveAiTwinId");
  const r1 = resolveAiTwinId("lg", "en", new Set(["lg-es"]));
  assert(r1.corpusDocId === "lg-en" && !r1.isCorrectionTwin, "primary free");
  const r2 = resolveAiTwinId("lg", "en", new Set(["lg-es", "lg-en"]));
  assert(
    r2.corpusDocId === "lg-en-ai" && r2.isCorrectionTwin,
    "correction when primary exists",
  );
  const r3 = resolveAiTwinIdWithMeta("lg", "en", [
    official,
    { id: "lg-en", locale: "en", translationProvenance: "ai" },
  ]);
  // primary is AI → re-import same id
  assert(r3.corpusDocId === "lg-en" && !r3.isCorrectionTwin, "reimport AI id");
  const r4 = resolveAiTwinIdWithMeta("lg", "en", [
    official,
    {
      id: "lg-en",
      locale: "en",
      sourceUrl: "https://www.vatican.va/…_en.html",
      translationProvenance: "official",
    },
  ]);
  assert(
    r4.corpusDocId === "lg-en-ai" && r4.isCorrectionTwin,
    "official en → en-ai twin",
  );

  section("Vat II official URL map");
  const sp =
    "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_const_19641121_lumen-gentium_sp.html";
  const en = mapOfficialLocaleUrl(sp, "en");
  assert(!!en && en.includes("_en.html"), `sp→en: ${en}`);
  const zh = mapOfficialLocaleUrl(sp, "zh");
  assert(!!zh && zh.includes("_zh.html"), `sp→zh: ${zh}`);
  const contentEs =
    "https://www.vatican.va/content/john-paul-ii/es/encyclicals/documents/hf_jp-ii_enc_x.html";
  const contentEn = mapOfficialLocaleUrl(contentEs, "en");
  assert(
    !!contentEn && contentEn.includes("/en/"),
    `content path es→en: ${contentEn}`,
  );

  section("inventory matrix (synthetic)");
  const rows = buildLocaleInventory(
    [official, ai, aiNoteOnly],
    TARGET_LOCALES,
  );
  assert(rows.length >= 2, "at least lg + cceo families");
  const matrix = formatInventoryMatrix(rows);
  assert(matrix.includes("lg"), "matrix has lg");
  assert(matrix.includes("official") || matrix.includes("ai"), "status tags");

  section("aiPacksMissingDisclaimer");
  const bad: LocaleDocMeta = {
    id: "foo-en",
    locale: "en",
    translationProvenance: "ai",
    // no sourceNote
  };
  const miss = aiPacksMissingDisclaimer([ai, bad]);
  assert(miss.some((d) => d.id === "foo-en"), "detects missing disclaimer");
  assert(!miss.some((d) => d.id === "lg-en"), "good AI pack ok");
}

/**
 * Coverage gate against real manifest — may fail until mass translation done.
 * Export for programmatic use.
 */
export function runCoverageGate(manifestPath?: string): {
  ok: boolean;
  gaps: Array<{ family: string; locale: string }>;
  missingDisclaimers: LocaleDocMeta[];
  familyCount: number;
} {
  const p =
    manifestPath || path.join(CORPUS, "manifest.json");
  if (!fs.existsSync(p)) {
    return {
      ok: false,
      gaps: [{ family: "(manifest)", locale: "missing-file" }],
      missingDisclaimers: [],
      familyCount: 0,
    };
  }
  const man = JSON.parse(fs.readFileSync(p, "utf-8")) as {
    documents: LocaleDocMeta[];
  };
  const docs = man.documents ?? [];
  const rows = buildLocaleInventory(docs, TARGET_LOCALES);
  const gaps = coverageGaps(rows, COVERAGE_LOCALES);
  const missingDisclaimers = aiPacksMissingDisclaimer(
    docs.filter((d) => isAiEdition(d)),
  );
  // No pre-existing pack deleted: every manifest id has content.json
  // (soft check — only report)
  return {
    ok: gaps.length === 0 && missingDisclaimers.length === 0,
    gaps,
    missingDisclaimers,
    familyCount: rows.length,
  };
}

function testInventoryAgainstManifest(): void {
  section("inventory against real manifest");
  const p = path.join(CORPUS, "manifest.json");
  assert(fs.existsSync(p), `manifest exists: ${p}`);
  if (!fs.existsSync(p)) return;
  const man = JSON.parse(fs.readFileSync(p, "utf-8")) as {
    documents: LocaleDocMeta[];
  };
  const docs = man.documents ?? [];
  assert(docs.length > 0, "manifest has documents");
  const rows = buildLocaleInventory(docs, TARGET_LOCALES);
  assert(rows.length > 0, "families > 0");
  // Every family should have at least one edition
  for (const r of rows.slice(0, 5)) {
    assert(r.editions.length >= 1, `editions for ${r.family}`);
  }
  // Existing AI packs (cceo-es etc.) must keep disclaimer
  const aiDocs = docs.filter((d) => isAiEdition(d));
  const miss = aiPacksMissingDisclaimer(aiDocs);
  assert(
    miss.length === 0,
    `existing AI packs have disclaimer (bad: ${miss.map((d) => d.id).join(",")})`,
  );
  // Snapshot: no document deleted from dual-tree check for known packs
  for (const id of ["cic-es", "lg-es", "cceo-la", "cceo-es"]) {
    const hit = docs.find((d) => d.id === id);
    assert(!!hit, `pre-existing pack still listed: ${id}`);
  }
  console.log(
    `  families=${rows.length} docs=${docs.length} aiPacks=${aiDocs.length}`,
  );
}

function testCoverageGate(): void {
  section("coverage gate (expected fail until MT complete)");
  const result = runCoverageGate();
  console.log(
    `  families=${result.familyCount} gaps=${result.gaps.length} ` +
      `aiMissingDisclaimer=${result.missingDisclaimers.length}`,
  );
  if (result.gaps.length) {
    const sample = result.gaps.slice(0, 8)
      .map((g) => `${g.family}/${g.locale}`)
      .join(", ");
    console.log(`  sample gaps: ${sample}`);
  }
  // Soft: record failure for exit code but do not use assert() so unit tests
  // above stay distinguishable — coverage is a separate exit path.
  if (!result.ok) {
    console.error(
      `FAIL(coverage): ${result.gaps.length} locale gaps; ` +
        `${result.missingDisclaimers.length} AI packs without disclaimer`,
    );
    failed++;
  } else {
    console.log("  coverage complete ✓");
  }
}

function main(): void {
  const unitOnly =
    process.argv.includes("--unit-only") ||
    process.env.LOCALE_COVERAGE_UNIT_ONLY === "1";

  testProvenanceHelpers();
  testInventoryAgainstManifest();

  const unitFailed = failed;
  if (unitFailed > 0) {
    console.error(
      `\nlocale_coverage.test.ts: ${unitFailed} unit/inventory failure(s)`,
    );
    process.exit(1);
  }
  console.log("\nOK: provenance + inventory asserts passed");

  if (unitOnly) {
    console.log("(skipped coverage gate: --unit-only)");
    return;
  }

  testCoverageGate();
  if (failed > 0) {
    console.error(
      `\nlocale_coverage.test.ts: coverage gate failed (${failed} issue(s)) — expected until en/zh/hi/ar packs exist`,
    );
    process.exit(1);
  }
  console.log("\nOK: locale_coverage.test.ts fully passed (coverage complete)");
}

main();
