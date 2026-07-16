/**
 * Unit tests for OCR punctuation repair.
 * Run: npx ts-node --transpile-only repair_ocr_punctuation.test.ts
 */
import {
  letterTokenOverlap,
  letterTokens,
  repairOcrPunctuation,
  repairOcrPunctuationWithStats,
  scoreOcrPunctuation,
} from "./src/pipeline/repair_ocr_punctuation";

let passed = 0;
let failed = 0;

function assert(cond: unknown, msg: string): void {
  if (!cond) {
    failed += 1;
    console.error(`FAIL: ${msg}`);
    return;
  }
  passed += 1;
  console.log(`ok  ${msg}`);
}

function assertEq(actual: string, expected: string, msg: string): void {
  if (actual !== expected) {
    failed += 1;
    console.error(
      `FAIL: ${msg}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`,
    );
    return;
  }
  passed += 1;
  console.log(`ok  ${msg}`);
}

// --- Representative OCR-like broken → fixed ---
assertEq(
  repairOcrPunctuation("VICEPRESIDENTE : R. P."),
  "VICEPRESIDENTE: R. P.",
  "space before colon",
);
assertEq(
  repairOcrPunctuation("MADRID . MCMLXXIX"),
  "MADRID. MCMLXXIX",
  "space before period",
);
assertEq(
  repairOcrPunctuation("B. A. C , ESTA"),
  "B. A. C, ESTA",
  "space before comma",
);
assertEq(
  repairOcrPunctuation("Impreso en.España. Printed"),
  "Impreso en. España. Printed",
  "missing space after sentence period",
);
assertEq(
  repairOcrPunctuation("Nerón7,el gobierno"),
  "Nerón7, el gobierno",
  "comma glued to next word",
);
assertEq(
  repairOcrPunctuation("omisiones.En el año"),
  "omisiones. En el año",
  "lowercase.Upper sentence boundary",
);
assertEq(
  repairOcrPunctuation("ESCRITOS ANTIMANIQUEOS : ESCRITOS"),
  "ESCRITOS ANTIMANIQUEOS: ESCRITOS",
  "space before colon (title)",
);
assertEq(
  repairOcrPunctuation("a . . . . Curación de la hemorroísa"),
  "a... Curación de la hemorroísa",
  "spaced ellipsis / dotted leaders",
);
assertEq(
  repairOcrPunctuation("creados...en orden a las buenas obras"),
  "creados... en orden a las buenas obras",
  "ellipsis glued to following word",
);
assertEq(
  repairOcrPunctuation("creados. . . en orden"),
  "creados... en orden",
  "spaced dots become ellipsis with trailing space preserved via ensure",
);

// --- Spanish inverted marks: keep space after sentence punct ---
assertEq(
  repairOcrPunctuation("llegas al sol. ¿Qué distancia hay?"),
  "llegas al sol. ¿Qué distancia hay?",
  "preserve space before ¿ after period",
);
assertEq(
  repairOcrPunctuation("llegas al sol.¿Qué distancia hay?"),
  "llegas al sol. ¿Qué distancia hay?",
  "restore space between . and ¿",
);
assertEq(
  repairOcrPunctuation("¡Ay de ti! ¿Quién podrá?"),
  "¡Ay de ti! ¿Quién podrá?",
  "preserve ¡ and ¿ spacing",
);

// --- MUST NOT join lowercase.period.lowercase (wording essence) ---
const noJoinCases: Array<[string, string]> = [
  ["que.dista el sol", "que.dista el sol"],
  ["es.decir, mueran", "es.decir, mueran"],
  ["art.cit p.194", "art.cit p.194"],
  ["quia.non sunt", "quia.non sunt"],
  ["prop.er peccatum", "prop.er peccatum"],
  ["Após.ol Pablo", "Após.ol Pablo"],
  ["sancti.ficationis", "sancti.ficationis"],
  ["propt.er peccatum", "propt.er peccatum"],
];
for (const [raw, exp] of noJoinCases) {
  assertEq(
    repairOcrPunctuation(raw),
    exp,
    `must NOT join internal period: ${raw}`,
  );
  assert(
    !repairOcrPunctuation(raw).includes("quedista") &&
      !repairOcrPunctuation(raw).includes("esdecir") &&
      !repairOcrPunctuation(raw).includes("artcit") &&
      !repairOcrPunctuation(raw).includes("quianon"),
    `no nonsense merge tokens for ${raw}`,
  );
}

