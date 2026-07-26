#!/usr/bin/env node
/** Extract strategic samples + defect counts from agustin-31 content.json */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const CONTENT = path.join(
  ROOT,
  "documentos/corpus/documents/agustin-31-antimaniqueos-2-es/content.json",
);
const OUT = path.join(__dirname, "_audit-agustin-31-antimaniqueos-2-es-samples.json");
const REPORT = path.join(__dirname, "_audit-agustin-31-antimaniqueos-2-es-report.json");

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
for (let i = 80; i < Math.min(150, n); i += 3) extra.push(i);
const sample = [...new Set([...front, ...mid, ...tail, ...extra])].sort((a, b) => a - b);

const PLACEHOLDER = "[OCR: índice o tabla ilegible omitido]";
const LETTER = "A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÿ";
const LOWER = "a-záéíóúüñà-ÿ";

const re = {
  toc_dotted_garbage: /(?:\.{4,}|\. \. \. \.|_{4,}|(?:o ccoo|ccoocioo|cooicnon|oooocnc|ononon))/i,
  bac_chrome_frontmatter:
    /BIBLIOTECA DE AUTORES CRISTIANOS|PONTIFICIA UNIVERSIDAD DE SALAMANCA|DEP[ÓO]SITO LEGAL|Depósito legal|ISBN:|ORDEN SISTEM|Escrrros|Escrriros|Escurros|BIBLICGRAFIA|MCMXC|IMPRENTA|Nihil obstat|Imprimatur/i,
  spaced_or_shredded_letters: new RegExp(
    `(?<![${LETTER}])(?:[${LETTER}])(?: [${LETTER}]){3,}(?![${LETTER}])`,
  ),
  internal_word_period: new RegExp(`[${LOWER}]{2}\\.[${LOWER}]{2}`),
  hyphen_mid_line: new RegExp(`[${LETTER}]{2}-\\s+[${LETTER}]{2}`),
  digit_glued_tokens: new RegExp(`(?:\\d[${LETTER}]{2,}|[${LETTER}]{2,}\\d)`),
  "mojibake/replacement_chars": /�|Ã¡|Ã©|Ã­|Ã³|Ãº|Ã±|â€™|â€œ|ï¿½/,
  ellipses_leaders: /(?:\.\s*){3,}|\.{3,}/,
  page_headers_footers:
    /(?:—\s*\d+\s*—|OBRAS DE SAN AGUST|ESCRITOS ANTIMANIQU|CONTRA FAUSTO\s*[-–—]?\s*\d+|S\.Ag\.\s*31)/i,
  wrong_column_merge:
    /(?:[a-záéíóúñ]{3,}\s{2,}[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\s+\d)|(?:\b\d{1,3}\s+[A-Za-záéíóúñ]{3,}\s+\d{1,3}\s+[A-Za-záéíóúñ]{3,})/,
  other_illegible: /[oncrim]{12,}/i,
  glued_words:
    /\b(?:PORLOS|ELAÑO|DELA[A-ZÁÉÍÓÚÑ]{2,}|LOSSEÑORES\w*|[A-ZÁÉÍÓÚÑ]{14,}|[A-ZÁÉÍÓÚÑ]{3,}(?:DE|LA|LOS|LAS|EL|EN|DEL|CON|POR|QUE)[A-ZÁÉÍÓÚÑ]{3,})\b/,
  latin_mixed:
    /\b(?:quia|quod|quae|sicut|enim|autem|igitur|propter|secundum|dicitur|huius|eius)\b/gi,
  accent_corruption:
    /\b(?:Escrriros|Escurros|Esckrrros|BIBLICGRAFIA|Escrrros|Acadénico|Fslosofía|Trilingúe|Confesstones|Epsst|petitio principít|be venido)\b/i,
  index_noise: /(?:índice|indice de|véase|v\.\s*t\.|cf\.|cfr\.)/i,
};

const covered = {
  toc_dotted_garbage: "partial",
  bac_chrome_frontmatter: "none",
  spaced_or_shredded_letters: "full",
  internal_word_period: "none",
  hyphen_mid_line: "none",
  glued_words: "partial",
  digit_glued_tokens: "none",
  "mojibake/replacement_chars": "none",
  latin_mixed_into_spanish_body: "none",
  wrong_column_merge: "none",
  accent_corruption: "partial",
  ellipses_leaders: "partial",
  page_headers_footers: "none",
  index_noise: "partial",
  other_illegible: "none",
};

function snip(t, m) {
  if (!t) return "";
  if (!m || m.index == null) return t.slice(0, 120).replace(/\s+/g, " ");
  const a = Math.max(0, m.index - 30);
  return t.slice(a, a + 120).replace(/\s+/g, " ").trim();
}

const counts = {};
const examples = {};
const add = (cls, i, c, t, m) => {
  counts[cls] = (counts[cls] || 0) + 1;
  examples[cls] = examples[cls] || [];
  if (examples[cls].length < 4) {
    examples[cls].push({
      unitIndex: i,
      consecutivo: c,
      snippet: snip(t, m),
    });
  }
};

let frontNoise = 0;
let bodyNoise = 0;
let indexNoiseN = 0;
let high = 0;
let bodySevSum = 0;
let bodySevN = 0;

for (let i = 0; i < n; i++) {
  const t = units[i].contenido || "";
  const c = String(units[i].consecutivo ?? "");
  const classes = [];

  if (t.trim() === PLACEHOLDER) {
    add("toc_dotted_garbage", i, c, t, null);
    classes.push("toc_dotted_garbage");
  } else {
    if (re.toc_dotted_garbage.test(t)) {
      const m = t.match(re.toc_dotted_garbage);
      add("toc_dotted_garbage", i, c, t, m);
      classes.push("toc_dotted_garbage");
    }
    if (
      i < 120 &&
      (re.bac_chrome_frontmatter.test(t) ||
        /ORDEN SISTEM|MCMXC|PORLOS|ELAÑO|VOcALEs|aga:/i.test(t))
    ) {
      const m = t.match(re.bac_chrome_frontmatter);
      add("bac_chrome_frontmatter", i, c, t, m);
      classes.push("bac_chrome_frontmatter");
    }
    if (re.spaced_or_shredded_letters.test(t)) {
      add("spaced_or_shredded_letters", i, c, t, t.match(re.spaced_or_shredded_letters));
      classes.push("spaced_or_shredded_letters");
    }
    if (re.internal_word_period.test(t)) {
      add("internal_word_period", i, c, t, t.match(re.internal_word_period));
      classes.push("internal_word_period");
    }
    if (re.hyphen_mid_line.test(t)) {
      add("hyphen_mid_line", i, c, t, t.match(re.hyphen_mid_line));
      classes.push("hyphen_mid_line");
    }
    if (re.glued_words.test(t) || /[a-záéíóúñ]{3,}[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}/.test(t)) {
      const m = t.match(re.glued_words) || t.match(/[a-záéíóúñ]{3,}[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}/);
      add("glued_words", i, c, t, m);
      classes.push("glued_words");
    }
    if (re.digit_glued_tokens.test(t)) {
      add("digit_glued_tokens", i, c, t, t.match(re.digit_glued_tokens));
      classes.push("digit_glued_tokens");
    }
    if (re["mojibake/replacement_chars"].test(t)) {
      add("mojibake/replacement_chars", i, c, t, t.match(re["mojibake/replacement_chars"]));
      classes.push("mojibake/replacement_chars");
    }
    const latin = t.match(re.latin_mixed) || [];
    if (i > 100 && latin.length >= 5 && /\b(?:que|los|las|del|por|con)\b/i.test(t)) {
      add("latin_mixed_into_spanish_body", i, c, t, latin);
      classes.push("latin_mixed_into_spanish_body");
    }
    if (re.wrong_column_merge.test(t)) {
      add("wrong_column_merge", i, c, t, t.match(re.wrong_column_merge));
      classes.push("wrong_column_merge");
    }
    if (re.accent_corruption.test(t)) {
      add("accent_corruption", i, c, t, t.match(re.accent_corruption));
      classes.push("accent_corruption");
    }
    if (
      !classes.includes("toc_dotted_garbage") &&
      re.ellipses_leaders.test(t) &&
      (t.match(re.ellipses_leaders) || []).length >= 2
    ) {
      add("ellipses_leaders", i, c, t, t.match(re.ellipses_leaders));
      classes.push("ellipses_leaders");
    }
    if (re.page_headers_footers.test(t) && t.length < 220) {
      add("page_headers_footers", i, c, t, t.match(re.page_headers_footers));
      classes.push("page_headers_footers");
    }
    if (i >= n - 250) {
      const nums = (t.match(/\b\d+\b/g) || []).length;
      const words = t.match(new RegExp(`[${LETTER}]+`, "g")) || [];
      if (
        (nums >= 5 && words.length && nums / words.length > 0.25) ||
        re.index_noise.test(t) ||
        (t.length < 100 && nums >= 2)
      ) {
        add("index_noise", i, c, t, null);
        classes.push("index_noise");
      }
    }
    if (re.other_illegible.test(t)) {
      add("other_illegible", i, c, t, t.match(re.other_illegible));
      classes.push("other_illegible");
    } else {
      const letters = t.match(new RegExp(`[${LETTER}]`, "g")) || [];
      if (letters.length > 80) {
        const vowels = letters.filter((ch) => /[aeiouáéíóúü]/i.test(ch)).length;
        if (vowels / letters.length < 0.28) {
          add("other_illegible", i, c, t, null);
          classes.push("other_illegible");
        }
      }
    }
  }

  // severity approx
  let sev = 0;
  const weights = {
    toc_dotted_garbage: 40,
    bac_chrome_frontmatter: 12,
    spaced_or_shredded_letters: 35,
    internal_word_period: 18,
    hyphen_mid_line: 10,
    glued_words: 15,
    digit_glued_tokens: 10,
    "mojibake/replacement_chars": 40,
    latin_mixed_into_spanish_body: 22,
    wrong_column_merge: 45,
    accent_corruption: 18,
    ellipses_leaders: 10,
    page_headers_footers: 12,
    index_noise: 30,
    other_illegible: 50,
  };
  for (const cl of classes) sev += weights[cl] || 10;
  if (sev >= 35) high++;
  if (i < 120 && classes.length) frontNoise++;
  if (i >= 200 && i < n - 200) {
    bodySevSum += sev;
    bodySevN++;
    if (sev >= 25) bodyNoise++;
  }
  if (i >= n - 200 && classes.includes("index_noise")) indexNoiseN++;
}

const samples = sample.map((i) => {
  const t = units[i].contenido || "";
  return {
    unitIndex: i,
    consecutivo: String(units[i].consecutivo ?? ""),
    len: t.length,
    preview: t.slice(0, 220).replace(/\s+/g, " "),
  };
});

const bodyAvg = bodySevN ? bodySevSum / bodySevN : 0;
const highRatio = high / Math.max(n, 1);
let severityScore = Math.min(
  100,
  Math.round(
    bodyAvg * 0.55 + highRatio * 100 * 0.35 + (frontNoise > 30 ? 15 : 5) + (indexNoiseN > 20 ? 10 : 0),
  ),
);

// human calibration: BAC body mostly readable, front/index dirty
// residualScore inventory 218 → map loosely to severity 30-40 range if body ok
if (bodyAvg < 12 && (counts.other_illegible || 0) < 20) {
  severityScore = Math.min(severityScore, 38);
}
if ((counts.toc_dotted_garbage || 0) > 40) severityScore = Math.max(severityScore, 32);
if ((counts.index_noise || 0) > 30) severityScore = Math.max(severityScore, 34);

const defectClasses = Object.entries(counts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 16)
  .map(([cls, count]) => ({
    class: cls,
    count,
    coveredByExistingRepair: covered[cls] || "unknown",
    examples: (examples[cls] || []).slice(0, 4),
  }));

const findings = [
  `Pack BAC XXXI antimaniqueos-2 ES (Contra Fausto): ${n} units; ocr-punct-v2 changed 257; ocr-abc-v2 changed 261 (spaced collapse; residualBodyNoiseUnits=14, residualScore=218, queueReocr=true).`,
  `Front chrome BAC noisy (units ~0–80): comisión/orden sistemático, MCMXCIN/MCMXCIHI, PORLOS/ELAÑO glued, Escrrros titles.`,
  `TOC general + índices finales: dotted-leader soup (cooicnon/oooocnc/ononon) — garbageUnits still 0 (placeholder threshold rarely met); tocLeaderHits=1 residual.`,
  `Body Spanish prose of Contra Fausto largely readable; intentional bilingual Latin blocks (CSEL) coexist — not pure dual-stream OCR bleed.`,
  `Tail: índice de nombres/materias and notas complementarias show wrong_column_merge and index_noise.`,
  `spaced_or_shredded_letters residual=${counts.spaced_or_shredded_letters || 0} after ocr-abc-v2 (expected ~0).`,
  `internal_word_period residual=${counts.internal_word_period || 0} (ocr-punct after=18; deliberately no join).`,
  `hyphen_mid_line residual=${counts.hyphen_mid_line || 0}; digit_glued_tokens=${counts.digit_glued_tokens || 0}; glued_words=${counts.glued_words || 0}.`,
  `Full-scan high-severity units (≥35): ${high}/${n}; body_avg_severity≈${bodyAvg.toFixed(1)}; front_noise_units=${frontNoise}; index_noise_tail=${indexNoiseN}.`,
  `ocr-abc residual: junkRunHits=3; residualBodyNoiseUnits=14 — spot-check then re-OCR body-noise pages rather than paraphrase.`,
];

const suggestedRules = [
  "Front-only dict map high-confidence shredded tokens: Escrrros|Escrriros|Escurros→Escritos, BIBLICGRAFIA→BIBLIOGRAFÍA, Acadénico→Académico, Fslosofía→Filosofía, MCMXCIN→MCMXCIII (do not touch body theology).",
  "Mark short TOC lines with leader soup (cooicnon|oooocnc|ononon + \\.{2,}|\\.{3,}) as OCR_GARBAGE_PLACEHOLDER keeping unitIndex.",
  "Rejoin hyphen+space mid-line only for lowercase letter runs: /([a-záéíóúñ]{2,})-\\s+([a-záéíóúñ]{2,})/ → $1$2 (not across units).",
  "Strip/blank short running-head units matching Contra Fausto / OBRAS DE SAN AGUSTÍN + page nums or lone — N — (keep slots).",
  "Split digit↔letter glue conservatively excluding bibl. abbreviations: /(\\d)([A-Za-záéíóúñ]{3,})/ and /([A-Za-záéíóúñ]{3,})(\\d{2,})/.",
  "Extend glued particle split for PORLOS→POR LOS, ELAÑO→EL AÑO in uppercase chrome only.",
  "Do NOT auto-join internal lowercase.period.lowercase; optional dictionary whitelist only for clear mid-word OCR splits.",
  "Never reorder units; never paraphrase theological body. Prefer re-OCR residualBodyNoise pages.",
];

const report = {
  documentId: "agustin-31-antimaniqueos-2-es",
  unitsSampled: sample.length,
  unitsTotal: n,
  severityScore,
  frontMatterNoise: frontNoise > 20,
  bodyProseNoise: bodyNoise > 50 || bodyAvg >= 18 || (counts.other_illegible || 0) >= 8,
  indexGarbage: indexNoiseN > 15 || (counts.index_noise || 0) > 20 || (counts.wrong_column_merge || 0) >= 10,
  findings: findings.slice(0, 10),
  defectClasses,
  suggestedRules: suggestedRules.slice(0, 8),
  _debug: {
    bodyAvg: Math.round(bodyAvg * 100) / 100,
    high,
    frontNoise,
    indexNoiseN,
    bodyNoise,
    counts,
  },
};

fs.writeFileSync(OUT, JSON.stringify({ samples, counts, examples }, null, 2), "utf8");
fs.writeFileSync(REPORT, JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify(report, null, 2));
