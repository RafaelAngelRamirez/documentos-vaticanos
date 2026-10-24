/**
 * Group discovered document URLs by family key + locale.
 */
import fs from "fs";
import path from "path";
import type {
  DiscoveriesFile,
  DiscoveryDocument,
  GraphNode,
} from "./types";
import {
  detectLocale,
  documentFamilyKey,
  normalizeUrl,
  slugFromUrl,
} from "./normalize";

export function buildDiscoveries(options: {
  seedId: string;
  nodes: GraphNode[];
  preferLocales: string[];
}): DiscoveriesFile {
  const byFamily = new Map<string, DiscoveryDocument>();

  for (const node of options.nodes) {
    if (node.pageType !== "document" && !(node.pageType === "unknown" && /\/documents\//i.test(node.normalizedUrl))) {
      // also accept pdf documents
      if (!(node.pageType === "document")) continue;
    }
    if (node.status === "skipped-blocked") continue;

    const family = documentFamilyKey(node.normalizedUrl);
    const locale = node.locale || detectLocale(node.normalizedUrl) || "und";
    let doc = byFamily.get(family);
    if (!doc) {
      // Stable id from family key (path without locale), not from one locale URL
      const id = family
        .replace(/^www\.vatican\.va\//, "")
        .replace(/\{loc\}\//g, "")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase()
        .slice(0, 120);
      doc = {
        id: id || slugFromUrl(node.normalizedUrl),
        title: null,
        kind: "curia-document",
        organId: inferOrganId(node),
        locales: {},
        preferredLocale: null,
        corpusDocId: null,
        sourceUrls: [],
      };
      byFamily.set(family, doc);
    }
    // Prefer real document titles over chrome language labels (Alemán, Español…)
    const candidate = node.title || node.linkText || null;
    if (candidate && !isLanguageLabel(candidate)) {
      if (!doc.title || isLanguageLabel(doc.title)) doc.title = candidate;
    }

    const locStatus =
      node.status === "skipped-corpus"
        ? "already-in-corpus"
        : node.status === "fetched"
          ? "fetched"
          : node.status === "cataloged" || node.status === "skipped-locale"
            ? "cataloged"
            : "discovered";

    doc.locales[locale] = {
      url: node.normalizedUrl,
      status: locStatus,
      contentHash: node.contentHash,
    };
    if (!doc.sourceUrls.includes(node.normalizedUrl)) {
      doc.sourceUrls.push(node.normalizedUrl);
    }
  }

  // preferred locale
  for (const doc of byFamily.values()) {
    for (const pref of options.preferLocales) {
      if (doc.locales[pref]) {
        doc.preferredLocale = pref;
        break;
      }
    }
    if (!doc.preferredLocale) {
      const keys = Object.keys(doc.locales);
      doc.preferredLocale = keys[0] || null;
    }
  }

  const documents = Array.from(byFamily.values()).sort((a, b) =>
    a.id.localeCompare(b.id),
  );

  return {
    version: 1,
    seedId: options.seedId,
    generatedAt: new Date().toISOString(),
    documents,
  };
}

const LANG_LABELS =
  /^(español|english|italiano|français|francés|deutsch|alemán|português|portugués|polski|polaco|latín|latin|العربية|árabe|中文|русский|magyar|nederlands|shqip|kiswahili|tiếng việt|es|en|it|fr|de|pt|pl|la|ar|zh|ru)$/i;

function isLanguageLabel(s: string): boolean {
  return LANG_LABELS.test(s.trim());
}

function inferOrganId(node: GraphNode): string | null {
  const u = node.normalizedUrl;
  // /content/romancuria/es/dicasteri/dicastero-xxx/...
  const m = u.match(
    /\/content\/romancuria\/es\/(?:dicasteri|organismi-[^/]+|pontificie-[^/]+|uffici|istituzioni-[^/]+|altre-[^/]+|guardia-[^/]+|ordini-[^/]+|ulsa|fas)\/([^/.]+)/i,
  );
  if (m) return m[1].toLowerCase();
  const m2 = u.match(/\/roman_curia\/(?:congregations|pontifical_councils|tribunals)\/([^/]+)/i);
  if (m2) return m2[1].toLowerCase();
  return null;
}

export function writeDiscoveries(file: DiscoveriesFile, outPath: string): void {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(file, null, 2) + "\n", "utf-8");
}

export function loadDiscoveries(outPath: string): DiscoveriesFile | null {
  if (!fs.existsSync(outPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(outPath, "utf-8")) as DiscoveriesFile;
  } catch {
    return null;
  }
}
