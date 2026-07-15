/**
 * URL normalization and locale detection for vatican.va crawl.
 */

const LOCALE_PATH = /\/(es|en|it|fr|de|pt|pl|la|ar|zh|ru|hu|nl|sq|sw|vi|ge|po)(?:\/|\.|$)/i;
const LOCALE_SUFFIX =
  /[._-](sp|es|en|it|fr|de|pt|pl|la|ar|zh|ru|hu|nl|sq|sw|vi|ge|po|lt)(?:\.html?)?$/i;

const SUFFIX_TO_LOCALE: Record<string, string> = {
  sp: "es",
  es: "es",
  en: "en",
  it: "it",
  fr: "fr",
  de: "de",
  ge: "de",
  pt: "pt",
  po: "pt",
  pl: "pl",
  la: "la",
  lt: "la",
  ar: "ar",
  zh: "zh",
  ru: "ru",
  hu: "hu",
  nl: "nl",
  sq: "sq",
  sw: "sw",
  vi: "vi",
};

export function absolutize(href: string, baseUrl: string): string | null {
  if (!href) return null;
  const h = href.trim();
  if (!h || h.startsWith("#")) return null;
  if (/^(javascript:|mailto:|tel:|data:)/i.test(h)) return null;
  try {
    if (h.startsWith("//")) return `https:${h}`;
    return new URL(h, baseUrl).toString();
  } catch {
    return null;
  }
}

/**
 * Stable normalized URL for dedup.
 * - https
 * - host lowercased, strip www? keep www.vatican.va as-is host lower
 * - strip hash
 * - strip default ports
 * - optional trailing slash trim (except root)
 */
export function normalizeUrl(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return raw.split("#")[0];
  }
  if (u.protocol === "http:") u.protocol = "https:";
  u.hash = "";
  u.hostname = u.hostname.toLowerCase();
  // Collapse vatican.va → www.vatican.va for consistency
  if (u.hostname === "vatican.va") u.hostname = "www.vatican.va";
  // Drop tracking query keys
  const drop = ["utm_source", "utm_medium", "utm_campaign", "fbclid"];
  for (const k of drop) u.searchParams.delete(k);
  let path = u.pathname;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  u.pathname = path;
  return u.toString();
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function isAllowedHost(url: string, allowHosts: string[]): boolean {
  const h = hostOf(url);
  // Exact host match only (do NOT allow press.vatican.va via suffix of vatican.va)
  const allowed = new Set(allowHosts.map((a) => a.toLowerCase()));
  if (allowed.has(h)) return true;
  // Normalize bare vatican.va ↔ www.vatican.va
  if (h === "vatican.va" && allowed.has("www.vatican.va")) return true;
  if (h === "www.vatican.va" && allowed.has("vatican.va")) return true;
  return false;
}

export function detectLocale(url: string): string | null {
  try {
    const u = new URL(url);
    const path = u.pathname;
    const mPath = path.match(LOCALE_PATH);
    if (mPath) {
      const code = mPath[1].toLowerCase();
      return SUFFIX_TO_LOCALE[code] || code;
    }
    const base = path.split("/").pop() || "";
    const mSuf = base.match(LOCALE_SUFFIX);
    if (mSuf) {
      const code = mSuf[1].toLowerCase();
      return SUFFIX_TO_LOCALE[code] || code;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Document family key: strip language suffix from filename for grouping.
 * e.g. rc_con_cfaith_doc_…_sp.html → rc_con_cfaith_doc_… 
 */
export function documentFamilyKey(url: string): string {
  try {
    const u = new URL(normalizeUrl(url));
    let path = u.pathname;
    // Normalize /es/ /en/ segments for content paths
    path = path.replace(
      /\/(es|en|it|fr|de|pt|pl|la)(?=\/)/gi,
      "/{loc}",
    );
    const parts = path.split("/");
    const file = parts[parts.length - 1] || "";
    const stripped = file
      .replace(
        /[._-](sp|es|en|it|fr|de|ge|pt|po|pl|la|lt|ar|zh|ru|hu|nl|sq|sw|vi)(?=\.html?$)/i,
        "",
      )
      .replace(/\.html?$/i, "");
    parts[parts.length - 1] = stripped;
    return `${u.hostname}${parts.join("/")}`;
  } catch {
    return normalizeUrl(url);
  }
}

export function slugFromUrl(url: string): string {
  try {
    const u = new URL(normalizeUrl(url));
    const base = (u.pathname.split("/").filter(Boolean).pop() || "page")
      .replace(/\.html?$/i, "")
      .replace(/\.index$/i, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
    return base.slice(0, 80) || "page";
  } catch {
    return "page";
  }
}

export function isBlockedUrl(url: string): boolean {
  const lower = url.toLowerCase();
  if (/^(javascript:|mailto:|tel:|data:)/i.test(url)) return true;
  if (/\.(css|js|mjs|map|png|jpe?g|gif|svg|ico|webp|woff2?|ttf|eot|mp4|mp3|pdf)(\?|$)/i.test(url)) {
    // PDF: catalog as document asset but do not expand as HTML crawl target
    if (/\.pdf(\?|$)/i.test(url)) return false;
    return true;
  }
  if (
    /facebook\.com|twitter\.com|x\.com|plus\.google|linkedin\.com|instagram\.com/.test(
      lower,
    )
  ) {
    return true;
  }
  if (/\/share\/|sharer\.php|intent\/tweet/.test(lower)) return true;
  if (/\/search\.html|gsearch\.vatican|navbar_search/.test(lower)) return true;
  if (/googletagmanager|gtm\.js|google-analytics/.test(lower)) return true;
  return false;
}

export function isChromeUrl(url: string): boolean {
  const n = normalizeUrl(url);
  return (
    /\/holy_father\/index/i.test(n) ||
    /\/roman_curia\/cardinals\//i.test(n) ||
    /\/content\/vatican\/[^/]+\/search/i.test(n) ||
    /\/content\/vatican\/[^/]+\.html$/i.test(n)
  );
}

/**
 * Paths that must not be expanded in Curia discovery crawls.
 * (Bible / archive dumps already in reading corpus, or huge side trees.)
 */
const NO_EXPAND_PATHS: RegExp[] = [
  /\/content\/bibbia\//i,
  /\/archive\/ESL0506\//i,
  /\/archive\/ENG0839\//i, // Bible (English online edition)
  /\/archive\/bible\//i,
  /\/archive\/[A-Z]{3}\d{4}\//i, // legacy multi-part archive packs (often bible)
  /\/archive\/catechism_/i,
  /\/archive\/ENG0015\//i,
  /\/archive\/FRA0013\//i,
  /\/archive\/DEU0035\//i,
  /\/news_services\/liturgy\/photogallery\//i,
];

export function isNoExpandPath(url: string): boolean {
  const n = normalizeUrl(url);
  return NO_EXPAND_PATHS.some((re) => re.test(n));
}

export function isPreferredLocale(
  locale: string | null,
  preferLocales: string[],
): boolean {
  if (!locale) return true; // unknown → allow expand
  return preferLocales.map((l) => l.toLowerCase()).includes(locale.toLowerCase());
}
