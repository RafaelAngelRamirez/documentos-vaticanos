/**
 * Multi-locale corpus provenance helpers (pure functions).
 * Mirrors frontend document-locale concepts so inventory / import / tests share one source of truth.
 */

/** Target content locales for the multi-locale matrix. */
export const TARGET_LOCALES = ["es", "la", "en", "zh", "hi", "ar"] as const;
export type TargetLocale = (typeof TARGET_LOCALES)[number];

/** Locales required by the coverage gate (official or AI twin). */
export const COVERAGE_LOCALES = ["es", "en", "zh", "hi", "ar"] as const;

/** Locales produced by machine translation from Spanish base packs. */
export const MT_TARGET_LOCALES = ["en", "zh", "hi", "ar"] as const;

export type TranslationProvenance = "official" | "ai";

export type LocalePresence = "official" | "ai" | "missing";

/** Minimal meta for inventory / badge logic. */
export interface LocaleDocMeta {
  id: string;
  locale?: string;
  title?: string;
  shortTitle?: string;
  kind?: string;
  sourceUrl?: string;
  sourceNote?: string;
  translationProvenance?: TranslationProvenance | string;
  unitCount?: number;
}

export interface FamilyLocaleCell {
  locale: string;
  status: LocalePresence;
  documentId: string | null;
  /** True when pack id ends with -ai (correction twin alongside official). */
  isCorrectionTwin: boolean;
}

export interface FamilyInventoryRow {
  family: string;
  title: string;
  kind: string;
  cells: FamilyLocaleCell[];
  /** Editions present in the corpus for this family. */
  editions: LocaleDocMeta[];
}

/** Known id suffixes that denote content language (longest first for strip). */
export const KNOWN_LOCALE_SUFFIXES = [
  "es",
  "la",
  "en",
  "zh",
  "hi",
  "ar",
  "it",
  "fr",
  "de",
  "pt",
  "el",
] as const;

const SUFFIX_RE = new RegExp(
  `-(${KNOWN_LOCALE_SUFFIXES.join("|")})(?:-ai)?$`,
  "i",
);

/** Short badge labels for UI chips (ES, EN, ZH…). */
export function localeBadge(locale?: string | null): string {
  if (!locale) return "?";
  const code = normalizeLocaleCode(locale);
  if (!code) return "?";
  return code.toUpperCase();
}

/** Human language label (UI / inventory). */
export function localeLabel(locale?: string | null): string {
  if (!locale) return "Idioma";
  const code = normalizeLocaleCode(locale);
  const map: Record<string, string> = {
    es: "Español",
    en: "English",
    la: "Latina",
    zh: "中文",
    hi: "हिन्दी",
    ar: "العربية",
    it: "Italiano",
    fr: "Français",
    de: "Deutsch",
    pt: "Português",
    el: "Ελληνικά",
  };
  return map[code] || locale.toUpperCase();
}

export function normalizeLocaleCode(code?: string | null): string {
  if (!code) return "";
  return code.trim().toLowerCase().split(/[-_]/)[0] || "";
}

/**
 * Family key for a document pack id.
 * `lg-es` → `lg`
 * `nicea-i-la` → `nicea-i`
 * `cceo-en-ai` → `cceo` (strip -ai then locale)
 * `bible-pueblo-de-dios-es` → `bible-pueblo-de-dios`
 */
export function familyKey(id: string, locale?: string | null): string {
  if (!id) return "";
  let base = id;
  // Correction twin suffix
  if (/-ai$/i.test(base)) {
    base = base.replace(/-ai$/i, "");
  }
  const loc = normalizeLocaleCode(locale);
  if (loc && base.toLowerCase().endsWith(`-${loc}`)) {
    return base.slice(0, -(loc.length + 1));
  }
  const m = base.match(
    new RegExp(`-(${KNOWN_LOCALE_SUFFIXES.join("|")})$`, "i"),
  );
  if (m) {
    return base.slice(0, -m[0].length);
  }
  return base;
}

/** Whether pack id is a correction AI twin (`{family}-{locale}-ai`). */
export function isCorrectionTwinId(id: string): boolean {
  return /-ai$/i.test(id || "");
}

