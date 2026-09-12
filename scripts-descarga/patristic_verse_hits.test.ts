/**
 * Capped patristic bible-cite harvest (tiny in-memory fixture; no corpus).
 * Run: npx ts-node --transpile-only patristic_verse_hits.test.ts
 */
import * as fs from "fs";
import * as path from "path";
import bookCodes from "./models/data/book-codes.json";
import {
  BookCodeEntry,
  buildBookIndex,
  parseBibleCitation,
} from "./src/refs/ref-parser";
import {
  PATRISTIC_VERSE_HITS_CAPS,
  PATRISTIC_VERSE_HITS_FILE,
  buildPatristicVerseHitsFile,
  capPatristicHits,
  collectPatristicVerseHits,
  countVerseKeys,
  extractStrictBibleCitations,
  isStrictBibleCitation,
  validatePatristicVerseHitsFile,
  type PatristicVerseHit,
} from "./src/refs/patristic_verse_hits";

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

const bookIndex = buildBookIndex(bookCodes as BookCodeEntry[]);

{
  const { citations, droppedJunk } = extractStrictBibleCitations(
    "La Iglesia vive de la Eucaristía (Mt 28, 20) aquí.",
    bookIndex,
  );
  assert(
    citations.some((c) => c.bookCode === "Mt" && c.chapter === 28 && c.verseStart === 20),
    "parenthetical Mt 28,20",
  );
  assert(droppedJunk === 0, "no junk on clean paren");
}

{
  const { citations } = extractStrictBibleCitations(
    "como está escrito cf. Gn 1,26-28 en el relato.",
    bookIndex,
  );
  assert(
    citations.some((c) => c.bookCode === "Gn" && c.chapter === 1 && c.verseStart === 26),
    "cf. Gn 1,26-28",
  );
}

{
  const { citations } = extractStrictBibleCitations(
    "Dos testigos (Mt 5,3; Lc 6,20) en el sermón.",
    bookIndex,
  );
  assert(
    citations.some((c) => c.bookCode === "Mt" && c.chapter === 5 && c.verseStart === 3),
    "Mt in multi-atom paren",
  );
  assert(
    citations.some((c) => c.bookCode === "Lc" && c.chapter === 6 && c.verseStart === 20),
    "Lc in multi-atom paren",
  );
}

{
  const { citations, droppedJunk } = extractStrictBibleCitations(
    "Notas de edición (PL 38, 1234) y OCR (Mi 6NE) más (Mt 10,32x).",
    bookIndex,
  );
  assert(
    !citations.some((c) => /PL/i.test(c.raw) || c.bookCode === "Mi"),
    "drops PL and Mi 6NE",
  );
  assert(
    !citations.some((c) => c.bookCode === "Mt" && c.verseStart === 32),
    "drops fused leftover Mt 10,32x",
  );
  assert(droppedJunk >= 1, "counts OCR/edition as junk");
}

{
  const { citations } = extractStrictBibleCitations(
    "El año (1992) y la (primera sección) y (LG 16) no son versos.",
    bookIndex,
  );
  assert(citations.length === 0, "years / sections / ecclesial not bible hits");
}

{
  const parsed = parseBibleCitation("Mt 5", bookIndex);
  assert(parsed?.chapterOnly === true, "Mt 5 is chapter-only");
  assert(
    parsed ? isStrictBibleCitation(parsed, "Mt 5") === false : false,
    "chapter-only is not strict chapter,verse",
  );
}

{
  const { citations } = extractStrictBibleCitations(
    "Epístola (cf. Judas 3) breve.",
    bookIndex,
  );
  assert(
    citations.some((c) => c.verseOnly && c.verseStart === 3),
    "single-chapter Judas 3 allowed",
  );
}