// Real shipped-path regression snippets (pre-repair forms)
assertEq(
  repairOcrPunctuation(
    "puede calcular lo que.dista el sol de ti? Y, con todo",
  ),
  "puede calcular lo que.dista el sol de ti? Y, con todo",
  "agustin-25 style que.dista preserved",
);
assert(
  repairOcrPunctuation(
    "para ser dichosos, es.decir, mueran, ya que",
  ).includes("es.decir"),
  "es.decir abbreviation/phrase boundary preserved",
);
assert(
  repairOcrPunctuation("(art.cit,, p.194-198)").includes("art.cit"),
  "art.cit abbreviation preserved",
);

// --- Must NOT invent / rewrite wording ---
const stableBody =
  "Dios es bueno y misericordioso. La fe es el fundamento de la salvación.";
assertEq(
  repairOcrPunctuation(stableBody),
  stableBody,
  "clean prose is stable (no invented words)",
);
assertEq(
  repairOcrPunctuation("S.Ag. 26"),
  "S.Ag. 26",
  "single-letter abbreviation period preserved",
);
assertEq(
  repairOcrPunctuation("vol. VII p.753"),
  "vol. VII p.753",
  "already-spaced volume abbr stable",
);
{
  // Spacing/punct-only defects — wording tokens stable
  const broken =
    "Impreso en.España. Nerón7,el gobierno dijo : la gracia de Dios , amen.";
  const fixed = repairOcrPunctuation(broken);
  assertEq(
    fixed,
    "Impreso en. España. Nerón7, el gobierno dijo: la gracia de Dios, amen.",
    "representative OCR spacing sample",
  );
  const overlap = letterTokenOverlap(broken, fixed);
  assert(
    overlap >= 0.99,
    `letter-token overlap stable (≥0.99), got ${overlap.toFixed(4)}`,
  );
  assert(
    !fixed.includes("teología inventada") &&
      letterTokens(fixed).includes("España") &&
      letterTokens(fixed).includes("gobierno") &&
      letterTokens(fixed).includes("gracia"),
    "does not invent theological wording; keeps real tokens",
  );
  assert(
    scoreOcrPunctuation(broken).defectScore >
      scoreOcrPunctuation(fixed).defectScore,
    "defect score drops after repair",
  );
}

// letter tokens must not collapse across internal periods
{
  const raw = "que.dista el sol; es.decir art.cit";
  const fixed = repairOcrPunctuation(raw);
  const tokens = letterTokens(fixed);
  assert(tokens.includes("que"), "keeps token 'que'");
  assert(tokens.includes("dista"), "keeps token 'dista'");
  assert(!tokens.includes("quedista"), "does not invent 'quedista'");
  assert(letterTokenOverlap(raw, fixed) === 1, "overlap 1.0 when only spacing-safe rules");
}

// --- Metrics + withStats ---
{
  const raw = "palabra , otra.Y más;texto";
  const r = repairOcrPunctuationWithStats(raw);
  assert(r.changed === true, "withStats reports changed");
  assert(r.before.defectScore > r.after.defectScore, "withStats defect drop");
  assertEq(r.text, "palabra, otra. Y más; texto", "combined mechanical fixes");
}

// --- Idempotent ---
{
  const once = repairOcrPunctuation("VICEPRESIDENTE : R. P. en.España");
  const twice = repairOcrPunctuation(once);
  assertEq(once, twice, "repair is idempotent");
}

// --- Letter tokens helper ---
assert(
  JSON.stringify(letterTokens("Hola, mundo.")) ===
    JSON.stringify(["Hola", "mundo"]),
  "letterTokens strips punct",
);

// internalWordPeriod is counted but not auto-joined (defectScore ignores it)
{
  const m = scoreOcrPunctuation("que.dista y es.decir");
  assert(m.internalWordPeriod === 2, "counts internal periods for inventory");
  assert(m.defectScore === 0, "internal periods do not drive defectScore");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
