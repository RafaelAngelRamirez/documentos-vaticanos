/**
 * Deterministic semantic classifier for unlinked inter-document references.
 *
 * Pure functions (no I/O): given a raw citation string + corpus/catalog context,
 * assign a semantic class and status among:
 *   in-corpus | known-code-missing-locator | not-in-corpus |
 *   noise/non-document | needs-vatican.va-download
 *
 * Complements ref-parser's basic path (book-codes + doc-codes + resolve:refs):
 * the parser marks many patristic/conciliar/free-title strings as "noise" so the
 * reader does not invent navigable links; this worksheet re-classifies those
 * strings for corpus acquisition / future resolver work.
 */

import {
  BookIndex,
  DocCodeEntry,
  DocIndex,
  buildDocIndex,
  normalizeAbbr,
  parseBibleCitation,
  parseEcclesialCitation,
  parseRefGroup,
} from "./ref-parser";

export type UnlinkedRefStatus =
  | "in-corpus"
  | "known-code-missing-locator"
  | "not-in-corpus"
  | "noise/non-document"
  | "needs-vatican.va-download";

export type UnlinkedRefClass =
  | "structural-noise"
  | "year-noise"
  | "date-noise"
  | "fragment-noise"
  | "prose-noise"
  | "bible-unresolved"
  | "ds-style"
  | "magisterial-code"
  | "magisterial-free-title"
  | "patristic"
  | "conciliar"
  | "curial"
  | "liturgical"
  | "canon-law"
  | "roman-catechism"
  | "scholastic"
  | "unresolved-abbr"
  | "unknown";

export interface ProposedTarget {
  code?: string | null;
  corpusDocId?: string | null;
  title?: string | null;
  catalogFamilyId?: string | null;
}

export interface ClassificationResult {
  raw: string;
  class: UnlinkedRefClass;
  status: UnlinkedRefStatus;
  proposedTarget: ProposedTarget | null;
  notes?: string;
  /** Kind from parseRefGroup when available (noise|bible|ecclesial|unresolved). */
  parserKind?: string;
}

export interface TitleHit {
  code: string;
  corpusDocId: string | null;
  title: string;
  kind?: string;
}

export interface CatalogHint {
  id: string;
  title: string;
  docCode?: string | null;
  corpusDocId?: string | null;
  hubUrl?: string | null;
}

export interface ClassifierContext {
  corpusDocIds: Set<string>;
  docCodes: DocCodeEntry[];
  docIndex: DocIndex;
  bookIndex: BookIndex;
  /** Normalized title/alias → hit */
  titleIndex: Map<string, TitleHit>;
  catalogHints?: CatalogHint[];
}

const STRUCTURAL_EXACT = new Set(
  [
    "primera parte",
    "segunda parte",
    "tercera parte",
    "cuarta parte",
    "primera sección",
    "segunda sección",
    "tercera sección",
    "cuarta sección",
    "primera seccion",
    "segunda seccion",
    "tercera seccion",
    "cuarta seccion",
    "capítulo primero",
    "capítulo segundo",
    "capítulo tercero",
    "capitulo primero",
    "capitulo segundo",
    "capitulo tercero",
    "el símbolo",
    "el simbolo",
    "los mandamientos",
    "el padre nuestro",
    "mediante cf.",
    "mediante cf",
    "ibíd.",
    "ibid.",
    "ibid",
    "ibíd",
    "ibíd.,",
    "filioque",
    "confessio",
    "pulcher",
    "sancti",
    "sancta",
    "viri",
    "de cristo",
    "cristo",
  ].map(normalizeLoose),
);

