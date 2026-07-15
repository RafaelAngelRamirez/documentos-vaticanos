/**
 * End-to-end for one or more councils:
 *   raw Mansi volume → slice → clean OCR → QA → maybe promote clean → import
 *
 *   npx ts-node --transpile-only process_council_ocr.ts --id trento
 *   npx ts-node --transpile-only process_council_ocr.ts --ids trento,vat-i,constanza
 *   npx ts-node --transpile-only process_council_ocr.ts --all
 *
 * Policy:
 *   - Always write raw/*.mansi-slice.raw.txt and raw/*-cleaned.staging.txt
 *   - Promote to clean/ only if quality score passes (or --force)
 *   - Prefer hybrid: curated clean + high-scoring OCR blocks not already present
 *   - Then import_council
 */
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { cleanMansiText } from "./clean_mansi_text";
import {
  rejoinHyphenation,
  softNormalize,
  stripPdfChrome,
} from "./src/pipeline/plain_text_units";

const REPO = path.resolve(__dirname, "..");
const ROOT = path.join(REPO, "documentos/concilios-source");
const RAW = path.join(ROOT, "raw");
const CLEAN = path.join(ROOT, "clean");
const SCRIPTS = path.resolve(__dirname);

/** Best volume file + start/end anchors (tolerant OCR). */
const PLAN: Record<
  string,
  { volumes: string[]; start: RegExp; end?: RegExp; maxChars: number }
