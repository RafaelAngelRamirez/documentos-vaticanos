/**
 * Heuristic pageType classification for vatican.va HTML.
 */
import type { PageType } from "./types";
import {
  detectLocale,
  isAllowedHost,
  isChromeUrl,
  normalizeUrl,
} from "./normalize";

export interface ClassifyResult {
  pageType: PageType;
  title: string | null;
  locale: string | null;
}

export function classifyUrl(
  url: string,
  allowHosts: string[],
): PageType {
  const n = normalizeUrl(url);
  if (!isAllowedHost(n, allowHosts)) return "external";
  if (/\.pdf(\?|$)/i.test(n)) return "document";
  if (isChromeUrl(n)) return "chrome";
  if (
    /\/content\/romancuria\//i.test(n) &&
    (/\.index\.html$/i.test(n) || /\/es\.html$/i.test(n) || /romancuria\/es$/i.test(n))
  ) {
    return "hub-organ";
  }
  if (
    /doc_doc_index|documents?_index|indice.*doc|\/documents\//i.test(n) ||
    /doc_doc_index/i.test(n)
  ) {
    if (/doc_doc_index|documents_index|_index_sp|_index_en/i.test(n)) {
      return "doc-index";
    }
  }
  if (
    /\/documents\//i.test(n) ||
    /motu_proprio|encyclicals|apost_letters|apost_exhortations|speeches|homilies|audiences|letters|apost_constitutions/i.test(
      n,
    ) ||
    /\/news_services\/liturgy\/saints\/ns_lit_doc_/i.test(n) ||
    /\/content\/[^/]+\/(?:es|en|it|fr|de)\/(?:encyclicals|motu_proprio|apost_letters|speeches|homilies|audiences|letters|apost_exhortations|apost_constitutions)\//i.test(
      n,
    )
  ) {
    return "document";
  }
  if (/\/roman_curia\//i.test(n) && /index.*\.htm/i.test(n)) {
    return /doc/i.test(n) ? "doc-index" : "hub-organ";
  }
  return "unknown";
}

export function classifyPage(
  url: string,
  html: string | null,
  allowHosts: string[],
): ClassifyResult {
  const locale = detectLocale(url);
  let pageType = classifyUrl(url, allowHosts);
  let title: string | null = null;

  if (html) {
    const tMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (tMatch) {
      title = decodeEntities(tMatch[1]).replace(/\s+/g, " ").trim() || null;
    }
    const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1) {
      const h1t = decodeEntities(h1[1].replace(/<[^>]+>/g, "")).replace(
        /\s+/g,
        " ",
      ).trim();
      if (h1t) title = h1t;
    }

    // Upgrade unknown → doc-index if dense document links or "Documentos" heading
    if (pageType === "unknown" || pageType === "hub-organ") {
      const docLinks = (
        html.match(/href="[^"]*\/documents\/[^"]+"/gi) || []
      ).length;
      const hasDocWord =
        /Documentos|Documents|Documenti|Dokumente/i.test(html) &&
        docLinks > 5;
      if (docLinks > 30 || hasDocWord) {
        pageType = "doc-index";
      }
    }

    // Single document body heuristics
    if (pageType === "unknown") {
      if (
        /id="corpo"|class="document"|metafocus|motu.proprio/i.test(html) &&
        (html.match(/<p[\s>]/gi) || []).length > 8
      ) {
        if (/\/documents\//i.test(url)) pageType = "document";
      }
    }
  }

  return { pageType, title, locale };
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&aacute;/gi, "á")
    .replace(/&eacute;/gi, "é")
    .replace(/&iacute;/gi, "í")
    .replace(/&oacute;/gi, "ó")
    .replace(/&uacute;/gi, "ú")
    .replace(/&ntilde;/gi, "ñ")
    .replace(/&Aacute;/gi, "Á")
    .replace(/&Eacute;/gi, "É")
    .replace(/&Iacute;/gi, "Í")
    .replace(/&Oacute;/gi, "Ó")
    .replace(/&Uacute;/gi, "Ú")
    .replace(/&Ntilde;/gi, "Ñ")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) =>
      String.fromCharCode(parseInt(h, 16)),
    )
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)));
}

/** Extract outbound hrefs + optional link text from HTML. */
export function extractLinks(
  html: string,
  baseUrl: string,
): Array<{ href: string; text: string }> {
  const { parseHTML } = require("linkedom");
  const { document } = parseHTML(html);
  const anchors = Array.from(document.querySelectorAll("a[href]")) as Element[];
  const out: Array<{ href: string; text: string }> = [];
  for (const a of anchors) {
    const href = a.getAttribute("href") || "";
    let text = (a.textContent || "").replace(/\s+/g, " ").trim();
    if (!text) {
      text = (
        a.getAttribute("title") ||
        a.getAttribute("alt") ||
        ""
      ).replace(/\s+/g, " ").trim();
    }
    if (!text) {
      const img = a.querySelector("img");
      if (img) {
        text = (
          img.getAttribute("alt") ||
          img.getAttribute("title") ||
          ""
        ).replace(/\s+/g, " ").trim();
      }
    }
    out.push({ href, text });
  }
  // Fallback regex if linkedom sparse
  if (out.length < 3) {
    const re = /href="([^"]+)"/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      out.push({ href: m[1], text: "" });
    }
  }
  return out;
}

/**
 * Whether to follow outbound links.
 * Documents are leaves (discovered, not expanded) to avoid language-variant storms.
 */
export function shouldExpand(pageType: PageType): boolean {
  return (
    pageType === "hub-organ" ||
    pageType === "doc-index" ||
    pageType === "unknown"
  );
}