/**
 * Detect AI edition from explicit field or sourceNote disclaimer heuristics.
 * Official packs without AI notes → false.
 */
export function isAiEdition(meta: LocaleDocMeta): boolean {
  if (isCorrectionTwinId(meta.id)) return true;
  const prov = String(meta.translationProvenance || "")
    .toLowerCase()
    .trim();
  if (prov === "ai") return true;
  const note = meta.sourceNote || "";
  if (looksLikeAiDisclaimer(note)) return true;
  if (prov === "official") return false;
  return false;
}

/** True when sourceNote carries an AI-translation disclaimer. */
export function looksLikeAiDisclaimer(note?: string | null): boolean {
  if (!note) return false;
  return (
    /generad[oa]\s+por\s+IA/i.test(note) ||
    /traducci[oó]n\s+(al\s+\w+\s+)?generada\s+por\s+IA/i.test(note) ||
    /AI[- ]generated/i.test(note) ||
    /machine[- ]translated/i.test(note) ||
    /not\s+an?\s+official\s+translation/i.test(note) ||
    /Not an official translation/i.test(note) ||
    /no\s+es\s+una\s+traducci[oó]n\s+oficial/i.test(note) ||
    /由人工智能/.test(note) ||
    /人工智能/.test(note) ||
    /एआई\s*द्वारा/.test(note) ||
    (/अनुवाद/.test(note) && /एआई|AI|कृत्रिम/.test(note)) ||
    (/ترجمة/.test(note) && /ذكاء|اصطناعي/.test(note)) ||
    /intelligentia\s+artificiali/i.test(note) ||
    /ab intelligentia artificiali generata/i.test(note)
  );
}

/**
 * Presence cell for one family × locale.
 * Prefers official over AI when both exist; correction twin is secondary.
 */
export function presenceForLocale(
  editions: LocaleDocMeta[],
  locale: string,
): LocalePresence {
  const loc = normalizeLocaleCode(locale);
  const forLoc = editions.filter(
    (e) => localeOf(e) === loc || packLocaleFromId(e.id) === loc,
  );
  if (!forLoc.length) return "missing";
  const hasOfficial = forLoc.some((e) => !isAiEdition(e));
  if (hasOfficial) return "official";
  return "ai";
}

function localeOf(meta: LocaleDocMeta): string {
  if (meta.locale) return normalizeLocaleCode(meta.locale);
  return packLocaleFromId(meta.id);
}

/** Locale inferred from pack id (`lg-en-ai` → en). */
export function packLocaleFromId(id: string): string {
  if (!id) return "";
  let base = id.replace(/-ai$/i, "");
  const m = base.match(
    new RegExp(`-(${KNOWN_LOCALE_SUFFIXES.join("|")})$`, "i"),
  );
  return m ? m[1].toLowerCase() : "";
}

/**
 * Resolve target corpusDocId for an AI twin import.
 * - Primary AI when no official `{family}-{locale}`: `{family}-{locale}`
 * - Correction twin when official already exists: `{family}-{locale}-ai`
 */
export function resolveAiTwinId(
  family: string,
  targetLocale: string,
  existingIds: Iterable<string>,
): { corpusDocId: string; isCorrectionTwin: boolean } {
  const loc = normalizeLocaleCode(targetLocale);
  const primary = `${family}-${loc}`;
  const set = existingIds instanceof Set ? existingIds : new Set(existingIds);
  // Official = present and not already an -ai pack with AI provenance only.
  // If primary id already exists as any pack, use correction twin id for a new AI write
  // only when caller wants to add a twin without overwriting official.
  if (set.has(primary)) {
    // Check if existing primary is AI — reusing same id is fine for overwrite.
    // Correction twin only when official (non-AI) occupies primary.
    return {
      corpusDocId: `${primary}-ai`,
      isCorrectionTwin: true,
    };
  }
  return { corpusDocId: primary, isCorrectionTwin: false };
}

/**
 * When importing AI and official occupies primary, return correction id.
 * When primary is free or is already AI (re-import), return primary.
 */
