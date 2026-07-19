/**
 * Print multi-locale coverage matrix from real corpus manifest.
 *
 *   npx ts-node --transpile-only locale_inventory.ts
 *   npx ts-node --transpile-only locale_inventory.ts --out /tmp/locale-inventory.txt
 *   npm run locale:inventory
 */
import fs from "fs";
import path from "path";
import {
  TARGET_LOCALES,
  buildLocaleInventory,
  formatInventoryMatrix,
  coverageGaps,
  COVERAGE_LOCALES,
  type LocaleDocMeta,
} from "./src/pipeline/locale_provenance";

const REPO = path.resolve(__dirname, "..");
const DEFAULT_MANIFEST = path.join(
  REPO,
  "documentos/corpus/manifest.json",
);

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i === -1 || i + 1 >= process.argv.length) return undefined;
  return process.argv[i + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function main(): void {
  const manifestPath = arg("--manifest") ?? DEFAULT_MANIFEST;
  if (!fs.existsSync(manifestPath)) {
    console.error(`[!] missing manifest: ${manifestPath}`);
    process.exit(1);
  }
  const man = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as {
    documents: LocaleDocMeta[];
  };
  const docs = man.documents ?? [];
  const locales = hasFlag("--coverage-only")
    ? [...COVERAGE_LOCALES]
    : [...TARGET_LOCALES];

  const rows = buildLocaleInventory(docs, locales);
  const text = formatInventoryMatrix(rows);

  const out = arg("--out");
  if (out) {
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    fs.writeFileSync(out, text, "utf-8");
    console.log(`[✓] wrote ${out}`);
  }
  process.stdout.write(text);

  if (hasFlag("--gaps")) {
    const gaps = coverageGaps(rows, COVERAGE_LOCALES);
    console.log(`\ncoverage gaps (es/en/zh/hi/ar): ${gaps.length}`);
    for (const g of gaps.slice(0, 40)) {
      console.log(`  ${g.family}  missing ${g.locale}`);
    }
    if (gaps.length > 40) console.log(`  … +${gaps.length - 40} more`);
  }
}

main();
