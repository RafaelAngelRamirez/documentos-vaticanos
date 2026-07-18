/**
 * Gating tests for CCEO ES twin pack (real corpus paths + shipped meta).
 * Run: npx ts-node --transpile-only cceo_es_inventory.test.ts
 */
import fs from "fs";
import path from "path";

const REPO = path.resolve(__dirname, "..");
const CORPUS = path.join(REPO, "documentos/corpus");
const ASSETS = path.join(REPO, "frontend/src/assets/corpus");

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

function loadManifest(root: string): { documents: Array<Record<string, unknown>> } {
  return JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf-8"));
}

function loadJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, "utf-8")) as T;
}

function looksSpanish(text: string): boolean {
  const low = text.toLowerCase();
  if (low.includes("[traducir]")) return false;
  const es = [" de ", " los ", " las ", " del ", " que ", " para ", " iglesia", " canon", " cánon", " obispo"];
  const la = ["huius", "codicis", "ecclesiae", "quod attinet", "debent"];
  const esHits = es.filter((w) => low.includes(w)).length;
  const laHits = la.filter((w) => low.includes(w)).length;
  return esHits >= 2 && laHits <= 2;
}

function main(): void {
  // 1) Every *-la has *-es twin in source corpus
  const man = loadManifest(CORPUS);
  const ids = new Set(man.documents.map((d) => String(d.id)));
  const laDocs = man.documents.filter(
    (d) => d.locale === "la" || String(d.id).endsWith("-la"),
  );
  const missing: string[] = [];
  for (const d of laDocs) {
    const id = String(d.id);
    const twin = id.endsWith("-la") ? id.replace(/-la$/, "-es") : null;
    if (!twin || !ids.has(twin)) missing.push(id);
  }
  assert(missing.length === 0, `LA without ES twin: ${missing.join(", ")}`);
  assert(ids.has("cceo-es"), "cceo-es in manifest");
  assert(ids.has("cceo-la"), "cceo-la preserved");

  // 2) Dual tree files exist
  for (const root of [CORPUS, ASSETS]) {
    for (const name of ["content.json", "meta.json", "index.json"]) {
      const p = path.join(root, "documents/cceo-es", name);
      assert(fs.existsSync(p), `exists ${p}`);
    }
    const m2 = loadManifest(root);
    assert(
      m2.documents.some((d) => d.id === "cceo-es"),
      `manifest lists cceo-es in ${root}`,
    );
  }

  // 3) unitCount alignment + Spanish samples
  const laUnits = loadJson<Array<{ consecutivo: string; contenido: string }>>(
    path.join(CORPUS, "documents/cceo-la/content.json"),
  );
  const esUnits = loadJson<Array<{ consecutivo: string; contenido: string }>>(
    path.join(CORPUS, "documents/cceo-es/content.json"),
  );
  assert(
    esUnits.length === laUnits.length,
    `unitCount ES ${esUnits.length} === LA ${laUnits.length}`,
  );
  assert(esUnits.length >= 1400, `enough canons: ${esUnits.length}`);

  for (let i = 0; i < esUnits.length; i++) {
    assert(
      String(esUnits[i].consecutivo) === String(laUnits[i].consecutivo),
      `consecutivo align at ${i}: es=${esUnits[i].consecutivo} la=${laUnits[i].consecutivo}`,
    );
  }

  const sampleIdx = [0, 10, Math.floor(esUnits.length / 2), esUnits.length - 1];
  for (const i of sampleIdx) {
    const body = esUnits[i].contenido || "";
    assert(body.trim().length > 20, `unit ${i} non-empty`);
    assert(!body.includes("[TRADUCIR]"), `unit ${i} not stub`);
    assert(looksSpanish(body), `unit ${i} looks Spanish: ${body.slice(0, 80)}`);
  }

  // 4) sourceNote disclaimer
  const meta = loadJson<{ sourceNote?: string; locale?: string; id?: string }>(
    path.join(CORPUS, "documents/cceo-es/meta.json"),
  );
  assert(meta.id === "cceo-es", "meta.id");
  assert(meta.locale === "es", "meta.locale es");
  const note = meta.sourceNote || "";
  assert(/traducci[oó]n.*IA|generada por IA/i.test(note), "sourceNote AI");
  assert(/no es una traducci[oó]n oficial/i.test(note), "sourceNote not official");
  assert(/cceo-la|texto latino/i.test(note), "sourceNote refs latin");
  assert(/prevalece el texto latino/i.test(note), "sourceNote latin prevails");

  // 5) doc-codes still point to Latin
  const docCodesPath = path.join(__dirname, "models/data/doc-codes.json");
  if (fs.existsSync(docCodesPath)) {
    const codes = loadJson<{
      documents: Array<{ code: string; corpusDocId: string | null }>;
    }>(docCodesPath);
    const cceo = codes.documents.find(
      (d) => d.code.toUpperCase() === "CCEO" || d.corpusDocId === "cceo-la",
    );
    if (cceo) {
      assert(
        cceo.corpusDocId === "cceo-la",
        `doc-codes CCEO stays cceo-la (got ${cceo.corpusDocId})`,
      );
    }
  }

  console.log(
    `OK: cceo_es_inventory.test.ts passed (la=${laUnits.length} es=${esUnits.length} twins-ok)`,
  );
}

main();