export function resolveAiTwinIdWithMeta(
  family: string,
  targetLocale: string,
  existing: LocaleDocMeta[],
): { corpusDocId: string; isCorrectionTwin: boolean } {
  const loc = normalizeLocaleCode(targetLocale);
  const primary = `${family}-${loc}`;
  const hit = existing.find((e) => e.id === primary);
  if (hit && !isAiEdition(hit)) {
    return { corpusDocId: `${primary}-ai`, isCorrectionTwin: true };
  }
  return { corpusDocId: primary, isCorrectionTwin: false };
}

/**
 * Multilingual AI disclaimer templates.
 * @param targetLocale language of the note (UI language for the pack)
 * @param baseTitle human title of base pack
 * @param baseId base corpus document id
 * @param baseLocale language of the base text (usually es or la)
 */
export function aiDisclaimer(
  targetLocale: string,
  baseTitle: string,
  baseId: string,
  baseLocale = "es",
): string {
  const loc = normalizeLocaleCode(targetLocale);
  const baseLang = localeLabel(baseLocale);
  const templates: Record<string, string> = {
    es: `Traducción al español generada por IA a partir del texto (${baseLang}) del pack «${baseTitle}» (${baseId}). No es una traducción oficial de la Santa Sede ni una edición crítica. Destinada a estudio y lectura orientativa; en caso de duda, prevalece el texto de origen.`,
    en: `AI-generated English translation from the ${baseLang} text of the pack «${baseTitle}» (${baseId}). Not an official translation of the Holy See nor a critical edition. Intended for study and orientative reading; in case of doubt, the source text prevails.`,
    zh: `由人工智能根据 pack「${baseTitle}」(${baseId}) 的${baseLang}文本生成的中文翻译。并非罗马教廷的官方译本，亦非校勘本。仅供研读与参考；如有疑义，以源文本为准。`,
    hi: `«${baseTitle}» (${baseId}) पैक के ${baseLang} पाठ से एआई द्वारा उत्पन्न हिन्दी अनुवाद। यह पवित्र सी की आधिकारिक अनुवाद या आलोचनात्मक संस्करण नहीं है। अध्ययन व मार्गदर्शन हेतु; संदेह की स्थिति में मूल पाठ मान्य होगा।`,
    ar: `ترجمة مولّدة بالذكاء الاصطناعي إلى العربية انطلاقاً من النص (${baseLang}) للحزمة «${baseTitle}» (${baseId}). ليست ترجمة رسمية للكرسي الرسولي ولا طبعة نقدية. مخصّصة للدراسة والقراءة الاسترشادية؛ وعند الشك يُعتدّ بالنص الأصلي.`,
    la: `Versio Latina ab intelligentia artificiali generata e textu (${baseLang}) fasciculi «${baseTitle}» (${baseId}). Non est versio officialis Sanctae Sedis neque editio critica. Ad studium et lectionem orientativam destinata; in dubio textus originis praevalet.`,
  };
  return (
    templates[loc] ||
    `AI-generated translation (${loc}) from «${baseTitle}» (${baseId}). Not an official Holy See translation.`
  );
}

/** Provenance badge label for catalog UI. */
export function provenanceBadge(
  meta: LocaleDocMeta,
): "official" | "AI" | "unknown" {
  if (isAiEdition(meta)) return "AI";
  if (meta.translationProvenance === "official") return "official";
  // Pack present without AI markers → treat as official/source edition
  if (meta.id) return "official";
  return "unknown";
}

/**
 * Map Vatican II (and similar) locale URL suffixes.
 * `_sp.html` (Spanish) → `_en.html`, `_zh.html`, etc.
 * Also handles path segments `/es/` → `/en/` when present.
 */