> = {
  "nicea-i": {
    volumes: ["mansi-approx-5.raw.txt"],
    start: /NICAEN|NICAENUM|SYNODUS\s+NICA/i,
    end: /CONSTANTINOPOLITANUM\s+I|CONSTANTINOP\.?\s*I\b/i,
    maxChars: 120_000,
  },
  "constantinopla-i": {
    volumes: ["mansi-approx-5.raw.txt"],
    start: /CONSTANTINOPOLITANUM\s+I|CONSTANTINOP\.?\s*PRIMUM|SYNODUS\s+CONSTANTINOP/i,
    end: /EPHESIN|EPBEFIN|SYNODUS\s+EPHES/i,
    maxChars: 120_000,
  },
  efeso: {
    volumes: ["mansi-approx-5.raw.txt", "efeso-la.raw.txt"],
    start: /EPHESIN|EPBEFIN|SYNODUS\s+EPHES|CONCILIUM\s+EPHE/i,
    end: /CHALCEDON|TOMUS\s+SEXTUS/i,
    maxChars: 200_000,
  },
  calcedonia: {
    volumes: ["mansi-approx-6.raw.txt", "mansi-approx-7.raw.txt"],
    start: /CHALCEDON/i,
    end: /CONSTANTINOPOLITANUM\s+II|TOMUS\s+(OCTAV|NON)/i,
    maxChars: 200_000,
  },
  "constantinopla-ii": {
    volumes: ["mansi-approx-7.raw.txt", "mansi-approx-19.raw.txt"],
    start: /CONSTANTINOPOLITANUM\s+II|QUINTA\s+SYNOD|V\.\s*SYNODUS/i,
    end: /CONSTANTINOPOLITANUM\s+III|SEXTA\s+SYNOD/i,
    maxChars: 150_000,
  },
  "constantinopla-iii": {
    volumes: ["mansi-approx-19.raw.txt", "mansi-approx-20.raw.txt"],
    start: /CONSTANTINOPOLITANUM\s+III|SEXTA\s+SYNOD|MONOTHEL/i,
    end: /NICAENUM\s+II|SEPTIMA\s+SYNOD/i,
    maxChars: 150_000,
  },
  "nicea-ii": {
    volumes: ["mansi-approx-19.raw.txt", "mansi-approx-20.raw.txt"],
    start: /NICAENUM\s+II|SEPTIMA\s+SYNOD|ICONOCL|IMAGIN/i,
    end: /CONSTANTINOPOLITANUM\s+IV|OCTAVA\s+SYNOD/i,
    maxChars: 180_000,
  },
  "constantinopla-iv": {
    volumes: ["mansi-approx-20.raw.txt"],
    start: /CONSTANTINOPOLITANUM\s+IV|OCTAVA\s+SYNOD|PHOTI/i,
    end: /LATERANENSE\s+I|TOMUS/i,
    maxChars: 150_000,
  },
  "lateran-i": {
    volumes: ["mansi-approx-24.raw.txt"],
    start: /LATERANENSE\s+I\b|LATERANENSI\s+I\b|CALLIST/i,
    end: /LATERANENSE\s+II/i,
    maxChars: 100_000,
  },
  "lateran-ii": {
    volumes: ["mansi-approx-24.raw.txt"],
    start: /LATERANENSE\s+II\b|INNOCENTIUS\s+II/i,
    end: /LATERANENSE\s+III/i,
    maxChars: 100_000,
  },
  "lateran-iii": {
    volumes: ["mansi-approx-24.raw.txt"],
    start: /LATERANENSE\s+III\b|ALEXANDER\s+III/i,
    end: /LATERANENSE\s+IV/i,
    maxChars: 100_000,
  },
  "lateran-iv": {
    volumes: ["mansi-approx-24.raw.txt"],
    start: /LATERANENSE\s+IV\b|INNOCENTIUS\s+III|FIRMITER/i,
    end: /LUGDUNENSE|LUGDUNENSIS/i,
    maxChars: 150_000,
  },
  "lyon-i": {
    volumes: ["mansi-approx-26.raw.txt"],
    start: /LUGDUNENSE\s+I\b|LUGDUNENSIS\s+I\b|INNOCENTIUS\s+IV/i,
    end: /LUGDUNENSE\s+II/i,
    maxChars: 100_000,
  },
  "lyon-ii": {
    volumes: ["mansi-approx-26.raw.txt"],
    start: /LUGDUNENSE\s+II\b|GREGORIUS\s+X/i,
    end: /VIENNENSE|VIENNENSIS/i,
    maxChars: 100_000,
  },
  vienne: {
    volumes: ["mansi-approx-27.raw.txt", "mansi-approx-26.raw.txt"],
    start: /VIENNENSE|VIENNENSIS|CLEMENS\s+V|TEMPLAR/i,
    end: /CONSTANTIENSE|CONSTANTIENSIS/i,
    maxChars: 120_000,
  },
  constanza: {
    volumes: ["mansi-approx-27.raw.txt", "mansi-approx-28.raw.txt"],
    start: /CONSTANTIENSE|CONSTANTIENSIS|CONSTANCE|HAEC\s+SANCTA/i,
    end: /BASILEENSE|FLORENTIN|FERRARIENSE/i,
    maxChars: 180_000,
  },
  florencia: {
    volumes: ["mansi-approx-28.raw.txt", "mansi-approx-27.raw.txt"],
    start: /FLORENTIN|FERRARIENSE|BASILEENSE|LAETENTUR\s+CAELI/i,
    end: /LATERANENSE\s+V|TRIDENTIN/i,
    maxChars: 180_000,
  },
  "lateran-v": {
    volumes: ["mansi-approx-35.raw.txt", "mansi-approx-28.raw.txt"],
    start: /LATERANENSE\s+V\b|LEO\s+X|LATERANENSI\s+V/i,
    end: /TRIDENTIN/i,
    maxChars: 120_000,
  },
  trento: {
    volumes: ["mansi-33-trento.raw.txt", "mansi-approx-35.raw.txt"],
    start: /TRIDENTIN|SACROSANCTA\s+.*TRIDENT/i,
    end: /VATICANUM\s+I|CONCILIUM\s+VATICAN/i,
    maxChars: 250_000,
  },
  "vat-i": {
    volumes: ["mansi-51-vat-i.raw.txt"],
    start: /VATICANUM|DEI\s+FILIUS|PASTOR\s+AETERNUS|PIUS\s+EPISCOPUS/i,
    end: undefined,
    maxChars: 200_000,
  },
};

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i === -1 || i + 1 >= process.argv.length) return undefined;
  return process.argv[i + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function findVolume(names: string[]): string | null {
  for (const n of names) {
    const p = path.join(RAW, n);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function slice(text: string, start: RegExp, end: RegExp | undefined, max: number): string {
  const m = start.exec(text);
  if (!m) {
    console.warn("[warn] start not found; using head of volume");
    return text.slice(0, max);
  }
  const from = m.index;
  let to = Math.min(text.length, from + max);
  if (end) {
    const rest = text.slice(from + 80);
    const e = end.exec(rest);
    if (e) to = Math.min(to, from + 80 + e.index);
  }
  return text.slice(from, to);
}

function qualityScore(text: string): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  if (text.length < 800) return { score: 0, reasons: ["too short"] };
  const letters = (text.match(/\p{L}/gu) || []).length;
  const ratio = letters / text.length;
  let score = Math.floor(ratio * 50);
  reasons.push(`alpha=${ratio.toFixed(2)}`);
  if (/Canon\s+\d+/i.test(text)) {
    score += 20;
    reasons.push("has canons");
  }
  if (/\banathema\s+sit\b/i.test(text)) {
    score += 15;
    reasons.push("anathema");
  }
  if (/\b(Sessio|Session)\s+\d+/i.test(text)) {
    score += 10;
    reasons.push("sessions");
  }
  if (/\b(si\s+quis|definimus|statuimus|creditus|fides)\b/i.test(text)) {
    score += 10;
    reasons.push("latin formulas");
  }
  // noise: many isolated letters
  const words = text.split(/\s+/).filter(Boolean);
  const short = words.filter((w) => w.length === 1).length;
  if (words.length && short / words.length > 0.25) {
    score -= 25;
    reasons.push("letter-noise");
  }
  return { score, reasons };
}

function hybridMerge(curated: string, cleaned: string): string {
  /**
   * Default: keep curated reading text.
   * Only replace with cleaned OCR if curated is missing/tiny AND cleaned scores well.
   * Do NOT append raw Mansi dumps as "Supplementum" (destroys reader UX).
   * Full OCR stays in raw/*-cleaned.staging.txt for future editorial work.
   */
  if (curated && curated.length >= 500) {
    return curated.endsWith("\n") ? curated : curated + "\n";
  }
  return cleaned;
}

function processOne(id: string, force: boolean): void {
  const plan = PLAN[id];
  if (!plan) {
    console.error(`[skip] no plan for ${id}`);
    return;
  }
  const vol = findVolume(plan.volumes);
  if (!vol) {
    console.error(`[skip] no volume for ${id} (need ${plan.volumes.join("|")})`);
    return;
  }
  console.log(`\n=== ${id} from ${path.basename(vol)} ===`);
  const text = fs.readFileSync(vol, "utf-8");
  const chunk = slice(text, plan.start, plan.end, plan.maxChars * 2);
  const slicePath = path.join(RAW, `${id}-la.mansi-slice.raw.txt`);
  fs.writeFileSync(slicePath, chunk, "utf-8");
  console.log(`[✓] slice ${chunk.length} chars → ${slicePath}`);

  let cleaned = cleanMansiText(chunk, plan.maxChars);
  cleaned = stripPdfChrome(cleaned);
  cleaned = rejoinHyphenation(cleaned);
  cleaned = softNormalize(cleaned) + "\n";
  const staging = path.join(RAW, `${id}-la.cleaned.staging.txt`);
  fs.writeFileSync(staging, cleaned, "utf-8");

  const q = qualityScore(cleaned);
  console.log(`[i] quality score=${q.score} (${q.reasons.join(", ")})`);

  const cleanPath = path.join(CLEAN, `${id}-la.txt`);
  const curated = fs.existsSync(cleanPath)
    ? fs.readFileSync(cleanPath, "utf-8")
    : "";

  const pass = force || q.score >= 45;
  if (!pass) {
    console.warn(`[!] score too low; keep curated clean (use --force to promote)`);
    return;
  }

  const merged = hybridMerge(curated, cleaned);
  fs.writeFileSync(cleanPath, merged, "utf-8");
  console.log(`[✓] clean → ${cleanPath} (${merged.length} chars)`);

  // import
  try {
    execFileSync(
      "npx",
      ["ts-node", "--transpile-only", "import_council.ts", "--id", id],
      { cwd: SCRIPTS, stdio: "inherit" },
    );
  } catch (e) {
    console.error(`[warn] import failed for ${id}`, (e as Error).message);
  }
}

function main(): void {
  const force = hasFlag("--force");
  let ids: string[] = [];
  if (hasFlag("--all")) {
    ids = Object.keys(PLAN);
  } else if (arg("--ids")) {
    ids = arg("--ids")!.split(",").map((s) => s.trim()).filter(Boolean);
  } else if (arg("--id")) {
    ids = [arg("--id")!];
  } else {
    console.error(
      "Usage: process_council_ocr.ts --id X | --ids a,b | --all [--force]",
    );
    process.exit(1);
  }
  for (const id of ids) processOne(id, force);
}

main();