{
  const { raw, stats } = collectPatristicVerseHits(
    [
      {
        documentId: "agustin-corto-es",
        units: [
          { contenido: "Fe (Mt 10,32) en breve.", consecutivo: "1" },
          { contenido: "Rango cf. Gn 1,26-28 no debe expandir 27." },
        ],
      },
    ],
    bookIndex,
  );
  assert(stats.docsScanned === 1, "one fixture doc");
  assert(
    raw.some((h) => h.chapter === 10 && h.verse === 32 && h.unitIndex === 0),
    "maps Mt 10,32",
  );
  const gn = raw.filter((h) => h.bookSlug && h.chapter === 1 && h.verse === 26);
  assert(gn.length === 1, "Gn 1,26-28 only verseStart 26");
  assert(
    !raw.some((h) => h.chapter === 1 && h.verse === 27),
    "does not expand verseEnd to 27",
  );
}

{
  const raw: PatristicVerseHit[] = [];
  for (let i = 0; i < 10; i++) {
    raw.push({
      bookSlug: "genesis",
      chapter: 1,
      verse: 1,
      documentId: `agustin-${i}-es`,
      unitIndex: i,
      consecutivo: String(i),
      snippet: "a",
    });
  }
  const hits = capPatristicHits(raw, { maxPerVerse: 8, maxRows: 4000 });
  assert(hits.length === 8, "cap 8 per verse");
}

{
  const raw: PatristicVerseHit[] = [];
  for (let v = 1; v <= 20; v++) {
    raw.push({
      bookSlug: "genesis",
      chapter: 1,
      verse: v,
      documentId: "agustin-es",
      unitIndex: v,
      consecutivo: String(v),
      snippet: "b",
    });
  }
  const hits = capPatristicHits(raw, { maxPerVerse: 8, maxRows: 10 });
  assert(hits.length === 10, "global cap 10 rows");
  assert(countVerseKeys(hits) === 10, "no extra verses beyond global cap");
}

{
  const file = buildPatristicVerseHitsFile({
    locale: "es",
    generatedAt: "2026-01-01T00:00:00.000Z",
    documentsScanned: 1,
    hits: [
      {
        bookSlug: "genesis",
        chapter: 1,
        verse: 1,
        documentId: "agustin-es",
        unitIndex: 0,
        consecutivo: "1",
        snippet: "In principio",
      },
    ],
  });
  assert(file.version === 1 && file.locale === "es", "file envelope");
  assert(file.caps.maxPerVerse === 8 && file.caps.maxRows === 4000, "caps");
  assert(file.rowCount === 1 && file.documentsScanned === 1, "counts");
  const errs = validatePatristicVerseHitsFile(file, "es");
  assert(errs.length === 0, `valid file: ${errs.join("; ")}`);
}

{
  const bad = {
    version: 1 as const,
    locale: "es",
    generatedAt: "x",
    caps: { maxPerVerse: 8, maxRows: 4000 },
    rowCount: 9,
    documentsScanned: 1,
    hits: Array.from({ length: 9 }, (_, i) => ({
      bookSlug: "genesis",
      chapter: 1,
      verse: 1,
      documentId: "agustin-es",
      unitIndex: i,
      consecutivo: String(i),
      snippet: "c",
    })),
  };
  const errs = validatePatristicVerseHitsFile(bad, "es");
  assert(
    errs.some((e) => /length 9/.test(e)),
    "validate rejects >8 per verse",
  );
}

{
  const badLocale = buildPatristicVerseHitsFile({
    locale: "en",
    documentsScanned: 0,
    hits: [],
  });
  const errs = validatePatristicVerseHitsFile(badLocale, "es");
  assert(
    errs.some((e) => /locale/.test(e)),
    "validate locale mismatch",
  );
}

void PATRISTIC_VERSE_HITS_CAPS;

{
  const corpusHits = path.join(
    __dirname,
    "..",
    "documentos",
    "corpus",
    "search",
    "es",
    PATRISTIC_VERSE_HITS_FILE,
  );
  if (fs.existsSync(corpusHits)) {
    const raw = JSON.parse(fs.readFileSync(corpusHits, "utf8"));
    const sidecarErrs = validatePatristicVerseHitsFile(raw, "es");
    assert(
      sidecarErrs.length === 0,
      `shipped sidecar invalid: ${sidecarErrs.join("; ")}`,
    );
  }
}

console.log("patristic_verse_hits.test.ts: ok");
