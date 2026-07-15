/**
 * Slice a large Mansi/Archive.org OCR dump into a per-council clean/*.txt
 * using start/end keyword anchors (Latin).
 *
 *   npx ts-node --transpile-only slice_council_from_raw.ts \
 *     --from raw/mansi-approx-5.raw.txt --id nicea-i \
 *     --start "CONCILIUM NICAENUM" --end "CONCILIUM CONSTANTINOPOLITANUM"
 */
import fs from "fs";
import path from "path";
import {
  rejoinHyphenation,
  softNormalize,
  stripPdfChrome,
} from "./src/pipeline/plain_text_units";

const REPO = path.resolve(__dirname, "..");
const SOURCE_ROOT = path.join(REPO, "documentos/concilios-source");

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i === -1 || i + 1 >= process.argv.length) return undefined;
  return process.argv[i + 1];
}

/** Default anchors when inventory does not specify. */
const DEFAULT_SLICES: Record<
  string,
  { start: RegExp; end?: RegExp; volumeHints: string[] }
> = {
  "nicea-i": {
    volumeHints: ["mansi-approx-5"],
    start: /CONCILIUM\s+NICAENUM\s+I|NICAENUM\s+PRIMUM|SYNODUS\s+NICAENA/i,
    end: /CONCILIUM\s+CONSTANTINOPOLITANUM\s+I|CONSTANTINOPOLITANUM\s+PRIMUM/i,
  },
  "constantinopla-i": {
    volumeHints: ["mansi-approx-5"],
    start: /CONCILIUM\s+CONSTANTINOPOLITANUM\s+I|CONSTANTINOPOLITANUM\s+PRIMUM/i,
    end: /CONCILIUM\s+EPHESINUM|SYNODUS\s+EPHESINA/i,
  },
  efeso: {
    volumeHints: ["mansi-approx-5"],
    // OCR of old prints: long-s → f, spacing noise (Epbefinum, EPHESINI)
    start: /CONCILIUM\s+EPHES|CONCILII\s+EPHES|SYNODUS\s+EPHES|CONCILIUM\s+EPBE/i,
    end: /CONCILIUM\s+CHALCED|SYNODUS\s+CHALCED|TOMUS\s+SEXTUS/i,
  },
  calcedonia: {
    volumeHints: ["mansi-approx-6", "mansi-approx-7"],
    start: /CONCILIUM\s+CHALCED|SYNODUS\s+CHALCED|CHALCEDONENS/i,
    end: /CONCILIUM\s+CONSTANTINOPOLITANUM\s+II|TOMUS\s+(OCTAVUS|NONUS)/i,
  },
  trento: {
    volumeHints: ["mansi-33-trento", "mansi-approx-35"],
    start: /CONCILIUM\s+TRIDENTINUM|SACROSANCTA\s+TRIDENTINA/i,
    end: undefined,
  },
  "vat-i": {
    volumeHints: ["mansi-51-vat-i"],
    start: /CONCILIUM\s+VATICANUM|VATICANI\s+CONCILII/i,
    end: undefined,
  },
};

function findVolume(hints: string[]): string | null {
  const rawDir = path.join(SOURCE_ROOT, "raw");
  for (const h of hints) {
    const p = path.join(rawDir, `${h}.raw.txt`);
    if (fs.existsSync(p)) return p;
  }
  // any matching
  if (!fs.existsSync(rawDir)) return null;
  for (const f of fs.readdirSync(rawDir)) {
    if (!f.endsWith(".raw.txt")) continue;
    for (const h of hints) {
      if (f.includes(h.replace("mansi-", ""))) {
        return path.join(rawDir, f);
      }
    }
  }
  return null;
}

function sliceText(
  text: string,
  start: RegExp,
  end?: RegExp,
  maxChars = 400_000,
): string {
  const m = start.exec(text);
  if (!m) {
    console.warn("[warn] start anchor not found; using first maxChars of volume");
    return text.slice(0, maxChars);
  }
  const from = m.index;
  let to = Math.min(text.length, from + maxChars);
  if (end) {
    end.lastIndex = 0;
    const rest = text.slice(from + m[0].length);
    const e = end.exec(rest);
    if (e) to = from + m[0].length + e.index;
  }
  return text.slice(from, to);
}

function main(): void {
  const id = arg("--id");
  if (!id) {
    console.error(
      "Usage: slice_council_from_raw.ts --id <councilId> [--from path] [--start re] [--end re]",
    );
    process.exit(1);
  }

  const def = DEFAULT_SLICES[id];
  let fromPath = arg("--from");
  if (fromPath && !path.isAbsolute(fromPath)) {
    fromPath = path.resolve(process.cwd(), fromPath);
  }
  if (!fromPath) {
    if (!def) {
      console.error(`No default slice for ${id}; pass --from`);
      process.exit(1);
    }
    fromPath = findVolume(def.volumeHints) ?? undefined;
  }
  if (!fromPath || !fs.existsSync(fromPath)) {
    console.error(`Volume not found for ${id}. Download first: npm run concilios:download -- --id ${id}`);
    process.exit(1);
  }

  const start =
    arg("--start") != null
      ? new RegExp(arg("--start")!, "i")
      : def?.start ?? /./;
  const end =
    arg("--end") != null
      ? new RegExp(arg("--end")!, "i")
      : def?.end;

  console.log(`[i] slicing ${id} from ${fromPath}`);
  const raw = fs.readFileSync(fromPath, "utf-8");
  let chunk = sliceText(raw, start, end);
  chunk = stripPdfChrome(chunk);
  chunk = rejoinHyphenation(chunk);
  chunk = softNormalize(chunk);

  const inv = JSON.parse(
    fs.readFileSync(path.join(SOURCE_ROOT, "inventory/councils.json"), "utf-8"),
  ) as { sources: Array<{ id: string; corpusDocId?: string | null; cleanLocal?: string; rawLocal?: string }> };
  const src = inv.sources.find((s) => s.id === id);
  const corpusId = src?.corpusDocId ?? `${id}-la`;
  const cleanRel = src?.cleanLocal ?? `clean/${corpusId}.txt`;
  const rawRel = src?.rawLocal ?? `raw/${corpusId}.raw.txt`;

  // Always write raw slice. Only overwrite clean/ if --promote-clean
  // (Mansi OCR is often too noisy for the reader; keep curated clean by default.)
  const promote = process.argv.includes("--promote-clean");
  const rawAbs = path.join(SOURCE_ROOT, rawRel);
  // also keep a dedicated mansi slice next to volume dumps
  const mansiSlice = path.join(
    SOURCE_ROOT,
    "raw",
    `${corpusId}.mansi-slice.raw.txt`,
  );
  fs.mkdirSync(path.dirname(rawAbs), { recursive: true });
  fs.writeFileSync(rawAbs, chunk, "utf-8");
  fs.writeFileSync(mansiSlice, chunk, "utf-8");
  console.log(`[✓] raw slice → ${mansiSlice} (${chunk.length} chars)`);

  if (promote) {
    const cleanAbs = path.join(SOURCE_ROOT, cleanRel);
    fs.mkdirSync(path.dirname(cleanAbs), { recursive: true });
    fs.writeFileSync(
      cleanAbs,
      chunk + (chunk.endsWith("\n") ? "" : "\n"),
      "utf-8",
    );
    console.log(`[✓] clean promoted → ${cleanAbs}`);
  } else {
    console.log(
      `[i] clean/ not overwritten (pass --promote-clean only after QA of OCR quality)`,
    );
  }
}

main();
