/**
 * Download council source material into documentos/concilios-source/{raw,pdf}.
 * Prefer Archive.org *_djvu.txt (already OCR text) over multi-GB scanned PDFs.
 *
 *   npx ts-node --transpile-only download_council_source.ts --list
 *   npx ts-node --transpile-only download_council_source.ts --id nicea-i
 *   npx ts-node --transpile-only download_council_source.ts --all
 *   npx ts-node --transpile-only download_council_source.ts --volume sacrorumconcilio0005joan
 */
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";

const REPO = path.resolve(__dirname, "..");
const SOURCE_ROOT = path.join(REPO, "documentos/concilios-source");
const INVENTORY = path.join(SOURCE_ROOT, "inventory/councils.json");
const RAW_DIR = path.join(SOURCE_ROOT, "raw");
const PDF_DIR = path.join(SOURCE_ROOT, "pdf");

/** Archive.org item id → Mansi-ish volume label (best-effort). */
const MANSI_ITEMS: Record<string, string> = {
  "sacrorumconcilio0005joan": "mansi-approx-5",
  "sacrorumconcilio0006joan": "mansi-approx-6",
  "sacrorumconcilio0007joan": "mansi-approx-7",
  "sacrorumconcilio0019joan": "mansi-approx-19",
  "sacrorumconcilio0020joan": "mansi-approx-20",
  "sacrorumconcilio0024joan": "mansi-approx-24",
  "sacrorumconcilio0026joan": "mansi-approx-26",
  "sacrorumconcilio0027joan": "mansi-approx-27",
  "sacrorumconcilio0028joan": "mansi-approx-28",
  "sacrorumconcilio0035joan": "mansi-approx-35",
  Mansi33: "mansi-33-trento",
  Mansi51: "mansi-51-vat-i",
};

/**
 * Map council id → preferred Archive.org item(s) for bulk Latin text.
 * Full volumes are shared; extraction to per-council clean is a later step.
 */
const COUNCIL_ARCHIVE: Record<string, string[]> = {
  "nicea-i": ["sacrorumconcilio0005joan"],
  "constantinopla-i": ["sacrorumconcilio0005joan"],
  efeso: ["sacrorumconcilio0005joan"],
  calcedonia: ["sacrorumconcilio0006joan", "sacrorumconcilio0007joan"],
  "constantinopla-ii": ["sacrorumconcilio0007joan"],
  "constantinopla-iii": ["sacrorumconcilio0019joan"],
  "nicea-ii": ["sacrorumconcilio0019joan", "sacrorumconcilio0020joan"],
  "constantinopla-iv": ["sacrorumconcilio0020joan"],
  "lateran-i": ["sacrorumconcilio0024joan"],
  "lateran-ii": ["sacrorumconcilio0024joan"],
  "lateran-iii": ["sacrorumconcilio0024joan"],
  "lateran-iv": ["sacrorumconcilio0024joan"],
  "lyon-i": ["sacrorumconcilio0026joan"],
  "lyon-ii": ["sacrorumconcilio0026joan"],
  vienne: ["sacrorumconcilio0027joan"],
  constanza: ["sacrorumconcilio0027joan", "sacrorumconcilio0028joan"],
  florencia: ["sacrorumconcilio0028joan"],
  "lateran-v": ["sacrorumconcilio0035joan"],
  trento: ["Mansi33", "sacrorumconcilio0035joan"],
  "vat-i": ["Mansi51"],
};

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i === -1 || i + 1 >= process.argv.length) return undefined;
  return process.argv[i + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function ensureDirs(): void {
  fs.mkdirSync(RAW_DIR, { recursive: true });
  fs.mkdirSync(PDF_DIR, { recursive: true });
}

function downloadUrl(url: string, dest: string, maxTime = 300): boolean {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(dest) && fs.statSync(dest).size > 10_000) {
    console.log(`[i] skip existing ${dest} (${fs.statSync(dest).size} bytes)`);
    return true;
  }
  console.log(`[+] curl ${url}`);
  try {
    execFileSync(
      "curl",
      [
        "-sL",
        "--fail",
        "--max-time",
        String(maxTime),
        "-A",
        "documentos-vaticanos/0.1 (research; offline corpus)",
        "-o",
        dest,
        url,
      ],
      { stdio: "inherit" },
    );
  } catch {
    console.warn(`[warn] download failed: ${url}`);
    if (fs.existsSync(dest)) fs.unlinkSync(dest);
    return false;
  }
  const sz = fs.existsSync(dest) ? fs.statSync(dest).size : 0;
  // reject HTML error pages
  if (sz < 5000) {
    console.warn(`[warn] too small (${sz}): ${dest}`);
    return false;
  }
  const head = fs.readFileSync(dest, "utf-8").slice(0, 200).toLowerCase();
  if (head.includes("<!doctype html") || head.includes("<html")) {
    console.warn(`[warn] got HTML not text: ${dest}`);
    fs.unlinkSync(dest);
    return false;
  }
  console.log(`[✓] ${dest} (${sz} bytes)`);
  return true;
}

