/**
 * Unit tests for OCR noise cleanup (a) spaced letters + (b) garbage units.
 * Run: npx ts-node --transpile-only repair_ocr_noise.test.ts
 */
import {
  OCR_GARBAGE_PLACEHOLDER,
  collapseResidualShreds,
  collapseShortSpacedWords,
  collapseSpacedDigits,
  collapseSpacedLetters,
  isDualColumnShredUnit,
  isEditorialChromeUnit,
  isGarbageUnit,
  isLeaderSoupUnit,
  isResidualBodyNoise,
  isRunningHeaderUnit,
  rejoinMidLineHyphen,
  repairDigitLetterGlue,
  repairGluedTokens,
  repairHighConfidenceOcrConfusions,
  repairOcrNoiseUnit,
  repairOcrSpacedText,
  scoreDocumentGarbage,
  scoreGarbageUnit,
  scoreSpacedLetters,
} from "./src/pipeline/repair_ocr_noise";
import { repairOcrPunctuation } from "./src/pipeline/repair_ocr_punctuation";

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

// --- (a) Spaced-letter collapse ---
assertEq(
  collapseSpacedLetters("DE LA H I S T O R I A, Y DEL"),
  "DE LA HISTORIA, Y DEL",
  "collapse HISTORIA",
);
assertEq(
  collapseSpacedLetters("BARBADO V I E J O, O. P.,"),
  "BARBADO VIEJO, O. P.,",
  "collapse VIEJO",
);
assertEq(
  collapseSpacedLetters("U N I V E R S I D A D"),
  "UNIVERSIDAD",
  "collapse UNIVERSIDAD",
);
assertEq(
  collapseSpacedLetters("t i e r r a y a r r a s t r a d o"),
  "tierra y arrastrado",
  "collapse lowercase spaced words",
);
assertEq(
  collapseSpacedLetters("ÍNDICE G E N E R A L D E CONCEPTOS"),
  "ÍNDICE GENERAL DE CONCEPTOS",
  "collapse + split glued particle DE",
);
assertEq(
  collapseSpacedLetters("La fe es el fundamento de la salvación."),
  "La fe es el fundamento de la salvación.",
  "good prose unchanged by collapse",
);
assertEq(
  collapseSpacedLetters("J. R. R. Tolkien"),
  "J. R. R. Tolkien",
  "initials with periods not collapsed as spaced letters",
);
assertEq(
  collapseSpacedLetters("que.dista el sol; es.decir art.cit"),
  "que.dista el sol; es.decir art.cit",
  "internal periods not joined by collapse",
);

// compose with punct repair still join-safe
assertEq(
  repairOcrSpacedText("DE LA H I S T O R I A , Y DEL"),
  "DE LA HISTORIA, Y DEL",
  "spaced + punct compose",
);
assert(
  repairOcrPunctuation("que.dista").includes("que.dista"),
  "punct repair still preserves que.dista",
);
assert(
  repairOcrSpacedText("es.decir, mueran").includes("es.decir"),
  "spaced path preserves es.decir",
);
assert(
  repairOcrSpacedText("art.cit p.194").includes("art.cit"),
  "spaced path preserves art.cit",
);

{
  const m = scoreSpacedLetters("H I S T O R I A and U N I V E R S I D A D");
  assert(m.spacedLetterRuns === 2, `score spaced runs=2 got ${m.spacedLetterRuns}`);
  assert(m.spacedLetterChars === 8 + 11, `score spaced chars got ${m.spacedLetterChars}`);
}

// --- (b) Garbage TOC / leader noise ---
const tocGarbage =
  "INDICE GENERAL Págs. INTRODUCCIÓN 3 ID Fausto cooicnonnnnnnoncnnonononanncononnoncon ..ooonconicininnionicononcorann 87";
assert(isGarbageUnit(tocGarbage), "TOC leader garbage classified");
assert(scoreGarbageUnit(tocGarbage).score >= 5, "TOC garbage score ≥5");

const tocGarbage2 =
  "2. ¿En qué consiste aceptar el evangelio?... ooonininnionininiononios 87 3. La respuesta ..occocconicinicnnionorererncor 99";
assert(isGarbageUnit(tocGarbage2), "dotted-leader ooon garbage classified");

// good prose must NOT be garbage
const goodProse =
  "Dios es bueno y misericordioso. La fe es el fundamento de la salvación y de la esperanza cristiana.";
