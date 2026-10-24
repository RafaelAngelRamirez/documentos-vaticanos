/**
 * Unit tests for unlinked_ref_classifier (pure logic on real citation strings).
 * Run: npx ts-node --transpile-only unlinked_ref_classifier.test.ts
 */
import bookCodes from "./models/data/book-codes.json";
import docCodesFile from "./models/data/doc-codes.json";
import { BookCodeEntry, DocCodeEntry, buildBookIndex } from "./src/refs/ref-parser";
import {
  buildClassifierContext,
  classifyUnlinkedRef,
  normalizeClusterKey,
  tallyClassifications,
} from "./src/refs/unlinked_ref_classifier";

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

const docCodes = (docCodesFile as { documents: DocCodeEntry[] }).documents;
const bookIndex = buildBookIndex(bookCodes as BookCodeEntry[]);

/** Minimal corpus set matching real pack ids used by classification. */
const corpusDocIds = [
  "cic-es",
  "bible-pueblo-de-dios-es",
  "dv-es",
  "ds-es",
  "cdc-es",
  "lg-es",
  "gs-es",
  "ct-es",
  "agustin-02-confesiones-es",
  "agustin-05-de-trinitate-es",
  "agustin-16-ciudad-de-dios-1-es",
  "clemente-alejandria-pedagogo-es",
  "trento-la",
  "lateran-iv-la",
  "florencia-la",
  "vat-i-la",
  "gregorio-nisa-gran-catequesis-es",
];

const ctx = buildClassifierContext({
  corpusDocIds,
  docCodes,
  bookIndex,
  catalogHints: [
    {
      id: "catechism",
      title: "Catecismo de la Iglesia Católica",
      docCode: "CIC",
      corpusDocId: "cic-es",
    },
  ],
});

// normalizeClusterKey
assert(
  normalizeClusterKey("Cf. DV 11") === normalizeClusterKey("dv 11"),
  "cluster key strips cf and case",
);
assert(
  normalizeClusterKey("  Mt., 18,20 ") === "mt., 18,20",
  "cluster key trims",
);

// year / structural noise — never needs-download
{
  const y = classifyUnlinkedRef("1992", ctx);
  assert(y.class === "year-noise", "1992 class year-noise");
  assert(y.status === "noise/non-document", "1992 noise status");
  assert(y.proposedTarget == null, "1992 no target");
}
{
  const s = classifyUnlinkedRef("primera sección", ctx);
  assert(s.class === "structural-noise", "sección structural");
  assert(s.status === "noise/non-document", "sección noise");
}
{
  const i = classifyUnlinkedRef("ibíd.", ctx);
  assert(i.status === "noise/non-document", "ibíd noise");
}
{
  const d = classifyUnlinkedRef("1 mayo 1991", ctx);
  assert(d.class === "date-noise", "date noise class");
  assert(d.status === "noise/non-document", "date not download");
}

// known abbr DV when unlinked → magisterial-code + in-corpus
{
  const r = classifyUnlinkedRef("DV 11", ctx);
  assert(r.class === "magisterial-code", "DV class");
  assert(r.status === "in-corpus", "DV in corpus");
  assert(r.proposedTarget?.code === "DV", "DV code");
  assert(r.proposedTarget?.corpusDocId === "dv-es", "DV corpus id");
}

// DS-style
{
  const r = classifyUnlinkedRef("Concilio de Trento: DS 1740", ctx);
  assert(r.class === "ds-style", "DS style class");
  assert(r.status === "in-corpus", "DS in corpus");
  assert(r.proposedTarget?.code === "DS", "DS code");
  assert(r.proposedTarget?.corpusDocId === "ds-es", "ds-es");
}
{
  const r = classifyUnlinkedRef("cf. DS 3004", ctx);
  assert(r.class === "ds-style", "cf DS class");
  assert(r.status === "in-corpus", "cf DS in-corpus");
}

// Summa / scholastic — not needs-download as vatican magisterium
{
  const r = classifyUnlinkedRef(
    "Santo Tomás de Aquino, Summa theologiae, 2-2, q. 64, a. 7",
    ctx,
  );
  assert(r.class === "scholastic", "summa scholastic");
  assert(r.status === "not-in-corpus", "summa not vatican pack download");
  assert(r.status !== "noise/non-document", "summa is real document");
}

// CDF free title
{
  const r = classifyUnlinkedRef(
    "Congregación para la Doctrina de la Fe, Instr. Donum vitae 3",
    ctx,
  );
  assert(r.class === "curial", "CDF curial");
  assert(r.status === "needs-vatican.va-download", "CDF needs download");
  assert(
    r.proposedTarget?.title?.toLowerCase().includes("donum"),
    "CDF proposed title",
  );
}

// Patristic Agustín Confessions → in-corpus
{
  const r = classifyUnlinkedRef("San Agustín, Confessiones, 1,1,1", ctx);
  assert(r.class === "patristic", "agustin patristic");
  assert(r.status === "in-corpus", "confessions in corpus");
  assert(
    r.proposedTarget?.corpusDocId === "agustin-02-confesiones-es",
    "confessions id",
  );
}

