/**
 * Post-process noisy Mansi / Archive.org OCR into cleaner Latin-ish plain text.
 * Does NOT invent content; only normalizes noise.
 *
 *   npx ts-node --transpile-only clean_mansi_text.ts --in raw/X.raw.txt --out clean/Y.txt
 *   npx ts-node --transpile-only clean_mansi_text.ts --in raw/X.raw.txt --out clean/Y.txt --max-chars 120000
 */
import fs from "fs";
import path from "path";
import {
  rejoinHyphenation,
  softNormalize,
  stripPdfChrome,
} from "./src/pipeline/plain_text_units";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i === -1 || i + 1 >= process.argv.length) return undefined;
  return process.argv[i + 1];
}

/** Drop lines that are almost pure OCR garbage / page furniture. */
function dropGarbageLines(text: string): string {
  const out: string[] = [];
  for (const line of text.split("\n")) {
    const s = line.trim();
    if (!s) {
      out.push("");
      continue;
    }
    // lone page numbers / dotted leaders
    if (/^\d{1,5}$/.test(s)) continue;
    if (/^[.\-_=|•·\s]{3,}$/.test(s)) continue;
    // mostly non-letters
    const letters = (s.match(/\p{L}/gu) || []).length;
    if (s.length > 8 && letters / s.length < 0.35) continue;
    // long runs of digits
    if (/^\d[\d\s.,;:]{8,}$/.test(s)) continue;
    // bare "Pag." furniture
    if (/^Pag\.?\s*\d+/i.test(s) && s.length < 20) continue;
    out.push(line);
  }
  return out.join("\n");
}

/**
 * Heuristic: keep paragraphs that look like canons, sessions, or continuous Latin prose.
 */
function preferReadableBlocks(text: string, maxChars: number): string {
  const paras = text
    .split(/\n\s*\n+/)
    .map((p) => p.replace(/\n/g, " ").replace(/\s+/g, " ").trim())
    .filter((p) => p.length >= 40);

  const scored = paras.map((p) => {
    let score = 0;
    if (/^(Canon|Can\.|Sessio|Session|Definitio|Symbolum|Canones)\b/i.test(p))
      score += 50;
    if (/\banathema\s+sit\b/i.test(p)) score += 20;
    if (/\b(si\s+quis|si\s+qui|placuit|statuimus|definimus)\b/i.test(p))
      score += 10;
    // letter ratio
    const letters = (p.match(/\p{L}/gu) || []).length;
    score += Math.min(30, Math.floor((letters / p.length) * 40));
    // penalize heavy OCR junk symbols
    const junk = (p.match(/[|¦§†‡•■□▪▫€£¥]/g) || []).length;
    score -= junk * 3;
    // penalize very short words noise
    if ((p.match(/\b\w\b/g) || []).length > p.split(/\s+/).length * 0.4)
      score -= 15;
    return { p, score };
  });

  scored.sort((a, b) => b.score - a.score);
  // take top blocks until maxChars, then restore rough original order by first occurrence
  const chosen: { p: string; score: number; idx: number }[] = [];
  let used = 0;
  for (const s of scored) {
    if (s.score < 15) continue;
    if (used + s.p.length > maxChars && chosen.length >= 8) break;
    const idx = text.indexOf(s.p.slice(0, 40));
    chosen.push({ ...s, idx: idx < 0 ? used : idx });
    used += s.p.length + 2;
  }
  if (chosen.length === 0) {
    // fallback: soft normalize first maxChars
    return softNormalize(text.slice(0, maxChars));
  }
  chosen.sort((a, b) => a.idx - b.idx);

  // Reformat canons on own blocks
  const lines: string[] = [];
  for (const c of chosen) {
    let p = c.p;
    p = p.replace(/\b(Canon|Can\.|Sessio|Session)\s+(\d+)\b/gi, "\n\n$1 $2\n\n");
    lines.push(p.trim());
  }
  return softNormalize(lines.join("\n\n"));
}

export function cleanMansiText(raw: string, maxChars = 150_000): string {
  let t = raw.replace(/\r\n/g, "\n");
  t = stripPdfChrome(t);
  t = rejoinHyphenation(t);
  t = dropGarbageLines(t);
  // collapse broken letter spacing: "C O N C I L" style (conservative: 3+ single letters)
  t = t.replace(
    /\b(?:[A-Za-zÁÉÍÓÚáéíóú]\s){3,}[A-Za-zÁÉÍÓÚáéíóú]\b/g,
    (m) => m.replace(/\s+/g, ""),
  );
  t = softNormalize(t);
  if (t.length > maxChars) {
    t = preferReadableBlocks(t, maxChars);
  } else {
    t = preferReadableBlocks(t, Math.max(t.length, maxChars));
  }
  return t.trim() + "\n";
}

function main(): void {
  const inp = arg("--in");
  const out = arg("--out");
  const maxChars = parseInt(arg("--max-chars") ?? "150000", 10);
  if (!inp || !out) {
    console.error(
      "Usage: clean_mansi_text.ts --in <raw.txt> --out <clean.txt> [--max-chars 150000]",
    );
    process.exit(1);
  }
  const inPath = path.isAbsolute(inp) ? inp : path.resolve(process.cwd(), inp);
  const outPath = path.isAbsolute(out) ? out : path.resolve(process.cwd(), out);
  if (!fs.existsSync(inPath)) {
    console.error(`Missing ${inPath}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(inPath, "utf-8");
  const clean = cleanMansiText(raw, maxChars);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, clean, "utf-8");
  console.log(
    `[✓] ${outPath} (${clean.length} chars from ${raw.length} raw)`,
  );
}

// CLI entry when this file is the process entrypoint
if (process.argv[1] && process.argv[1].includes("clean_mansi_text")) {
  main();
}
