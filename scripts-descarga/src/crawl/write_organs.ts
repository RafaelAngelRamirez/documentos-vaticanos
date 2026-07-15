/**
 * Build institutional organ tree from crawl graph + seed HTML navigation.
 */
import fs from "fs";
import path from "path";
import type { GraphNode, OrganNode, OrganTree } from "./types";
import { absolutize, normalizeUrl, slugFromUrl } from "./normalize";
import { extractLinks } from "./classify";

export function buildOrganTree(options: {
  seedId: string;
  seedUrl: string;
  seedHtml: string | null;
  nodes: GraphNode[];
}): OrganTree {
  const seedNorm = normalizeUrl(options.seedUrl);
  const children: OrganNode[] = [];
  const seen = new Set<string>();

  // Prefer structured nav links from seed HTML
  if (options.seedHtml) {
    const links = extractLinks(options.seedHtml, options.seedUrl);
    for (const { href, text } of links) {
      const abs = absolutize(href, options.seedUrl);
      if (!abs) continue;
      const n = normalizeUrl(abs);
      if (n === seedNorm) continue;
      if (!/\/content\/romancuria\//i.test(n) && !/\/roman_curia\//i.test(n)) {
        // still allow some external organs as leaf catalog
        if (!text || text.length < 3) continue;
      }
      // Only top-level-ish organ pages
      if (
        !/\.index\.html$/i.test(n) &&
        !/romancuria\/es\/[^/]+\.html$/i.test(n) &&
        !/\/roman_curia\//i.test(n)
      ) {
        // liturgy etc.
        if (!text) continue;
      }
      // Skip pure section index without leaf name if duplicate chrome
      if (/\/es\.index\.html/i.test(n)) continue;
      if (seen.has(n)) continue;
      // Filter nav chrome labels
      if (
        /^(SANTO PADRE|COLEGIO|CURIA ROMANA|La Curia Romana|Buscar|holyfather)/i.test(
          text,
        )
      ) {
        continue;
      }
      // Depth-1 organs: path under romancuria with 1-3 segments after /es/
      const isOrgan =
        /\/content\/romancuria\/es\//i.test(n) ||
        /\/roman_curia\//i.test(n) ||
        /liturgy/i.test(n);
      if (!isOrgan) continue;
      seen.add(n);
      const docIndexes = findDocIndexes(n, options.nodes);
      const fromGraph = options.nodes.find((x) => x.normalizedUrl === n);
      const title =
        (text && text.length > 2 ? text : null) ||
        fromGraph?.title ||
        fromGraph?.linkText ||
        slugFromUrl(n);
      children.push({
        id: slugFromUrl(n),
        title,
        sourceUrl: n,
        depth: 1,
        documentIndexUrls: docIndexes,
        children: [],
      });
    }
  }

  // Fallback: graph nodes at depth 1 classified hub-organ
  if (children.length < 10) {
    for (const node of options.nodes) {
      if (node.depth !== 1) continue;
      if (node.pageType !== "hub-organ" && node.pageType !== "unknown") continue;
      if (seen.has(node.normalizedUrl)) continue;
      seen.add(node.normalizedUrl);
      children.push({
        id: slugFromUrl(node.normalizedUrl),
        title: node.title || node.linkText || slugFromUrl(node.normalizedUrl),
        sourceUrl: node.normalizedUrl,
        depth: 1,
        documentIndexUrls: findDocIndexes(node.normalizedUrl, options.nodes),
        children: [],
      });
    }
  }

  // Attach depth-2 children under matching parent path
  for (const node of options.nodes) {
    if (node.depth !== 2) continue;
    if (node.pageType === "chrome" || node.pageType === "asset") continue;
    if (!node.parentUrl) continue;
    const parent = children.find(
      (c) => c.sourceUrl === normalizeUrl(node.parentUrl!),
    );
    if (!parent) continue;
    if (parent.children.some((c) => c.sourceUrl === node.normalizedUrl)) continue;
    parent.children.push({
      id: slugFromUrl(node.normalizedUrl),
      title: node.title || node.linkText || slugFromUrl(node.normalizedUrl),
      sourceUrl: node.normalizedUrl,
      depth: 2,
      documentIndexUrls: findDocIndexes(node.normalizedUrl, options.nodes),
      children: [],
    });
  }

  // Collect doc-index URLs onto nearest organ
  for (const node of options.nodes) {
    if (node.pageType !== "doc-index") continue;
    let best: OrganNode | null = null;
    for (const org of children) {
      if (
        node.normalizedUrl.startsWith(
          org.sourceUrl.replace(/\.index\.html$/i, "").replace(/\.html$/i, ""),
        ) ||
        (node.parentUrl && normalizeUrl(node.parentUrl) === org.sourceUrl)
      ) {
        best = org;
        break;
      }
    }
    if (!best && node.parentUrl) {
      best =
        children.find((c) => c.sourceUrl === normalizeUrl(node.parentUrl!)) ||
        null;
    }
    if (best && !best.documentIndexUrls.includes(node.normalizedUrl)) {
      best.documentIndexUrls.push(node.normalizedUrl);
    }
  }

  const tree: OrganTree = {
    version: 1,
    seedId: options.seedId,
    generatedAt: new Date().toISOString(),
    root: {
      id: "roman-curia",
      title: "La Curia Romana",
      sourceUrl: seedNorm,
      depth: 0,
      documentIndexUrls: [],
      children,
    },
  };
  return tree;
}

function findDocIndexes(organUrl: string, nodes: GraphNode[]): string[] {
  const out: string[] = [];
  for (const n of nodes) {
    if (n.pageType !== "doc-index") continue;
    if (n.parentUrl && normalizeUrl(n.parentUrl) === organUrl) {
      out.push(n.normalizedUrl);
    }
  }
  return out;
}

export function writeOrganTree(tree: OrganTree, outPath: string): void {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(tree, null, 2) + "\n", "utf-8");
}