// Ireneo not in pack
{
  const r = classifyUnlinkedRef(
    "San Ireneo de Lyon, Adversus haereses, 4, 15, 1",
    ctx,
  );
  assert(r.class === "patristic", "ireneo patristic");
  assert(
    r.status === "not-in-corpus" || r.status === "needs-vatican.va-download",
    "ireneo not fully in pack",
  );
}

// Liturgical — not download flag as vatican reading pack by default
{
  const r = classifyUnlinkedRef(
    "Vigilia Pascual, Bendición del agua: Misal Romano",
    ctx,
  );
  assert(r.class === "liturgical", "misal liturgical");
  assert(r.status === "not-in-corpus", "misal not-in-corpus");
  assert(r.status !== "needs-vatican.va-download", "misal not vatican html target");
}

// Bible punctuation failure
{
  const r = classifyUnlinkedRef("Mt., 18,20", ctx);
  assert(r.class === "bible-unresolved", "Mt., bible-unresolved");
  assert(r.status === "in-corpus", "bible pack present");
  assert(r.proposedTarget?.corpusDocId === "bible-pueblo-de-dios-es", "bible id");
}
{
  const r = classifyUnlinkedRef("Cf. Ef., 4,16", ctx);
  assert(r.class === "bible-unresolved", "Ef., bible-unresolved");
}

// Canon law CIC can.
{
  const r = classifyUnlinkedRef("CIC can. 1247", ctx);
  assert(r.class === "canon-law", "can. canon-law");
  assert(r.proposedTarget?.code === "CDC", "maps to CDC not catechism");
  assert(r.proposedTarget?.corpusDocId === "cdc-es", "cdc-es");
  assert(r.status === "in-corpus", "cdc in corpus");
}

// Free title with bracket code
{
  const r = classifyUnlinkedRef(
    "cf. Juan Pablo II,   Catechesi tradendae [CT] 1",
    ctx,
  );
  assert(
    r.class === "magisterial-free-title" || r.class === "magisterial-code",
    "CT free title",
  );
  assert(r.proposedTarget?.code === "CT" || r.proposedTarget?.corpusDocId === "ct-es", "CT target");
  assert(r.status === "in-corpus", "CT in corpus");
}

// Roman catechism → Latin pack when present in corpusDocIds
{
  const r = classifyUnlinkedRef("Catecismo Romano, 1,2,2", ctx);
  assert(r.class === "roman-catechism", "roman catechism class");
  assert(r.proposedTarget?.code === "CR" || r.proposedTarget?.title?.includes("Romano"), "CR target");
  // pack-aware: needs-download unless catecismo-romano-la listed
  assert(
    r.status === "needs-vatican.va-download" ||
      r.status === "in-corpus" ||
      r.status === "known-code-missing-locator",
    "roman cat status pack-aware",
  );
}

// Council Florencia via DS still ds-style with DS target
{
  const r = classifyUnlinkedRef(
    "Concilio de Florencia, año 1442: DS 1331",
    ctx,
  );
  assert(r.class === "ds-style", "florencia DS is ds-style");
  assert(r.proposedTarget?.code === "DS", "primary DS");
}

// Extra / newly scraped codes (RP, DCG)
{
  const r = classifyUnlinkedRef("RP 17", ctx);
  assert(r.class === "magisterial-code", "RP class");
  // rp-es not in this test corpus set → download unless listed
  assert(
    r.status === "needs-vatican.va-download" || r.status === "in-corpus",
    "RP status pack-aware",
  );
  assert(r.proposedTarget?.code === "RP", "RP code");
}
{
  const r = classifyUnlinkedRef("DCG 43", ctx);
  assert(r.class === "magisterial-code", "DCG class");
  assert(r.proposedTarget?.code === "DCG", "DCG code");
  // pack-aware: needs-download unless dcg-es listed in test corpusDocIds
  assert(
    r.status === "needs-vatican.va-download" || r.status === "in-corpus",
    "DCG status pack-aware",
  );
}

// Quoted prose → noise (not download)
{
  const r = classifyUnlinkedRef(
    '"El Verbo se encarnó": Jn 1, 14',
    ctx,
  );
  assert(r.status === "noise/non-document", "quoted prose noise");
  assert(r.class === "prose-noise", "quoted prose class");
}

// Curly quotes (U+201C/U+201D) must be noise, never needs-download
{
  const r = classifyUnlinkedRef(
    "\u201Cel Se\u00f1or os habl\u00f3 cara a cara en la monta\u00f1a, en medio del fuego\u201D: Dt 5, 4",
    ctx,
  );
  assert(r.status === "noise/non-document", "curly quote noise status");
  assert(r.class === "prose-noise", "curly quote prose class");
  assert(r.proposedTarget?.code !== "BIBLIA", "curly quote not BIBLIA");
}