export function mapOfficialLocaleUrl(
  sourceUrl: string | undefined | null,
  targetLocale: string,
): string | undefined {
  if (!sourceUrl) return undefined;
  const loc = normalizeLocaleCode(targetLocale);
  // vatican.va content language path segment
  const pathLang: Record<string, string> = {
    es: "es",
    en: "en",
    la: "la",
    it: "it",
    fr: "fr",
    de: "de",
    pt: "pt",
    zh: "zh",
    // hi / ar often not on vatican.va paths
    hi: "hi",
    ar: "ar",
  };
  const targetPath = pathLang[loc] || loc;

  // File suffix map used on hist_councils and many vatican docs
  const fileSuffix: Record<string, string> = {
    es: "_sp.html",
    en: "_en.html",
    la: "_lt.html",
    it: "_it.html",
    fr: "_fr.html",
    de: "_ge.html", // german on vatican.va is often _ge
    pt: "_po.html",
    zh: "_zh.html",
    hi: "_hi.html",
    ar: "_ar.html",
  };
  const targetFile = fileSuffix[loc];
  let url = sourceUrl;

  // Replace known file locale suffixes
  const FILE_RE =
    /_(sp|en|lt|it|fr|ge|po|zh|hi|ar|la|pt|de)\.html(\?.*)?$/i;
  if (targetFile && FILE_RE.test(url)) {
    url = url.replace(FILE_RE, `${targetFile.replace(/\.html$/i, "")}.html$2`);
  }

  // content/{pope}/{lang}/…
  url = url.replace(
    /\/content\/([^/]+)\/(es|en|la|it|fr|de|pt|zh|hi|ar)\//i,
    `/content/$1/${targetPath}/`,
  );

  // catechism_sp → catechism_en style folder
  url = url.replace(
    /catechism_(sp|en|lt|it|fr|ge|po|zh)/i,
    `catechism_${loc === "es" ? "sp" : loc === "de" ? "ge" : loc === "pt" ? "po" : loc === "la" ? "lt" : loc}`,
  );

  // index_sp.html style
  url = url.replace(
    /index_(sp|en|lt|it|fr|ge|po|zh|hi|ar)\.html/i,
    `index_${loc === "es" ? "sp" : loc === "de" ? "ge" : loc === "pt" ? "po" : loc === "la" ? "lt" : loc}.html`,
  );

  return url;
}

/** Group document metas into family inventory rows. */
export function buildLocaleInventory(
  documents: LocaleDocMeta[],
  locales: readonly string[] = TARGET_LOCALES,
): FamilyInventoryRow[] {
  const map = new Map<string, LocaleDocMeta[]>();
  for (const d of documents) {
    const key = familyKey(d.id, d.locale);
    const list = map.get(key);
    if (list) list.push(d);
    else map.set(key, [d]);
  }

  const rows: FamilyInventoryRow[] = [];
  for (const [family, editions] of map) {
    const preferred =
      editions.find((e) => localeOf(e) === "es") ||
      editions.find((e) => localeOf(e) === "la") ||
      editions[0];
    const cells: FamilyLocaleCell[] = locales.map((loc) => {
      const status = presenceForLocale(editions, loc);
      const forLoc = editions.filter(
        (e) => localeOf(e) === loc || packLocaleFromId(e.id) === loc,
      );
      // Prefer non-AI id for display; else first
      const official = forLoc.find((e) => !isAiEdition(e));
      const pick = official || forLoc[0] || null;
      return {
        locale: loc,
        status,
        documentId: pick?.id ?? null,
        isCorrectionTwin: pick ? isCorrectionTwinId(pick.id) : false,
      };
    });
    rows.push({
      family,
      title: preferred?.title || family,
      kind: preferred?.kind || "",
      cells,
      editions: [...editions].sort((a, b) => a.id.localeCompare(b.id)),
    });
  }
  rows.sort((a, b) => a.family.localeCompare(b.family));
  return rows;
}

