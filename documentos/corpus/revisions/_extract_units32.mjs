#!/usr/bin/env node
/** Extract strategic samples from agustin-32 content.json */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const CONTENT = path.join(
  ROOT,
  "documentos/corpus/documents/agustin-32-antidonatistas-1-es/content.json",
);
const OUT = path.join(__dirname, "_audit-agustin-32-antidonatistas-1-es-samples.json");

const units = JSON.parse(fs.readFileSync(CONTENT, "utf8"));
const n = units.length;
const front = [...Array(Math.min(80, n)).keys()];
const tail = [...Array(40).keys()].map((i) => n - 40 + i).filter((i) => i >= 0);
const bodyStart = 80;
const bodyEnd = Math.max(bodyStart, n - 40);
const stride = Math.max(1, Math.floor((bodyEnd - bodyStart) / 40));
const mid = [];
for (let i = 0; i < 40; i++) {
  const idx = bodyStart + i * stride;
  if (idx < bodyEnd) mid.push(idx);
}
const extra = [];
for (let i = Math.max(0, n - 200); i < n - 40; i += 4) extra.push(i);
const sample = [...new Set([...front, ...mid, ...tail, ...extra])].sort((a, b) => a - b);

const samples = sample.map((i) => {
  const u = units[i];
  const t = u.contenido || "";
  return {
    unitIndex: i,
    consecutivo: String(u.consecutivo ?? ""),
    len: t.length,
    preview: t.slice(0, 220).replace(/\s+/g, " "),
  };
});

// full pattern counts
const re = {
  toc: /(?:\.{4,}|\. \. \. \.|_{4,})/,
  spaced: /(?<![A-Za-zÁÉÍÓÚÜÑáéíóúüñ])(?:[A-Za-zÁÉÍÓÚÜÑáéíóúüñ])(?: [A-Za-zÁÉÍÓÚÜÑáéíóúüñ]){3,}(?![A-Za-zÁÉÍÓÚÜÑáéíóúüñ])/,
  iwp: /[a-záéíóúüñà-ÿ]{2}\.[a-záéíóúüñà-ÿ]{2}/,
  hyphen: /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{2}-\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{2}/,
  digit: /(?:\d[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{2,}|[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{2,}\d)/,
  moji: /�|Ã¡|Ã©|Ã­|Ã³|Ãº|Ã±|â€™|â€œ|ï¿½/,
  leaders: /(?:\.\s*){3,}|\.{3,}/,
  header: /(?:—\s*\d+\s*—|S\.Ag\.\s*32|OBRAS DE SAN AGUST|Tratado sobre el bautismo\s+\d)/i,
  shredded: /Escrriros|Escurros|Esckrrros|BIBLICGRAFIA|MMNA|ccoocioo|o ccoo/,
  column: /[a-záéíóúñ]{3,}\s{2,}[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\s+\d+/,
  junk: /[oncrim]{12,}/i,
  placeholder: /\[OCR: índice o tabla ilegible omitido\]/,
};

const counts = Object.fromEntries(Object.keys(re).map((k) => [k, 0]));
const examples = Object.fromEntries(Object.keys(re).map((k) => [k, []]));

for (let i = 0; i < n; i++) {
  const t = units[i].contenido || "";
  const c = String(units[i].consecutivo ?? "");
  for (const [k, pat] of Object.entries(re)) {
    if (pat.test(t)) {
      counts[k]++;
      if (examples[k].length < 4) {
        const m = t.match(pat);
        let snip = t.slice(0, 140);
        if (m && m.index != null) {
          const a = Math.max(0, m.index - 30);
          snip = t.slice(a, a + 140);
        }
        examples[k].push({
          unitIndex: i,
          consecutivo: c,
          snippet: snip.replace(/\s+/g, " ").trim(),
        });
      }
    }
  }
}

const payload = {
  unitsTotal: n,
  unitsSampled: sample.length,
  samples,
  counts,
  examples,
};
fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));
console.log(JSON.stringify({ unitsTotal: n, unitsSampled: sample.length, counts }, null, 2));
console.log("wrote", OUT);