assert(!isGarbageUnit(goodProse), "good prose is not garbage");
assertEq(collapseSpacedLetters(goodProse), goodProse, "good prose not gutted by collapse");

// citation list should not be treated as TOC garbage
const citations =
  "Ps 18,6. lo 1,10. 1 Tim 1,15. Ps 40,5. Ps 4,3. Ps 72,9. Mt 11,29.";
assert(!isGarbageUnit(citations), "bible citation list not garbage");

// --- repairOcrNoiseUnit: exclude keeps slot via placeholder ---
{
  const r = repairOcrNoiseUnit(tocGarbage);
  assert(r.excludedGarbage === true, "unit marked excludedGarbage");
  assertEq(r.contenido, OCR_GARBAGE_PLACEHOLDER, "garbage → placeholder");
  assert(r.changed === true, "exclusion counts as changed");
}
{
  const r = repairOcrNoiseUnit("DE LA H I S T O R I A");
  assert(r.excludedGarbage === false, "spaced header not excluded as garbage");
  assertEq(r.contenido, "DE LA HISTORIA", "spaced header collapsed");
  assert(r.collapsedSpaced === true, "collapsedSpaced flag");
}
{
  const r = repairOcrNoiseUnit(goodProse);
  assert(r.changed === false, "good prose unit unchanged");
  assertEq(r.contenido, goodProse, "good prose content stable");
}

// document metrics for re-OCR queue
{
  const m = scoreDocumentGarbage([
    goodProse,
    tocGarbage,
    "H I S T O R I A",
    citations,
  ]);
  assert(m.units === 4, "doc metrics units");
  assert(m.garbageUnits >= 1, "doc metrics finds garbage");
  assert(m.spacedLetterRuns >= 1, "doc metrics finds spaced runs");
  assert(m.residualScore > 0, "residualScore ranks queue");
}

// residual body noise (re-OCR queue) — garbled soup, not good prose
{
  // Low-vowel consonant soup (not TOC junk runs) typical of failed OCR pages
  const soup = Array(12)
    .fill("bcdfghjkl npqstvwxz bdfghjkl pqstvwxz bdfghjkl")
    .join(" ");
  assert(isResidualBodyNoise(soup) === true, "garbled soup is residual body noise");
  assert(isResidualBodyNoise(goodProse) === false, "good prose not residual body noise");
  assert(
    isResidualBodyNoise(OCR_GARBAGE_PLACEHOLDER) === false,
    "placeholder not counted as body noise",
  );
}

// idempotent placeholder
{
  const once = repairOcrNoiseUnit(tocGarbage).contenido;
  const twice = repairOcrNoiseUnit(once).contenido;
  assertEq(once, twice, "placeholder exclusion idempotent");
}

// --- (a2) Short spaced dictionary words ---
assertEq(collapseShortSpacedWords("T a l es la opinión"), "Tal es la opinión", "T a l → Tal");
assertEq(collapseShortSpacedWords("q u e todavía"), "que todavía", "q u e → que");
assertEq(collapseShortSpacedWords("habla d e la deformación"), "habla de la deformación", "d e → de");
assertEq(collapseShortSpacedWords("p o r eso dice"), "por eso dice", "p o r → por");
assertEq(collapseShortSpacedWords("si n o es posible"), "si no es posible", "n o → no");
assertEq(
  collapseShortSpacedWords("y n o el de Jesucristo"),
  "y no el de Jesucristo",
  "y n o → y no (not yno)",
);
assertEq(
  collapseShortSpacedWords("según P L y E J citados"),
  "según P L y E J citados",
  "initials P L / E J not joined",
);
assertEq(
  collapseShortSpacedWords("La fe es el fundamento de la salvación."),
  "La fe es el fundamento de la salvación.",
  "clean prose unchanged by short collapse",
);

// --- (a3) Spaced digits / years / page ranges ---
assertEq(collapseSpacedDigits("París 1 9 4 7"), "París 1947", "year 1 9 4 7 → 1947");
assertEq(
  collapseSpacedDigits("p. 2 2 7 - 2 5 1"),
  "p. 227-251",
  "page range 2 2 7 - 2 5 1 → 227-251",
);
assertEq(
  collapseSpacedDigits("Oxford 1950) 3 3 1 - 3 4 3"),
  "Oxford 1950) 331-343",
  "page range 331-343",
);
assertEq(collapseSpacedDigits("p. 6 5."), "p. 65.", "two-digit page 6 5 → 65");
assertEq(
  collapseSpacedDigits("año 1969 sin espacios"),
  "año 1969 sin espacios",
  "already continuous year unchanged",
);