// Subsection-form magisterial: GS 67,3 / GS 67, 2 — NOT bible
{
  for (const s of ["GS 67,3", "GS 67, 2", "cf. GS 67,3"]) {
    const r = classifyUnlinkedRef(s, ctx);
    assert(r.class !== "bible-unresolved", `${s} not bible class`);
    assert(r.proposedTarget?.code !== "BIBLIA", `${s} not BIBLIA target`);
    assert(r.class === "magisterial-code", `${s} magisterial-code`);
    assert(r.proposedTarget?.code === "GS", `${s} code GS`);
    assert(r.proposedTarget?.corpusDocId === "gs-es", `${s} gs-es`);
    assert(r.status === "in-corpus", `${s} in-corpus`);
  }
}

// can. N,M and cans. plural → CDC, not bible / not catechism CIC
{
  const r = classifyUnlinkedRef("can. 443,4", ctx);
  assert(r.class === "canon-law", "can. 443,4 canon-law");
  assert(r.class !== "bible-unresolved", "can. not bible");
  assert(r.proposedTarget?.code === "CDC", "can. → CDC");
  assert(r.status === "in-corpus", "can. cdc in corpus");
}
{
  const r = classifyUnlinkedRef("cf CIC, cans. 916-917", ctx);
  assert(r.class === "canon-law", "cans. canon-law");
  assert(r.proposedTarget?.code === "CDC", "cans. → CDC not CIC catechism");
  assert(r.proposedTarget?.corpusDocId === "cdc-es", "cans. cdc-es");
  assert(r.status === "in-corpus", "cans. in-corpus");
}

// Sermo / Didaché / Epistula forms — NOT bible
{
  for (const s of [
    "Sermo 1,2",
    "Didaché 8,2",
    "Epistula ad Smyrnaeos 8,1",
    "Oratio 1",
  ]) {
    const r = classifyUnlinkedRef(s, ctx);
    assert(r.class !== "bible-unresolved", `${s} not bible`);
    assert(r.proposedTarget?.code !== "BIBLIA", `${s} not BIBLIA`);
    assert(
      r.class === "patristic" || r.class === "unresolved-abbr" || r.class === "unknown",
      `${s} not mislabeled bible (got ${r.class})`,
    );
  }
}

// Ibíd. with locator → noise, not bible
{
  const r = classifyUnlinkedRef("Ibíd. 5,20,1", ctx);
  assert(r.status === "noise/non-document", "Ibíd. locator noise");
  assert(r.class !== "bible-unresolved", "Ibíd. not bible");
  assert(r.proposedTarget?.code !== "BIBLIA", "Ibíd. not BIBLIA");
}

// Clemente / Paedagogus without "San" → patristic + in-corpus
{
  const r = classifyUnlinkedRef(
    "Clemente de Alejandría, Paedagogus 1, 6, 42",
    ctx,
  );
  assert(r.class === "patristic", "clemente patristic");
  assert(r.status === "in-corpus", "clemente pedagogo in corpus");
  assert(
    r.proposedTarget?.corpusDocId === "clemente-alejandria-pedagogo-es",
    "clemente corpus id",
  );
}

// tallyClassifications
{
  const rows = [
    classifyUnlinkedRef("1992", ctx),
    classifyUnlinkedRef("DV 11", ctx),
    classifyUnlinkedRef(
      "Congregación para la Doctrina de la Fe, Instr. Donum vitae 3",
      ctx,
    ),
  ];
  const t = tallyClassifications(rows);
  assert(t.byStatus["noise/non-document"] === 1, "tally noise");
  assert(t.byStatus["in-corpus"] === 1, "tally in-corpus");
  assert(t.byStatus["needs-vatican.va-download"] === 1, "tally download");
  assert(t.byClass["year-noise"] === 1, "tally year class");
}

// Noise rows must never be needs-download
{
  const noiseSamples = [
    "1965",
    "segunda parte",
    "capítulo primero",
    "22 noviembre 1981",
    "I",
    "II",
  ];
  for (const s of noiseSamples) {
    const r = classifyUnlinkedRef(s, ctx);
    assert(
      r.status === "noise/non-document",
      `${s} must be noise, got ${r.status}/${r.class}`,
    );
  }
}

// Real docs must not be noise
{
  const realSamples = [
    "DV 11",
    "Santo Tomás de Aquino, Summa theologiae, 2-2, q. 64, a. 7",
    "Congregación para la Doctrina de la Fe, Instr. Donum vitae 3",
    "San Agustín, Confessiones, 1,1,1",
    "Concilio de Trento: DS 1740",
  ];
  for (const s of realSamples) {
    const r = classifyUnlinkedRef(s, ctx);
    assert(
      r.status !== "noise/non-document",
      `${s} must not be noise, got ${r.class}`,
    );
  }
}

console.log("OK: unlinked_ref_classifier.test.ts passed");