/** Spanish month names for date noise (e.g. "1 mayo 1991"). */
const MONTH_RE =
  /(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/i;

/** Known council name fragments → doc-codes code */
const COUNCIL_HINTS: Array<{ re: RegExp; code: string }> = [
  { re: /\bvaticano\s*i\b|\bvaticanum\s*i\b/i, code: "VatI" },
  { re: /\bvaticano\s*ii\b|\bvaticanum\s*ii\b/i, code: "LG" }, // Vat II docs in pack; LG as generic fallback via free title
  { re: /\btrento\b|\btridentin/i, code: "Trent" },
  { re: /\bletr[aá]n\s*iv\b|\blateranense\s*iv\b/i, code: "LatIV" },
  { re: /\bletr[aá]n\s*i\b/i, code: "LatIV" },
  { re: /\bflorencia\b|\bflorentin/i, code: "Ephes" }, // placeholder — florencia has corpus id
  { re: /\bnicea\s*i\b|\bnicaen/i, code: "Nicaea" },
  { re: /\bnicea\s*ii\b/i, code: "NicaeaII" },
  { re: /\bcalcedonia\b|\bchalcedon/i, code: "Chalc" },
  { re: /\b[eé]feso\b|\bephes/i, code: "Ephes" },
  { re: /\bconstantinopla\s*i\b/i, code: "ConstI" },
  { re: /\bconstantinopla\s*ii\b/i, code: "ConstII" },
  { re: /\bconstantinopla\s*iii\b/i, code: "ConstIII" },
  { re: /\bconstantinopla\s*iv\b/i, code: "ConstIV" },
];

/** Explicit corpus ids for councils not fully covered by doc-codes alone. */
const COUNCIL_CORPUS: Array<{
  re: RegExp;
  corpusDocId: string | null;
  title: string;
}> = [
  {
    re: /\bflorencia\b|\bflorentin/i,
    corpusDocId: "florencia-la",
    title: "Concilium Florentinum",
  },
  {
    re: /\bconstanza\b/i,
    corpusDocId: "constanza-la",
    title: "Concilium Constantiense",
  },
  {
    re: /\bvienne\b/i,
    corpusDocId: "vienne-la",
    title: "Concilium Viennense",
  },
  {
    re: /\blyon\s*i\b|\blugdunense\s*i\b/i,
    corpusDocId: "lyon-i-la",
    title: "Concilium Lugdunense I",
  },
  {
    re: /\blyon\s*ii\b|\blugdunense\s*ii\b/i,
    corpusDocId: "lyon-ii-la",
    title: "Concilium Lugdunense II",
  },
  {
    re: /\bletr[aá]n\s*v\b/i,
    corpusDocId: "lateran-v-la",
    title: "Concilium Lateranense V",
  },
  {
    re: /\bletr[aá]n\s*iii\b/i,
    corpusDocId: "lateran-iii-la",
    title: "Concilium Lateranense III",
  },
  {
    re: /\bletr[aá]n\s*ii\b/i,
    corpusDocId: "lateran-ii-la",
    title: "Concilium Lateranense II",
  },
  {
    re: /\bletr[aá]n\s*i\b(?!\s*v)/i,
    corpusDocId: "lateran-i-la",
    title: "Concilium Lateranense I",
  },
  {
    re: /\btoledo\b/i,
    corpusDocId: null,
    title: "Concilio de Toledo (local)",
  },
];

/** Patristic author / work → corpus doc when present in pack. */
const PATRISTIC_HINTS: Array<{
  re: RegExp;
  corpusDocId: string | null;
  title: string;
}> = [
  {
    re: /agust[ií]n.*confession|confessiones/i,
    corpusDocId: "agustin-02-confesiones-es",
    title: "Agustín, Confessiones",
  },
  {
    re: /agust[ií]n.*trinitate|de\s+trinitate/i,
    corpusDocId: "agustin-05-de-trinitate-es",
    title: "Agustín, De Trinitate",
  },
  {
    re: /ciudad\s+de\s+dios|de\s+civitate\s+dei/i,
    corpusDocId: "agustin-16-ciudad-de-dios-1-es",
    title: "Agustín, Ciudad de Dios",
  },
  {
    re: /agust[ií]n.*enarracion|enarrationes\s+in\s+psalmos/i,
    corpusDocId: "agustin-19-enarraciones-salmos-1-es",
    title: "Agustín, Enarrationes in Psalmos",
  },
  {
    re: /agust[ií]n.*evangelio.*juan|in\s+iohannis\s+evangelium/i,
    corpusDocId: "agustin-13-evangelio-juan-1-es",
    title: "Agustín, Tratado sobre el Evangelio de Juan",
  },
  {
    re: /gregorio\s+de\s+nisa|gregorio\s+nisa|nyssa/i,
    corpusDocId: "gregorio-nisa-gran-catequesis-es",
    title: "Gregorio de Nisa",
  },
  {
    re: /cirilo\s+de\s+jerusal[eé]n|catequesis/i,
    corpusDocId: "cirilo-jerusalen-catequesis-es",
    title: "Cirilo de Jerusalén, Catequesis",
  },
  {
    re: /clemente\s+de\s+alejandr[ií]a|pedagogo|paedagogus/i,
    corpusDocId: "clemente-alejandria-pedagogo-es",
    title: "Clemente de Alejandría, Pedagogo",
  },
  {
    re: /cipriano|cyprian/i,
    corpusDocId: "cipriano-cartas-es",
    title: "Cipriano, Cartas",
  },
  {
    re: /diogneto/i,
    corpusDocId: "carta-diogneto-es",
    title: "Carta a Diogneto",
  },
  {
    re: /ignacio\s+de\s+antioqu[ií]a|epistula\s+ad\s+(smyrnaeos|ephesios|romanos)/i,
    corpusDocId: null,
    title: "Ignacio de Antioquía (cartas)",
  },
  {
    re: /ireneo|adversus\s+haereses/i,
    corpusDocId: null,
    title: "Ireneo de Lyon, Adversus haereses",
  },
  {
    re: /hip[oó]lito|traditio\s+apostolica/i,
    corpusDocId: null,
    title: "Hipólito, Traditio apostolica",
  },
  {
    re: /tertuliano|de\s+oratione/i,
    corpusDocId: null,
    title: "Tertuliano",
  },
  {
    re: /juan\s+cris[oó]stomo|chrysostom/i,
    corpusDocId: null,
    title: "Juan Crisóstomo",
  },
  {
    re: /\bagust[ií]n\b|\baugustin/i,
    corpusDocId: "agustin-01-primeros-escritos-es",
    title: "Agustín (obra genérica en pack)",
  },
];

const CURIAL_FREE_TITLES: Array<{
  re: RegExp;
  title: string;
  code?: string;
  corpusDocId?: string | null;
  note?: string;
}> = [
  {
    re: /donum\s+vitae/i,
    title: "CDF, Instr. Donum vitae",
    code: "DonV",
    corpusDocId: "donum-vitae-es",
    note: "Instrucción CDF 1987",
  },
  {
    re: /donum\s+veritatis/i,
    title: "CDF, Instr. Donum veritatis",
  },
  {
    re: /persona\s+humana/i,
    title: "CDF, Decl. Persona humana",
    code: "PH",
    corpusDocId: "persona-humana-es",
  },
  {
    re: /mysterium\s+ecclesiae/i,
    title: "CDF, Decl. Mysterium Ecclesiae",
  },
  {
    re: /indulgentiarum\s+doctrina/i,
    title: "Indulgentiarum doctrina",
    code: "ID",
    corpusDocId: "indulgentiarum-doctrina-es",
  },
];

/**
 * Magisterial codes frequently cited in CCC footnotes but not yet in
 * doc-codes.json (or listed only as blocklist tokens). Status = download
 * when no corpusDocId in pack.
 */
const EXTRA_MAGISTERIAL_CODES: Array<{
  code: string;
  re: RegExp;
  title: string;
  corpusDocId: string | null;
}> = [
  {
    code: "RP",
    re: /\bRP\b/,
    title: "Reconciliatio et paenitentia",
    corpusDocId: "rp-es",
  },
  {
    code: "DCG",
    re: /\bDCG\b/,
    title: "Directorio Catequético General (1971)",
    corpusDocId: null,
  },
  {
    code: "DeV",
    re: /\bDeV\b/,
    title: "Dominum et Vivificantem",
    corpusDocId: "dev-es",
  },
  {
    code: "MF",
    re: /\bMF\b/,
    title: "Mysterium Fidei",
    corpusDocId: "mf-es",
  },
  {
    code: "TMA",
    re: /\bTMA\b/,
    title: "Tertio millennio adveniente",
    corpusDocId: null,
  },
  {
    code: "EE",
    re: /\bEE\b/,
    title: "Ecclesia de Eucharistia",
    corpusDocId: null,
  },
  {
    code: "SA",
    re: /\bSA\b/,
    title: "Salvifici doloris",
    corpusDocId: null,
  },
  {
    code: "PG",
    re: /\bPG\b/,
    title: "Pastores gregis",
    corpusDocId: "pg-es",
  },
  {
    code: "MM",
    re: /\bMM\b/,
    title: "Mater et Magistra",
    corpusDocId: null,
  },
  {
    code: "PT",
    re: /\bPT\b/,
    title: "Pacem in terris",
    corpusDocId: "pt-es",
  },
];

function normalizeLoose(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Cluster key: collapse whitespace, strip leading cf., lowercase. */
export function normalizeClusterKey(raw: string): string {
  return normalizeLoose(raw)
    .replace(/^(?:cf\.?|v[eé]ase|tambi[eé]n)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildTitleIndex(docs: DocCodeEntry[]): Map<string, TitleHit> {
  const m = new Map<string, TitleHit>();
  for (const d of docs) {
    const hit: TitleHit = {
      code: d.code,
      corpusDocId: d.corpusDocId,
      title: d.title,
      kind: d.kind,
    };
    const keys = new Set<string>();
    keys.add(normalizeLoose(d.title));
    keys.add(normalizeLoose(d.code));
    for (const a of d.aliases ?? []) {
      keys.add(normalizeLoose(a));
    }
    for (const k of keys) {
      if (k && !m.has(k)) m.set(k, hit);
    }
  }
  return m;
}

export function buildClassifierContext(opts: {
  corpusDocIds: Iterable<string>;
  docCodes: DocCodeEntry[];
  bookIndex: BookIndex;
  catalogHints?: CatalogHint[];
}): ClassifierContext {
  return {
    corpusDocIds: new Set(opts.corpusDocIds),
    docCodes: opts.docCodes,
    docIndex: buildDocIndex(opts.docCodes),
    bookIndex: opts.bookIndex,
    titleIndex: buildTitleIndex(opts.docCodes),
    catalogHints: opts.catalogHints,
  };
}

function statusForCorpusId(
  corpusDocId: string | null | undefined,
  ctx: ClassifierContext,
  hasLocator: boolean,
): UnlinkedRefStatus {
  if (!corpusDocId) {
    return "needs-vatican.va-download";
  }
  if (ctx.corpusDocIds.has(corpusDocId)) {
    return hasLocator ? "in-corpus" : "known-code-missing-locator";
  }
  return "needs-vatican.va-download";
}

function lookupCode(code: string, ctx: ClassifierContext): DocCodeEntry | null {
  const upper = code.toUpperCase();
  const fromIndex =
    ctx.docIndex.get(upper) ?? ctx.docIndex.get(normalizeAbbr(code));
  if (fromIndex) {
    return (
      ctx.docCodes.find((d) => d.code === fromIndex.code) ?? {
        code: fromIndex.code,
        aliases: fromIndex.aliases,
        title: fromIndex.title,
        corpusDocId: fromIndex.corpusDocId,
        locatorType: fromIndex.locatorType,
        kind: fromIndex.kind,
      }
    );
  }
  return ctx.docCodes.find((d) => d.code.toUpperCase() === upper) ?? null;
}

function matchTitleInText(raw: string, ctx: ClassifierContext): TitleHit | null {
  const n = normalizeLoose(raw);
  // Prefer longer aliases
  let best: TitleHit | null = null;
  let bestLen = 0;
  for (const [alias, hit] of ctx.titleIndex) {
    if (alias.length < 4) continue;
    if (n.includes(alias) && alias.length > bestLen) {
      best = hit;
      bestLen = alias.length;
    }
  }
  return best;
}

function matchCatalog(raw: string, ctx: ClassifierContext): CatalogHint | null {
  if (!ctx.catalogHints?.length) return null;
  const n = normalizeLoose(raw);
  let best: CatalogHint | null = null;
  let bestLen = 0;
  for (const h of ctx.catalogHints) {
    const t = normalizeLoose(h.title);
    if (t.length >= 6 && n.includes(t) && t.length > bestLen) {
      best = h;
      bestLen = t.length;
    }
  }
  return best;
}

/**
 * Bible-like only when a real book alias resolves after light punctuation
 * normalization. Never use a loose CODE n,m regex alone — that mislabels
 * "GS 67,3", "can. 443,4", "Sermo 1,2", "Ibíd. 5,20,1" as bible.
 */
function isBibleLikeUnresolved(raw: string, ctx: ClassifierContext): boolean {
  const stripped = raw
    .replace(/^(?:cf\.?|v[eé]ase|tambi[eé]n)\s+/i, "")
    .trim();
  if (!stripped) return false;

  // Hard exclusions: non-biblical citation families
  if (
    /^(?:ib[ií]d\.?|ibid\.?)\b/i.test(stripped) ||
    /\bcans?\.?\s*\d/i.test(stripped) ||
    /\bCIC\b.*\bcans?\.?\b/i.test(stripped) ||
    /\b(?:sermo|oratio|epistula|didach|csel|pl\s*\d|pg\s*\d)\b/i.test(
      stripped,
    ) ||
    /\bDS\b/.test(stripped)
  ) {
    return false;
  }

  // ALL-CAPS / known ecclesial token + number → not bible (GS 67,3; DV 11)
  const magLead = stripped.match(
    /^([A-Za-zÁÉÍÓÚáéíóúÜüñÑ.]{1,12})\s+\d/i,
  );
  if (magLead) {
    const token = magLead[1].replace(/\./g, "");
    const letters = token.replace(/[^A-Za-z]/g, "");
    if (
      letters.length >= 2 &&
      letters === letters.toUpperCase() &&
      (ctx.docIndex.get(token.toUpperCase()) ||
        ctx.docIndex.get(normalizeAbbr(token)))
    ) {
      return false;
    }
    // Extra magisterial codes not yet in doc-codes
    for (const extra of EXTRA_MAGISTERIAL_CODES) {
      if (extra.re.test(token) || extra.re.test(stripped)) return false;
    }
  }

  // Normalize "Mt., 18,20" / "Ef., 4,16" / "1 Cor, 15,28"
  const relaxed = stripped
    .replace(/\b([1-3]?\s*[A-Za-zÁÉÍÓÚáéíóúñÑ]{1,12})\.\s*,/g, "$1 ")
    .replace(/\b([1-3]?\s*[A-Za-zÁÉÍÓÚáéíóúñÑ]{1,12})\.,/g, "$1 ")
    .replace(/\b([1-3]?\s*[A-Za-zÁÉÍÓÚáéíóúñÑ]{1,12}),\s+(\d)/g, "$1 $2")
    .replace(/,\s*(?=\d)/g, ","); // keep chapter,verse form for parser

  // Also try "Mt 18,20" (drop trailing dots on abbr only)
  const noDotAbbr = stripped.replace(
    /\b([1-3]?\s*[A-Za-zÁÉÍÓÚáéíóúñÑ]{1,12})\.(?=\s|,)/g,
    "$1",
  );

  if (parseBibleCitation(relaxed, ctx.bookIndex)) return true;
  if (parseBibleCitation(noDotAbbr, ctx.bookIndex)) return true;
  if (parseBibleCitation(stripped.replace(/\./g, " "), ctx.bookIndex)) {
    return true;
  }
  // Require a real book match — no bare CODE n,m fallback
  return false;
}

function looksLikeDocumentTitle(raw: string): boolean {
  const t = raw.trim();
  if (t.length < 12) return false;
  // Has capitalised multi-word title or Latin italic-style work
  if (/[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+){1,6}/.test(t)) {
    return true;
  }
  if (/\b(?:enc\.|exhort\.|const\.|instr\.|decl\.|carta|ep[ií]stola)\b/i.test(t)) {
    return true;
  }
  return false;
}

/**
 * Classify a single raw citation string (one atom or full descripcion).
 */
export function classifyUnlinkedRef(
  raw: string,
  ctx: ClassifierContext,
): ClassificationResult {
  const original = raw ?? "";
  const t = original.trim();
  if (!t) {
    return {
      raw: original,
      class: "fragment-noise",
      status: "noise/non-document",
      proposedTarget: null,
      notes: "empty",
    };
  }

  // Parser kind for diagnostics
  let parserKind: string | undefined;
  try {
    const atoms = parseRefGroup(t, {
      bookIndex: ctx.bookIndex,
      docIndex: ctx.docIndex,
    });
    if (atoms.length === 1) parserKind = atoms[0].kind;
    else if (atoms.length > 1) {
      parserKind = atoms.map((a) => a.kind).join("+");
    }
  } catch {
    parserKind = undefined;
  }

  // --- Noise families ---
  if (/^\d{3,4}\.?$/.test(t)) {
    return {
      raw: original,
      class: "year-noise",
      status: "noise/non-document",
      proposedTarget: null,
      notes: "pure year footnote",
      parserKind,
    };
  }

  if (/^\d{1,2}$/.test(t) || /^[IVXLC]{1,6}$/i.test(t)) {
    return {
      raw: original,
      class: "fragment-noise",
      status: "noise/non-document",
      proposedTarget: null,
      notes: "bare number or roman numeral",
      parserKind,
    };
  }

  // Dates: "1 mayo 1991", "22 noviembre 1981"
  if (
    new RegExp(`^\\d{1,2}\\s+${MONTH_RE.source}\\s+\\d{4}\\.?$`, "i").test(t) ||
    new RegExp(`^\\d{1,2}\\s+de\\s+${MONTH_RE.source}\\s+de\\s+\\d{4}`, "i").test(
      t,
    )
  ) {
    return {
      raw: original,
      class: "date-noise",
      status: "noise/non-document",
      proposedTarget: null,
      notes: "publication date, not a document id",
      parserKind,
    };
  }

  const loose = normalizeLoose(t);
  if (STRUCTURAL_EXACT.has(loose) || STRUCTURAL_EXACT.has(loose.replace(/\.$/, ""))) {
    return {
      raw: original,
      class: "structural-noise",
      status: "noise/non-document",
      proposedTarget: null,
      notes: "internal section / ibid / fragment",
      parserKind,
    };
  }

  // "cf. Capítulo segundo", "artículo 2", bare verse-like "12, 1"
  if (
    /^(?:cf\.?\s*)?cap[ií]tulo\s+(?:primero|segundo|tercero|cuarto|\d+)/i.test(
      t,
    ) ||
    /^(?:cf\.?\s*)?art[ií]culo\s+\d+/i.test(t) ||
    /^\d{1,3}\s*,\s*\d{1,3}$/.test(t)
  ) {
    return {
      raw: original,
      class: "structural-noise",
      status: "noise/non-document",
      proposedTarget: null,
      notes: "internal chapter/article or bare coords",
      parserKind,
    };
  }

  // "año 325" historical year labels
  if (/^a[nñ]o\s+\d{3,4}\.?$/i.test(t)) {
    return {
      raw: original,
      class: "year-noise",
      status: "noise/non-document",
      proposedTarget: null,
      notes: "year label with año prefix",
      parserKind,
    };
  }

  // Quoted prose / slogan fragments (ASCII + curly U+201C/U+201D/U+2018/U+2019)
  const openQuote = /^[\u0022\u00AB\u201C\u2018\u201E\u201A„«]/u;
  const anyQuote = /[\u0022\u00AB\u00BB\u201C\u201D\u2018\u2019\u201E]/u;
  if (
    openQuote.test(t) ||
    (anyQuote.test(t) &&
      t.length > 40 &&
      !/\bDS\b|\bCIC\b|\bcans?\.?/i.test(t))
  ) {
    return {
      raw: original,
      class: "prose-noise",
      status: "noise/non-document",
      proposedTarget: null,
      notes: "quoted prose / slogan fragment",
      parserKind,
    };
  }

  // Long prose without citation-like structure
  if (
    t.length > 90 &&
    !/\bDS\b|\bCIC\b|\bcans?\.?|Concilio|Congregaci[oó]n|San[toa]?\s/i.test(
      t,
    ) &&
    !/\b[A-Z]{2,5}\s+\d/.test(t)
  ) {
    return {
      raw: original,
      class: "prose-noise",
      status: "noise/non-document",
      proposedTarget: null,
      notes: "long prose without document locator",
      parserKind,
    };
  }

  // Ibid. with optional internal locators (not a document target)
  if (/^(?:ib[ií]d\.?|ibid\.?)\b/i.test(t.replace(/^(?:cf\.?\s*)/i, ""))) {
    return {
      raw: original,
      class: "structural-noise",
      status: "noise/non-document",
      proposedTarget: null,
      notes: "ibidem with optional locator",
      parserKind,
    };
  }

  // --- Canon law BEFORE bible/ecclesial CIC: can. / cans. → CDC ---
  if (
    /\bCIC\b.*\bcans?\.?\b/i.test(t) ||
    /\bcans?\.?\s*\d/i.test(t) ||
    /\bCDC\b/i.test(t) ||
    /\bc[oó]digo\s+de\s+derecho\s+can[oó]nico\b/i.test(t)
  ) {
    const entry = lookupCode("CDC", ctx);
    const corpusDocId = entry?.corpusDocId ?? "cdc-es";
    const loc = t.match(/cans?\.?\s*(\d+)/i);
    return {
      raw: original,
      class: "canon-law",
      status: statusForCorpusId(corpusDocId, ctx, Boolean(loc)),
      proposedTarget: {
        code: "CDC",
        corpusDocId,
        title: entry?.title ?? "Código de Derecho Canónico",
      },
      notes: "CIC can(s). in footnotes = Codex Iuris Canonici (CDC), not Catechism",
      parserKind,
    };
  }

  // --- DS / Denzinger (often embedded after council name) ---
  const dsMatch = t.match(/\bDS\s*(\d{1,5})(?:\s*[-–—]\s*(\d{1,5}))?/i);
  if (dsMatch || /\bdenzinger\b/i.test(t)) {
    const entry = lookupCode("DS", ctx);
    const corpusDocId = entry?.corpusDocId ?? "ds-es";
    const hasLoc = Boolean(dsMatch?.[1]);
    if (/\bconcilio\b/i.test(t) && !/^\s*cf\.?\s*DS\b/i.test(t)) {
      const council = classifyCouncil(t, ctx, parserKind);
      if (council) {
        return {
          ...council,
          class: "ds-style",
          notes: `${council.notes ?? ""}; primary navigable target often DS ${dsMatch?.[1] ?? ""}`.trim(),
          proposedTarget: {
            code: "DS",
            corpusDocId,
            title: entry?.title ?? "Denzinger-Schönmetzer",
          },
          status: statusForCorpusId(corpusDocId, ctx, hasLoc),
          parserKind,
        };
      }
    }
    return {
      raw: original,
      class: "ds-style",
      status: statusForCorpusId(corpusDocId, ctx, hasLoc),
      proposedTarget: {
        code: "DS",
        corpusDocId,
        title: entry?.title ?? "Denzinger-Schönmetzer",
      },
      notes: hasLoc
        ? `DS locator ${dsMatch![1]}${dsMatch![2] ? "–" + dsMatch![2] : ""}`
        : "DS mention without locator",
      parserKind,
    };
  }

  // --- Known magisterial codes via ecclesial parser (before bible) ---
  // Handles "GS 67", "GS 67,3" / "GS 67, 2" (locator = first number)
  const eccRaw = t.replace(/^(?:cf\.?|v[eé]ase|tambi[eé]n)\s+/i, "").trim();
  // Normalize subsection comma so "GS 67,3" → try "GS 67" for code match
  const eccTry = [
    t,
    eccRaw,
    eccRaw.replace(/^([A-ZÁÉÍÓÚÑ]{2,8})\s+(\d{1,5})\s*,\s*\d+/i, "$1 $2"),
  ];
  let ecc = null as ReturnType<typeof parseEcclesialCitation>;
  for (const candidate of eccTry) {
    ecc = parseEcclesialCitation(candidate, ctx.docIndex);
    if (ecc) break;
  }
  if (ecc) {
    const corpusDocId = ecc.corpusDocId ?? null;
    const hasLoc = Boolean(ecc.locator);
    return {
      raw: original,
      class: "magisterial-code",
      status: statusForCorpusId(corpusDocId, ctx, hasLoc),
      proposedTarget: {
        code: ecc.code,
        corpusDocId,
        title: ecc.title ?? null,
      },
      notes: hasLoc
        ? `code ${ecc.code} locator ${ecc.locator}`
        : `code ${ecc.code} without locator`,
      parserKind,
    };
  }

  // Extra codes not yet in doc-codes (RP, DCG, DeV, …)
  for (const extra of EXTRA_MAGISTERIAL_CODES) {
    if (!extra.re.test(t)) continue;
    const loc = t.match(
      new RegExp(extra.code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*(\\d{1,5})", "i"),
    );
    const hasLoc = Boolean(loc?.[1]);
    return {
      raw: original,
      class: "magisterial-code",
      status: statusForCorpusId(extra.corpusDocId, ctx, hasLoc),
      proposedTarget: {
        code: extra.code,
        corpusDocId: extra.corpusDocId,
        title: extra.title,
      },
      notes: hasLoc
        ? `extra code ${extra.code} locator ${loc![1]}`
        : `extra code ${extra.code} (not in doc-codes yet)`,
      parserKind,
    };
  }

  // Bracketed codes: "Catechesi tradendae [CT] 1"
  const bracket = t.match(/\[([A-Za-z]{2,6})\]\s*(\d{1,5})?/);
  if (bracket) {
    const entry = lookupCode(bracket[1], ctx);
    if (entry) {
      const hasLoc = Boolean(bracket[2]);
      return {
        raw: original,
        class: "magisterial-free-title",
        status: statusForCorpusId(entry.corpusDocId, ctx, hasLoc),
        proposedTarget: {
          code: entry.code,
          corpusDocId: entry.corpusDocId,
          title: entry.title,
        },
        notes: `bracket code [${bracket[1]}]`,
        parserKind,
      };
    }
  }

  // --- Liturgical ---
  if (
    /\bmisal\s+romano\b/i.test(t) ||
    /\bpontifical\s+romano\b/i.test(t) ||
    /\bliturgia\b/i.test(t) ||
    /\bplegaria\s+eucar[ií]stica\b/i.test(t) ||
    /\bvigilia\s+pascual\b/i.test(t) ||
    /\brito\s+de\b/i.test(t)
  ) {
    return {
      raw: original,
      class: "liturgical",
      status: "not-in-corpus",
      proposedTarget: {
        code: null,
        corpusDocId: null,
        title: "Libros litúrgicos (Misal / Pontifical / Liturgia)",
      },
      notes: "liturgical book — not in reading corpus; not vatican.va HTML pack target by default",
      parserKind,
    };
  }

  // --- Roman Catechism ---
  if (/\bcatecismo\s+romano\b/i.test(t) || /\bcatechismus\s+romanus\b/i.test(t)) {
    return {
      raw: original,
      class: "roman-catechism",
      status: "needs-vatican.va-download",
      proposedTarget: {
        code: null,
        corpusDocId: null,
        title: "Catecismo Romano (Trento / Pío V)",
      },
      notes: "historical catechism; not CIC pack",
      parserKind,
    };
  }

  // --- Curial / CDF ---
  if (
    /\bcongregaci[oó]n\s+para\b/i.test(t) ||
    /\bCDF\b/.test(t) ||
    /\bSagrada\s+Congregaci[oó]n\b/i.test(t) ||
    /\bInstr\.?\s+/i.test(t) && /doctrina\s+de\s+la\s+fe/i.test(t)
  ) {
    for (const h of CURIAL_FREE_TITLES) {
      if (h.re.test(t)) {
        const corpusDocId = h.corpusDocId ?? null;
        const hasLoc = /\d{1,5}/.test(t);
        return {
          raw: original,
          class: "curial",
          status: statusForCorpusId(corpusDocId, ctx, hasLoc),
          proposedTarget: {
            code: h.code ?? null,
            corpusDocId,
            title: h.title,
          },
          notes: h.note ?? "curial instruction/declaration",
          parserKind,
        };
      }
    }
    return {
      raw: original,
      class: "curial",
      status: "needs-vatican.va-download",
      proposedTarget: {
        code: null,
        corpusDocId: null,
        title: t.slice(0, 120),
      },
      notes: "curial / Roman dicastery text",
      parserKind,
    };
  }
  for (const h of CURIAL_FREE_TITLES) {
    if (h.re.test(t)) {
      const corpusDocId = h.corpusDocId ?? null;
      const hasLoc = /\d{1,5}/.test(t);
      return {
        raw: original,
        class: "curial",
        status: statusForCorpusId(corpusDocId, ctx, hasLoc),
        proposedTarget: {
          code: h.code ?? null,
          corpusDocId,
          title: h.title,
        },
        notes: h.note ?? "curial free title",
        parserKind,
      };
    }
  }

  // --- Conciliar ---
  if (/\bconcilio\b/i.test(t) || /\bconcilium\b/i.test(t) || /\bs[ií]nodo\b/i.test(t)) {
    const council = classifyCouncil(t, ctx, parserKind);
    if (council) return council;
  }

  // --- Scholastic (Aquinas etc.) ---
  if (
    /santo\s+tom[aá]s|san\s+tom[aá]s|aquino|summa\s+theologiae|summa\s+contra\s+gentiles|\bS\.?\s*Th\.?\b/i.test(
      t,
    )
  ) {
    return {
      raw: original,
      class: "scholastic",
      status: "not-in-corpus",
      proposedTarget: {
        code: null,
        corpusDocId: null,
        title: "Tomás de Aquino / Summa (fuera del pack actual)",
      },
      notes: "scholastic source; not vatican.va magisterium pack",
      parserKind,
    };
  }

  // --- Patristic: always try PATRISTIC_HINTS first (even without "San ") ---
  for (const h of PATRISTIC_HINTS) {
    if (!h.re.test(t)) continue;
    const inPack =
      h.corpusDocId != null && ctx.corpusDocIds.has(h.corpusDocId);
    return {
      raw: original,
      class: "patristic",
      status: inPack
        ? "in-corpus"
        : h.corpusDocId
          ? "needs-vatican.va-download"
          : "not-in-corpus",
      proposedTarget: {
        code: null,
        corpusDocId: h.corpusDocId,
        title: h.title,
      },
      notes: inPack
        ? "patristic work present in corpus (locator may still be hard)"
        : "patristic work not in pack or only partial",
      parserKind,
    };
  }
  if (
    /\bsan[toa]?\s+/i.test(t) ||
    /\bepistula\b/i.test(t) ||
    /\badversus\b/i.test(t) ||
    /\bsermo\b/i.test(t) ||
    /\boratio\b/i.test(t) ||
    /\bdidach/i.test(t) ||
    /\bcsel\b/i.test(t) ||
    /\btertuliano\b|\bireneo\b|\bhip[oó]lito\b|\bignacio\b|\bagust[ií]n\b|\baugustin|\bclemente\b|\bcipriano\b|\bdiogneto\b/i.test(
      t,
    )
  ) {
    return {
      raw: original,
      class: "patristic",
      status: "not-in-corpus",
      proposedTarget: {
        code: null,
        corpusDocId: null,
        title: t.slice(0, 100),
      },
      notes: "patristic-style citation without mapped corpus id",
      parserKind,
    };
  }

  // --- Free title match against doc-codes / catalog ---
  const titleHit = matchTitleInText(t, ctx);
  if (titleHit) {
    const hasLoc = /\d{1,5}/.test(t);
    return {
      raw: original,
      class: "magisterial-free-title",
      status: statusForCorpusId(titleHit.corpusDocId, ctx, hasLoc),
      proposedTarget: {
        code: titleHit.code,
        corpusDocId: titleHit.corpusDocId,
        title: titleHit.title,
      },
      notes: "matched doc-codes title/alias in free text",
      parserKind,
    };
  }

  const cat = matchCatalog(t, ctx);
  if (cat) {
    const corpusDocId = cat.corpusDocId ?? null;
    return {
      raw: original,
      class: "magisterial-free-title",
      status: statusForCorpusId(corpusDocId, ctx, /\d/.test(t)),
      proposedTarget: {
        code: cat.docCode ?? null,
        corpusDocId,
        title: cat.title,
        catalogFamilyId: cat.id,
      },
      notes: "matched source-catalog family title",
      parserKind,
    };
  }

  // Discursos / mensajes radiofónicos / relación final — papal speeches
  if (
    /\bdiscurso\b/i.test(t) ||
    /\bmensaje\s+radiof[oó]nico\b/i.test(t) ||
    /\brelaci[oó]n\s+final\b/i.test(t) ||
    /\basamblea\b/i.test(t)
  ) {
    return {
      raw: original,
      class: "magisterial-free-title",
      status: "needs-vatican.va-download",
      proposedTarget: {
        code: null,
        corpusDocId: null,
        title: t.slice(0, 120),
      },
      notes: "speech / synod relation — download candidate if tracked",
      parserKind,
    };
  }

  // Papal encyclical free titles: "León XIII, Carta enc. Libertas…"
  if (
    /\b(?:le[oó]n\s+xiii|p[ií]o\s+[ivx]+|pablo\s+vi|juan\s+pablo|benedicto|francisco)\b/i.test(
      t,
    ) &&
    /\b(?:enc\.|enc[ií]clica|exhort\.|carta\s+ap|const\.|motu\s+proprio)\b/i.test(
      t,
    )
  ) {
    return {
      raw: original,
      class: "magisterial-free-title",
      status: "needs-vatican.va-download",
      proposedTarget: {
        code: null,
        corpusDocId: null,
        title: t.slice(0, 160),
      },
      notes: "papal encyclical/exhortation free title",
      parserKind,
    };
  }

  // Credo del Pueblo de Dios (Pablo VI)
  if (/\bcredo\s+del\s+pueblo\s+de\s+dios\b/i.test(t)) {
    const cpdId = "cpd-es";
    const hasLoc = /\d{1,5}/.test(t);
    return {
      raw: original,
      class: "magisterial-free-title",
      status: statusForCorpusId(cpdId, ctx, hasLoc),
      proposedTarget: {
        code: "CPD",
        corpusDocId: cpdId,
        title: "Credo del Pueblo de Dios (Pablo VI)",
      },
      notes: "1968 profession of faith",
      parserKind,
    };
  }

  // --- Bible unresolved LAST among real citation families ---
  // Only when a real book alias matches after punctuation normalize.
  if (isBibleLikeUnresolved(t, ctx)) {
    const bibleId = "bible-pueblo-de-dios-es";
    return {
      raw: original,
      class: "bible-unresolved",
      status: ctx.corpusDocIds.has(bibleId)
        ? "in-corpus"
        : "needs-vatican.va-download",
      proposedTarget: {
        code: "BIBLIA",
        corpusDocId: bibleId,
        title: "Biblia (Pueblo de Dios)",
      },
      notes: "bible-like; basic parser missed punctuation (abbr., ch,v)",
      parserKind,
    };
  }

  // Short unresolved abbreviation-like
  if (/^[A-Za-zÁÉÍÓÚáéíóúñÑ.]{1,8}\s+\d{1,5}/.test(t) && t.length < 40) {
    return {
      raw: original,
      class: "unresolved-abbr",
      status: "not-in-corpus",
      proposedTarget: null,
      notes: "short abbr+number not in doc-codes",
      parserKind,
    };
  }

  if (looksLikeDocumentTitle(t)) {
    return {
      raw: original,
      class: "unknown",
      status: "needs-vatican.va-download",
      proposedTarget: {
        code: null,
        corpusDocId: null,
        title: t.slice(0, 160),
      },
      notes: "title-like string without catalog match",
      parserKind,
    };
  }

  // Residual fragments / short prose
  if (t.length < 40 && !/\d/.test(t)) {
    return {
      raw: original,
      class: "fragment-noise",
      status: "noise/non-document",
      proposedTarget: null,
      notes: "short non-numeric fragment",
      parserKind,
    };
  }

  return {
    raw: original,
    class: "unknown",
    status: "not-in-corpus",
    proposedTarget: null,
    notes: "no deterministic match",
    parserKind,
  };
}

function classifyCouncil(
  t: string,
  ctx: ClassifierContext,
  parserKind?: string,
): ClassificationResult | null {
  for (const c of COUNCIL_CORPUS) {
    if (c.re.test(t)) {
      if (!c.corpusDocId) {
        return {
          raw: t,
          class: "conciliar",
          status: "not-in-corpus",
          proposedTarget: { title: c.title, corpusDocId: null, code: null },
          notes: "local/regional council not in ecumenical pack",
          parserKind,
        };
      }
      const inPack = ctx.corpusDocIds.has(c.corpusDocId);
      return {
        raw: t,
        class: "conciliar",
        status: inPack ? "in-corpus" : "needs-vatican.va-download",
        proposedTarget: {
          title: c.title,
          corpusDocId: c.corpusDocId,
          code: null,
        },
        notes: inPack ? "council text in corpus" : "council missing from pack",
        parserKind,
      };
    }
  }
  for (const h of COUNCIL_HINTS) {
    if (h.re.test(t)) {
      // Vat II is many docs — mark as free if "Vaticano II" alone
      if (h.code === "LG" && /vaticano\s*ii/i.test(t)) {
        const titleHit = matchTitleInText(t, ctx);
        if (titleHit) {
          return {
            raw: t,
            class: "conciliar",
            status: statusForCorpusId(titleHit.corpusDocId, ctx, /\d/.test(t)),
            proposedTarget: {
              code: titleHit.code,
              corpusDocId: titleHit.corpusDocId,
              title: titleHit.title,
            },
            notes: "Vatican II document via free title",
            parserKind,
          };
        }
        return {
          raw: t,
          class: "conciliar",
          status: "in-corpus",
          proposedTarget: {
            code: null,
            corpusDocId: null,
            title: "Concilio Vaticano II (varios documentos en pack)",
          },
          notes: "Vat. II multi-doc; prefer specific constitution/decree",
          parserKind,
        };
      }
      const entry = lookupCode(h.code, ctx);
      if (entry) {
        return {
          raw: t,
          class: "conciliar",
          status: statusForCorpusId(entry.corpusDocId, ctx, /\d/.test(t)),
          proposedTarget: {
            code: entry.code,
            corpusDocId: entry.corpusDocId,
            title: entry.title,
          },
          notes: "council matched via doc-codes",
          parserKind,
        };
      }
    }
  }
  // Generic conciliar/synodal
  if (/\bs[ií]nodo\b/i.test(t)) {
    return {
      raw: t,
      class: "conciliar",
      status: "needs-vatican.va-download",
      proposedTarget: {
        title: t.slice(0, 120),
        corpusDocId: null,
        code: null,
      },
      notes: "synod document / relation",
      parserKind,
    };
  }
  if (/\bconcilio\b/i.test(t)) {
    return {
      raw: t,
      class: "conciliar",
      status: "not-in-corpus",
      proposedTarget: {
        title: t.slice(0, 120),
        corpusDocId: null,
        code: null,
      },
      notes: "council mention without mapped pack id",
      parserKind,
    };
  }
  return null;
}

/** Aggregate counts by status and class. */
export function tallyClassifications(
  rows: ClassificationResult[],
): { byStatus: Record<string, number>; byClass: Record<string, number> } {
  const byStatus: Record<string, number> = {};
  const byClass: Record<string, number> = {};
  for (const r of rows) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    byClass[r.class] = (byClass[r.class] ?? 0) + 1;
  }
  return { byStatus, byClass };
}