// --- (a4) High-confidence sample confusions ---
assertEq(repairHighConfidenceOcrConfusions("qiíe todavía"), "que todavía", "qiíe → que");
assertEq(
  repairHighConfidenceOcrConfusions("O ' MEARA, La jeunesse"),
  "O'MEARA, La jeunesse",
  "O ' MEARA → O'MEARA",
);
assertEq(
  repairHighConfidenceOcrConfusions("p..255-58"),
  "p.255-58",
  "p.. → p.",
);
assertEq(
  repairHighConfidenceOcrConfusions("MlCHELE PELLEGRINO"),
  "MICHELE PELLEGRINO",
  "MlCHELE → MICHELE",
);

// --- OBJECTIVE Piganiol bibliography snippet (full compose) ---
const piganiolSnippet =
  "2.s ed. en 1953 ( Roma ). O. c. p.107. T a l es la opinión de M. Piganiol, qiíe todavía habla d e la deformación retórica e insinceridad de las Confesiones en L'empire Romain (París 1 9 4 7 ). MlCHELE PELLEGRINO: Le «Confessioni» di S. Agosíino 161-174 (Roma 1 9 5 6 ). HELENEGROS. La valeur documentaire des Confessions. Edit. de «La Vie spirituelle» (París 1930); P. COURCELLE, Recherches sur les Confessions de S. Augustin p..255-58; O ' MEARA, La jeunesse de S. Augustin (París 1958) p. 2 2 7 - 2 5 1. Neo-platonisme m the conversión of S. Augustine: « Dominican Studies» 3 (Oxford 1950) 3 3 1 - 3 4 3; NÓRREGAARD, Augustins Bekehrung (Tübingem 1923); U- M. MANUCCI, La conversione di S. Agustino e la critica recente: «Miscellanea Agostiniana» II (Roma 1931) 23-48; F. BOLGIANI, La conversione di S. Agostino e il libro VIH delle Confessions (Torino 1956); S. B. FEMIANO, Reflessiorii critiche sul";