function archiveDjvuTxtUrl(itemId: string): string {
  return `https://archive.org/download/${itemId}/${itemId}_djvu.txt`;
}

function downloadVolume(itemId: string): string | null {
  const label = MANSI_ITEMS[itemId] ?? itemId;
  const dest = path.join(RAW_DIR, `${label}.raw.txt`);
  const ok = downloadUrl(archiveDjvuTxtUrl(itemId), dest, 600);
  return ok ? dest : null;
}

function list(): void {
  console.log("Archive.org items:");
  for (const [id, label] of Object.entries(MANSI_ITEMS)) {
    const dest = path.join(RAW_DIR, `${label}.raw.txt`);
    const have = fs.existsSync(dest) ? fs.statSync(dest).size : 0;
    console.log(`  ${id.padEnd(40)} → ${label} ${have ? `(have ${have})` : "(missing)"}`);
  }
  console.log("\nCouncil → items:");
  for (const [cid, items] of Object.entries(COUNCIL_ARCHIVE)) {
    console.log(`  ${cid.padEnd(22)} ${items.join(", ")}`);
  }
}

function main(): void {
  ensureDirs();
  if (hasFlag("--list") || process.argv.length <= 2) {
    list();
    return;
  }

  if (arg("--volume")) {
    downloadVolume(arg("--volume")!);
    return;
  }

  const ids: string[] = [];
  if (hasFlag("--all")) {
    ids.push(...Object.keys(COUNCIL_ARCHIVE));
  } else if (arg("--id")) {
    ids.push(arg("--id")!);
  } else {
    list();
    process.exit(1);
  }

  const volumes = new Set<string>();
  for (const id of ids) {
    for (const v of COUNCIL_ARCHIVE[id] ?? []) volumes.add(v);
  }
  // also download any --volume-only not in map
  console.log(`[i] downloading ${volumes.size} volume(s) for ${ids.length} council(s)`);
  let ok = 0;
  for (const v of volumes) {
    if (downloadVolume(v)) ok += 1;
  }
  console.log(`[✓] downloaded ${ok}/${volumes.size} volumes into ${RAW_DIR}`);

  // touch inventory notes
  if (fs.existsSync(INVENTORY)) {
    const inv = JSON.parse(fs.readFileSync(INVENTORY, "utf-8")) as {
      sources: Array<{
        id: string;
        notes?: string;
        archiveItems?: string[];
        status?: string;
      }>;
    };
    for (const s of inv.sources) {
      if (COUNCIL_ARCHIVE[s.id]) {
        s.archiveItems = COUNCIL_ARCHIVE[s.id];
      }
    }
    fs.writeFileSync(INVENTORY, JSON.stringify(inv, null, 2) + "\n");
  }
}

main();