/** Format inventory as fixed-width matrix text. */
export function formatInventoryMatrix(rows: FamilyInventoryRow[]): string {
  const locales = rows[0]?.cells.map((c) => c.locale) ?? [...TARGET_LOCALES];
  const famW = Math.max(12, ...rows.map((r) => r.family.length), 6);
  const head =
    "family".padEnd(famW) +
    "  " +
    locales.map((l) => l.padEnd(10)).join(" ") +
    "  title";
  const lines = [head, "-".repeat(Math.min(head.length, 120))];
  for (const r of rows) {
    const cells = r.cells
      .map((c) => {
        const tag =
          c.status === "official"
            ? "official"
            : c.status === "ai"
              ? "ai"
              : "missing";
        return tag.padEnd(10);
      })
      .join(" ");
    const title = (r.title || "").slice(0, 48);
    lines.push(`${r.family.padEnd(famW)}  ${cells}  ${title}`);
  }
  // Summary
  const missingCounts = locales.map((loc) => {
    const n = rows.filter(
      (r) => r.cells.find((c) => c.locale === loc)?.status === "missing",
    ).length;
    return `${loc}:${n}`;
  });
  lines.push("");
  lines.push(
    `families=${rows.length}  missing_cells  ${missingCounts.join("  ")}`,
  );
  return lines.join("\n") + "\n";
}

/**
 * Coverage gate: every family must have each required locale as official or AI.
 * Returns list of failures (empty = pass).
 */
export function coverageGaps(
  rows: FamilyInventoryRow[],
  required: readonly string[] = COVERAGE_LOCALES,
): Array<{ family: string; locale: string }> {
  const gaps: Array<{ family: string; locale: string }> = [];
  for (const r of rows) {
    for (const loc of required) {
      const cell = r.cells.find((c) => c.locale === loc);
      if (!cell || cell.status === "missing") {
        gaps.push({ family: r.family, locale: loc });
      }
    }
  }
  return gaps;
}

/**
 * Assert every AI pack in the list has a disclaimer (sourceNote or provenance).
 */
export function aiPacksMissingDisclaimer(
  documents: LocaleDocMeta[],
): LocaleDocMeta[] {
  return documents.filter((d) => {
    if (!isAiEdition(d)) return false;
    if (d.translationProvenance === "ai" && looksLikeAiDisclaimer(d.sourceNote))
      return false;
    if (looksLikeAiDisclaimer(d.sourceNote)) return false;
    // Explicit ai without note is still a miss
    return true;
  });
}

/**
 * Packs tagged official that also carry AI marks (id `-ai` or disclaimer).
 * Empty on a healthy corpus — official scrapes must not look like IA twins.
 */
export function contradictoryOfficialMarks(
  documents: LocaleDocMeta[],
): LocaleDocMeta[] {
  return documents.filter((d) => {
    const prov = String(d.translationProvenance || "")
      .toLowerCase()
      .trim();
    if (prov !== "official") return false;
    return isCorrectionTwinId(d.id) || looksLikeAiDisclaimer(d.sourceNote);
  });
}

/**
 * If a pack is tagged official but carries AI marks, coerce provenance to ai.
 */
export function reconcileProvenance<T extends LocaleDocMeta>(meta: T): T {
  if (
    String(meta.translationProvenance || "").toLowerCase() === "official" &&
    (isCorrectionTwinId(meta.id) || looksLikeAiDisclaimer(meta.sourceNote))
  ) {
    return { ...meta, translationProvenance: "ai" };
  }
  return meta;
}

export interface OfficialAiPair {
  family: string;
  locale: string;
  official: LocaleDocMeta;
  ai: LocaleDocMeta;
}

/**
 * Family+locale groups that have both an official scrape and an IA twin.
 */
export function officialAiPairs(
  documents: LocaleDocMeta[],
): OfficialAiPair[] {
  const map = new Map<string, LocaleDocMeta[]>();
  for (const d of documents) {
    const family = familyKey(d.id, d.locale);
    const loc = localeOf(d) || packLocaleFromId(d.id) || "?";
    const key = `${family}::${loc}`;
    const list = map.get(key);
    if (list) list.push(d);
    else map.set(key, [d]);
  }
  const pairs: OfficialAiPair[] = [];
  for (const [key, eds] of map) {
    const official = eds.filter((e) => !isAiEdition(e));
    const ai = eds.filter((e) => isAiEdition(e));
    if (!official.length || !ai.length) continue;
    const sep = key.indexOf("::");
    const family = key.slice(0, sep);
    const locale = key.slice(sep + 2);
    for (const off of official) {
      for (const twin of ai) {
        pairs.push({ family, locale, official: off, ai: twin });
      }
    }
  }
  return pairs;
}

export { SUFFIX_RE };