{
  const repaired = repairOcrSpacedText(piganiolSnippet);
  assert(!/\bT a l\b/.test(repaired), "Piganiol: no residual T a l");
  assert(!/\bd e\b/.test(repaired), "Piganiol: no residual d e");
  assert(!/\bq u e\b/.test(repaired), "Piganiol: no residual q u e");
  assert(!/\d \d \d \d/.test(repaired), "Piganiol: no spaced 4-digit years");
  assert(!/qiíe/i.test(repaired), "Piganiol: qiíe fixed");
  assert(!/O\s+'\s*MEARA/.test(repaired), "Piganiol: O ' MEARA fixed");
  assert(!/p\.\.(?!\.)/.test(repaired), "Piganiol: p.. fixed");
  assert(repaired.includes("Tal es la opinión"), "Piganiol: Tal joined");
  assert(repaired.includes("habla de la"), "Piganiol: de joined");
  assert(repaired.includes("1947"), "Piganiol: year 1947");
  assert(repaired.includes("1956"), "Piganiol: year 1956");
  assert(repaired.includes("227-251"), "Piganiol: pages 227-251");
  assert(repaired.includes("331-343"), "Piganiol: pages 331-343");
  assert(repaired.includes("O'MEARA"), "Piganiol: O'MEARA");
  assert(repaired.includes("MICHELE PELLEGRINO"), "Piganiol: MICHELE");
  // idempotent
  assertEq(repairOcrSpacedText(repaired), repaired, "Piganiol repair idempotent");
  // unit path
  const unit = repairOcrNoiseUnit(piganiolSnippet);
  assert(unit.changed === true, "Piganiol unit changed");
  assert(unit.excludedGarbage === false, "Piganiol not garbage-excluded");
  assertEq(unit.contenido, repaired, "unit path matches spaced text path");
}

// regression: ≥4 collapse + punct join-safety still hold after compose
assertEq(
  repairOcrSpacedText("DE LA H I S T O R I A , Y DEL"),
  "DE LA HISTORIA, Y DEL",
  "≥4 collapse still in compose after a2/a3",
);
assert(
  repairOcrSpacedText("que.dista el sol; es.decir art.cit").includes("que.dista"),
  "compose still preserves que.dista",
);
assert(
  repairOcrSpacedText("es.decir, mueran").includes("es.decir"),
  "compose still preserves es.decir",
);
assertEq(
  repairOcrSpacedText(goodProse),
  goodProse,
  "clean prose fully unchanged by compose",
);

// metrics expose short/digit counts
{
  const m = scoreSpacedLetters("T a l y París 1 9 4 7 y H I S T O R I A");
  assert(m.shortSpacedWordHits >= 1, `shortSpacedWordHits≥1 got ${m.shortSpacedWordHits}`);
  assert(m.spacedDigitRuns >= 1, `spacedDigitRuns≥1 got ${m.spacedDigitRuns}`);
  assert(m.spacedLetterRuns >= 1, `spacedLetterRuns≥1 got ${m.spacedLetterRuns}`);
}

// --- v3: BAC chrome / headers / glue / hyphen / shreds / digit glue ---
assert(
  isEditorialChromeUnit(
    "BIBLIOTECA DE AUTORES CRISTIANOS MADRID. MCMLXXIX",
  ),
  "BAC chrome short unit",
);
assert(
  isEditorialChromeUnit(
    "LA EDITORIAL CATÓLICA, S. A. — APARTADO 466 MADRID",
  ),
  "Editorial Católica chrome",
);
assert(
  isEditorialChromeUnit(
    "ACABÓSE DE IMPRIMIR ESTA OBRA EL DÍA 15 DE MARZO LAUS DEO",
  ),
  "colophon chrome",
);
assert(
  !isEditorialChromeUnit(goodProse),
  "good prose is not editorial chrome",
);
assert(
  isRunningHeaderUnit("DEL BIEN DEL MATRIMONIO. C-25 15"),
  "running header with C-page",
);
assert(
  isRunningHeaderUnit("Prólogo a las «Confesiones»"),
  "prologue running header",
);
assert(!isRunningHeaderUnit(goodProse), "good prose not running header");

assertEq(
  repairGluedTokens("POR LOSSEÑORESSIGUIENTES:"),
  "POR LOS SEÑORES SIGUIENTES:",
  "LOSSEÑORESSIGUIENTES unglued",
);
assertEq(
  repairGluedTokens("obras de SANAGUSTÍN en laEpístola"),
  "obras de SAN AGUSTÍN en la Epístola",
  "SANAGUSTÍN + laEpístola",
);
assertEq(
  rejoinMidLineHyphen("pro- puestas y abati- tormidad"),
  "propuestas y abatitormidad",
  "mid-line hyphen rejoin",
);
assertEq(
  rejoinMidLineHyphen("Madrid-Alcalá sigue"),
  "Madrid-Alcalá sigue",
  "proper compound hyphen kept (capital second)",
);
assertEq(
  collapseResidualShreds("porq u e todavía hay obst áculo"),
  "porque todavía hay obstáculo",
  "porq u e + obst áculo",
);
assertEq(repairDigitLetterGlue("luz1 divina"), "luz 1 divina", "luz1 → luz 1");
assertEq(
  repairDigitLetterGlue("sabbata22 y resto"),
  "sabbata 22 y resto",
  "sabbata22 spaced",
);
assertEq(
  repairHighConfidenceOcrConfusions("aue diio CONJSEJO limo. SKOUNDA"),
  "que dijo CONSEJO ilmo. SEGUNDA",
  "a4 v3 confusions",
);
assert(
  repairOcrPunctuation("sancti.ficationis y es.decir art.cit").includes(
    "sanctificationis",
  ),
  "whitelist joins sancti.ficationis",
);
assert(
  repairOcrPunctuation("sancti.ficationis y es.decir art.cit").includes(
    "es.decir",
  ),
  "whitelist does not join es.decir",
);
assert(
  repairOcrPunctuation("que.dista").includes("que.dista"),
  "que.dista still preserved",
);

// compose path: chrome blanks via unit path
{
  const r = repairOcrNoiseUnit(
    "BIBLIOTECA DE AUTORES CRISTIANOS MADRID MCMLXXIX",
  );
  assert(r.excludedGarbage === true, "chrome unit excluded");
  assertEq(r.contenido, OCR_GARBAGE_PLACEHOLDER, "chrome → placeholder");
}
{
  const r = repairOcrNoiseUnit(
    "LOSSEÑORESSIGUIENTES firmaron y porq u e pro- puestas luz1",
  );
  assert(r.excludedGarbage === false, "body glue not chrome");
  assert(r.contenido.includes("LOS SEÑORES SIGUIENTES"), "compose unglues");
  assert(r.contenido.includes("porque"), "compose porq u e");
  assert(r.contenido.includes("propuestas"), "compose hyphen");
  assert(r.contenido.includes("luz 1"), "compose digit glue");
  assertEq(
    repairOcrSpacedText(r.contenido),
    r.contenido,
    "v3 body repair idempotent",
  );
}

// --- v4: leader-soup, dual-column shred blank, S.Ag headers, a4 front ---
assert(
  isLeaderSoupUnit(
    "INDICE Págs. intro .. ccoocioo onononic coo 87",
  ),
  "leader-soup short TOC unit",
);
assert(!isLeaderSoupUnit(goodProse), "good prose not leader-soup");
assert(
  isRunningHeaderUnit("S.Ag. 12  145"),
  "S.Ag. N running header",
);
assert(
  isRunningHeaderUnit("Contra Fausto maniqueo 221"),
  "Contra Fausto + page header",
);
assertEq(
  repairHighConfidenceOcrConfusions(
    "Academico de Fslosofia Trilingue VOcALEs Escrriros BIBLICGRAFIA",
  ),
  "Académico de Filosofía Trilingüe VOCALES Escritos BIBLIOGRAFIA",
  "a4 front shred dict",
);
{
  const shred =
    "estilística: los editores benedictinos detec- escritos antidonatistas, 19,34 " +
    "Zugesprochenen fiwr Religion- und siécles 210 n.1 S 498";
  assert(isDualColumnShredUnit(shred) === true, "dual-column shred classified");
  const r = repairOcrNoiseUnit(shred);
  assert(r.excludedGarbage === true, "dual-column shred blanked");
  assertEq(r.contenido, OCR_GARBAGE_PLACEHOLDER, "dual-column → placeholder");
  // a5 must not rejoin inside shred (unit path blanks first)
  assertEq(
    rejoinMidLineHyphen(shred),
    shred,
    "no mid-line rejoin on dual-column shred",
  );
}
assert(
  !isDualColumnShredUnit(goodProse),
  "good prose not dual-column shred",
);
assert(
  repairOcrPunctuation("confesaban.en la fe y es.decir").includes(
    "confesaban en",
  ),
  "whitelist confesaban.en → confesaban en",
);
assert(
  repairOcrPunctuation("confesaban.en la fe y es.decir").includes("es.decir"),
  "confesaban.en whitelist keeps es.decir",
);
{
  const r = repairOcrNoiseUnit(
    "Esckrrros rFiLosórFicOsS catalogo OBRAS COMPLETAS DE SAN AGUST T. XXX VOcALEs Academico Fslosofia",
  );
  assert(r.excludedGarbage === true, "catalog shred chrome blanked");
}

{
  const fs = require("fs") as typeof import("fs");
  const path = require("path") as typeof import("path");
  const repo = path.resolve(__dirname, "..");
  const rel = "documents/agustin-33-antidonatistas-2-es/content.json";
  const a = path.join(repo, "documentos", "corpus", rel);
  const b = path.join(repo, "frontend", "src", "assets", "corpus", rel);
  if (fs.existsSync(a) && fs.existsSync(b)) {
    const ua = JSON.parse(fs.readFileSync(a, "utf8"));
    const ub = JSON.parse(fs.readFileSync(b, "utf8"));
    assert(Array.isArray(ua) && ua.length === ub.length, "golden dual-write length");
    assertEq(
      (ua[0].contenido || "").trim(),
      OCR_GARBAGE_PLACEHOLDER,
      "shipped unit 0 is placeholder (repaired TOC)",
    );
    assertEq(
      (ub[0].contenido || "").trim(),
      OCR_GARBAGE_PLACEHOLDER,
      "assets unit 0 is placeholder",
    );
    const r = repairOcrNoiseUnit(ua[0].contenido);
    assert(r.changed === false, "placeholder unit is idempotent under repairOcrNoiseUnit");
    const spaced = repairOcrNoiseUnit("DE LA H I S T O R I A");
    assertEq(spaced.contenido, "DE LA HISTORIA", "pipeline still collapses HISTORIA");
    assert(
      !(JSON.stringify(ua) as string).includes("H I S T O R I A"),
      "shipped golden has no spaced HISTORIA",
    );
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
