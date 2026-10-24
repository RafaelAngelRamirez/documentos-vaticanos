/**
 * Depth-limited BFS crawler for vatican.va discovery.
 */
import fs from "fs";
import path from "path";
import type {
  CrawlDefaults,
  CrawlSeed,
  CrawlState,
  CrawlStats,
  GraphNode,
  QueueItem,
} from "./types";
import {
  absolutize,
  detectLocale,
  isAllowedHost,
  isBlockedUrl,
  isNoExpandPath,
  isPreferredLocale,
  normalizeUrl,
} from "./normalize";
import {
  classifyPage,
  extractLinks,
  shouldExpand,
} from "./classify";
import { fetchHtml } from "./fetcher";
import { loadCorpusSourceUrls } from "./corpus_urls";
import { buildOrganTree, writeOrganTree } from "./write_organs";
import { buildDiscoveries, writeDiscoveries } from "./write_discoveries";

export interface BfsOptions {
  seed: CrawlSeed;
  defaults: CrawlDefaults;
  maxDepth: number;
  concurrency: number;
  resume: boolean;
  update: boolean;
  force: boolean;
  maxPages?: number;
  /** Repo documentos/ root */
  docsRoot: string;
  preferLocales: string[];
}

function emptyStats(): CrawlStats {
  return {
    fetched: 0,
    cataloged: 0,
    skippedCorpus: 0,
    skippedBlocked: 0,
    skippedLocale: 0,
    external: 0,
    errors: 0,
    byPageType: {},
  };
}

function bumpType(stats: CrawlStats, t: string) {
  stats.byPageType[t] = (stats.byPageType[t] || 0) + 1;
}

function crawlPaths(docsRoot: string, seedId: string) {
  const crawlRoot = path.join(docsRoot, "crawl", seedId);
  return {
    crawlRoot,
    statePath: path.join(crawlRoot, "state.json"),
    graphPath: path.join(crawlRoot, "graph.jsonl"),
    cacheRoot: path.join(crawlRoot, "cache"),
    organsPath: path.join(docsRoot, "organs", `${seedId}.json`),
    discoveriesPath: path.join(
      docsRoot,
      "discoveries",
      `${seedId}-documents.json`,
    ),
  };
}

function loadState(statePath: string): CrawlState | null {
  if (!fs.existsSync(statePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(statePath, "utf-8")) as CrawlState;
  } catch {
    return null;
  }
}

function saveState(
  state: CrawlState,
  statePath: string,
  visitedSet?: Set<string>,
) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  state.updatedAt = new Date().toISOString();
  if (visitedSet) {
    state.visited = Array.from(visitedSet);
  }
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n", "utf-8");
}

function loadGraph(graphPath: string): Map<string, GraphNode> {
  const map = new Map<string, GraphNode>();
  if (!fs.existsSync(graphPath)) return map;
  const lines = fs.readFileSync(graphPath, "utf-8").split("\n");
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const n = JSON.parse(line) as GraphNode;
      map.set(n.normalizedUrl, n);
    } catch {
      /* skip bad line */
    }
  }
  return map;
}

function rewriteGraph(graphPath: string, nodes: Map<string, GraphNode>) {
  fs.mkdirSync(path.dirname(graphPath), { recursive: true });
  const lines = Array.from(nodes.values())
    .sort((a, b) => a.normalizedUrl.localeCompare(b.normalizedUrl))
    .map((n) => JSON.stringify(n));
  fs.writeFileSync(graphPath, lines.join("\n") + (lines.length ? "\n" : ""), "utf-8");
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  }
  const n = Math.min(concurrency, Math.max(1, items.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}

export async function runBfs(opts: BfsOptions): Promise<{
  stats: CrawlStats;
  nodeCount: number;
  paths: ReturnType<typeof crawlPaths>;
}> {
  const paths = crawlPaths(opts.docsRoot, opts.seed.id);
  const corpusUrls = loadCorpusSourceUrls();
  const allowHosts = opts.defaults.allowHosts;
  const preferLocales = opts.preferLocales;

  let state: CrawlState;
  let graph = new Map<string, GraphNode>();
  const seedNorm = normalizeUrl(opts.seed.url);

  if (opts.resume) {
    const prev = loadState(paths.statePath);
    graph = loadGraph(paths.graphPath);
    if (prev && prev.seedId === opts.seed.id) {
      state = prev;
      const prevDepth = state.maxDepth;
      state.maxDepth = opts.maxDepth;
      // If maxDepth increased, re-queue expandable fetched nodes so their
      // children beyond the old depth can be discovered.
      if (opts.maxDepth > prevDepth) {
        let added = 0;
        for (const node of graph.values()) {
          if (
            node.status === "fetched" &&
            shouldExpand(node.pageType) &&
            node.depth < opts.maxDepth
          ) {
            const alreadyQ = state.queue.some(
              (q) => normalizeUrl(q.url) === node.normalizedUrl,
            );
            if (!alreadyQ) {
              // Allow re-process on depth increase (visited cleared for these below)
              state.queue.push({
                url: node.normalizedUrl,
                depth: node.depth,
                parentUrl: node.parentUrl,
              });
              added++;
            }
          }
        }
        console.log(
          `[crawl] maxDepth ${prevDepth}→${opts.maxDepth}: re-queued ${added} nodes for deeper expand`,
        );
      }
      console.log(
        `[crawl] resume queue=${state.queue.length} visited=${state.visited.length} nodes=${graph.size}`,
      );
    } else {
      state = freshState(opts, seedNorm);
    }
  } else if (opts.update && fs.existsSync(paths.statePath)) {
    // Update mode: re-queue all expandable fetched nodes at their depth
    graph = loadGraph(paths.graphPath);
    state = loadState(paths.statePath) || freshState(opts, seedNorm);
    state.queue = [];
    state.visited = [];
    state.stats = emptyStats();
    state.finishedAt = null;
    state.maxDepth = opts.maxDepth;
    for (const node of graph.values()) {
      if (
        node.status === "fetched" &&
        shouldExpand(node.pageType) &&
        node.depth <= opts.maxDepth
      ) {
        state.queue.push({
          url: node.normalizedUrl,
          depth: node.depth,
          parentUrl: node.parentUrl,
        });
      }
    }
    if (!state.queue.length) {
      state.queue.push({ url: seedNorm, depth: 0, parentUrl: null });
    }
    console.log(`[crawl] update mode: re-queue ${state.queue.length} nodes`);
  } else {
    state = freshState(opts, seedNorm);
    graph = new Map();
  }

  fs.mkdirSync(paths.cacheRoot, { recursive: true });
  let seedHtml: string | null = null;
  let processed = 0;

  // O(1) membership — state.visited array is only for persistence
  const visited = new Set<string>(state.visited || []);
  const queued = new Set<string>(
    state.queue.map((q) => normalizeUrl(q.url)),
  );
  console.log(
    `[crawl] ready visitedSet=${visited.size} queue=${state.queue.length}`,
  );

  while (state.queue.length > 0) {
    if (opts.maxPages && processed >= opts.maxPages) {
      console.log(`[crawl] maxPages=${opts.maxPages} reached; stopping`);
      break;
    }

    // Take a batch for concurrency
    const batch: QueueItem[] = [];
    while (batch.length < opts.concurrency && state.queue.length) {
      const it = state.queue.shift()!;
      queued.delete(normalizeUrl(it.url));
      batch.push(it);
    }

    await mapPool(batch, opts.concurrency, async (item) => {
      const norm = normalizeUrl(item.url);
      if (visited.has(norm) && !opts.update && !opts.force) {
        return;
      }
      // mark visited early to avoid re-queue storms
      visited.add(norm);

      if (item.depth > opts.maxDepth) return;

      if (isBlockedUrl(norm)) {
        const node: GraphNode = {
          url: item.url,
          normalizedUrl: norm,
          depth: item.depth,
          parentUrl: item.parentUrl,
          pageType: "asset",
          locale: detectLocale(norm),
          title: null,
          contentHash: null,
          fetchedAt: null,
          httpStatus: null,
          outLinks: 0,
          status: "skipped-blocked",
          linkText: item.linkText,
        };
        graph.set(norm, node);
        state.stats.skippedBlocked++;
        bumpType(state.stats, "asset");
        return;
      }

      // Chrome (global nav): never fetch or expand
      {
        const preType = classifyPage(norm, null, allowHosts).pageType;
        if (preType === "chrome" && item.depth > 0) {
          const node: GraphNode = {
            url: item.url,
            normalizedUrl: norm,
            depth: item.depth,
            parentUrl: item.parentUrl,
            pageType: "chrome",
            locale: detectLocale(norm),
            title: item.linkText || null,
            contentHash: null,
            fetchedAt: null,
            httpStatus: null,
            outLinks: 0,
            status: "cataloged",
            linkText: item.linkText,
          };
          graph.set(norm, node);
          state.stats.cataloged++;
          bumpType(state.stats, "chrome");
          return;
        }
      }

      // Side trees already covered by reading corpus (Bible AEM, photogalleries…)
      if (isNoExpandPath(norm)) {
        const cl = classifyPage(norm, null, allowHosts);
        const node: GraphNode = {
          url: item.url,
          normalizedUrl: norm,
          depth: item.depth,
          parentUrl: item.parentUrl,
          pageType: cl.pageType === "unknown" ? "document" : cl.pageType,
          locale: cl.locale || detectLocale(norm),
          title: item.linkText || null,
          contentHash: null,
          fetchedAt: null,
          httpStatus: null,
          outLinks: 0,
          status: corpusUrls.has(norm) ? "skipped-corpus" : "cataloged",
          linkText: item.linkText,
        };
        graph.set(norm, node);
        if (node.status === "skipped-corpus") state.stats.skippedCorpus++;
        else state.stats.cataloged++;
        bumpType(state.stats, node.pageType);
        return;
      }

      if (!isAllowedHost(norm, allowHosts)) {
        const node: GraphNode = {
          url: item.url,
          normalizedUrl: norm,
          depth: item.depth,
          parentUrl: item.parentUrl,
          pageType: "external",
          locale: detectLocale(norm),
          title: item.linkText || null,
          contentHash: null,
          fetchedAt: null,
          httpStatus: null,
          outLinks: 0,
          status: "external",
          linkText: item.linkText,
        };
        graph.set(norm, node);
        state.stats.external++;
        bumpType(state.stats, "external");
        return;
      }

      const locale = detectLocale(norm);
      const preferred = isPreferredLocale(locale, preferLocales);

      // Non-preferred locales: catalog only, do not fetch/expand (unless depth 0 seed)
      if (
        item.depth > 0 &&
        locale &&
        !preferred &&
        !item.catalogOnly
      ) {
        // If explicitly catalogOnly or non-preferred: store without fetch
        const node: GraphNode = {
          url: item.url,
          normalizedUrl: norm,
          depth: item.depth,
          parentUrl: item.parentUrl,
          pageType: classifyPage(norm, null, allowHosts).pageType,
          locale,
          title: item.linkText || null,
          contentHash: null,
          fetchedAt: null,
          httpStatus: null,
          outLinks: 0,
          status: "skipped-locale",
          linkText: item.linkText,
        };
        // Upgrade document detection by URL alone
        graph.set(norm, node);
        state.stats.skippedLocale++;
        bumpType(state.stats, node.pageType);
        return;
      }

      if (item.catalogOnly) {
        const cl = classifyPage(norm, null, allowHosts);
        const node: GraphNode = {
          url: item.url,
          normalizedUrl: norm,
          depth: item.depth,
          parentUrl: item.parentUrl,
          pageType: cl.pageType,
          locale: cl.locale,
          title: item.linkText || null,
          contentHash: null,
          fetchedAt: null,
          httpStatus: null,
          outLinks: 0,
          status: "cataloged",
          linkText: item.linkText,
        };
        graph.set(norm, node);
        state.stats.cataloged++;
        bumpType(state.stats, node.pageType);
        return;
      }

      if (corpusUrls.has(norm) && !opts.force) {
        const cl = classifyPage(norm, null, allowHosts);
        const node: GraphNode = {
          url: item.url,
          normalizedUrl: norm,
          depth: item.depth,
          parentUrl: item.parentUrl,
          pageType: cl.pageType === "unknown" ? "document" : cl.pageType,
          locale: cl.locale,
          title: item.linkText || null,
          contentHash: null,
          fetchedAt: new Date().toISOString(),
          httpStatus: null,
          outLinks: 0,
          status: "skipped-corpus",
          linkText: item.linkText,
        };
        graph.set(norm, node);
        state.stats.skippedCorpus++;
        bumpType(state.stats, node.pageType);
        return;
      }

      // PDF: catalog as document, no HTML expand
      if (/\.pdf(\?|$)/i.test(norm)) {
        const node: GraphNode = {
          url: item.url,
          normalizedUrl: norm,
          depth: item.depth,
          parentUrl: item.parentUrl,
          pageType: "document",
          locale,
          title: item.linkText || null,
          contentHash: null,
          fetchedAt: null,
          httpStatus: null,
          outLinks: 0,
          status: "cataloged",
          linkText: item.linkText,
        };
        graph.set(norm, node);
        state.stats.cataloged++;
        bumpType(state.stats, "document");
        return;
      }

      try {
        const prev = graph.get(norm);
        const result = await fetchHtml(norm, {
          cacheRoot: paths.cacheRoot,
          knownHash: opts.update ? null : prev?.contentHash,
          force: opts.force || opts.update,
        });

        if (result.httpStatus >= 400) {
          const node: GraphNode = {
            url: item.url,
            normalizedUrl: norm,
            depth: item.depth,
            parentUrl: item.parentUrl,
            pageType: "unknown",
            locale,
            title: null,
            contentHash: null,
            fetchedAt: new Date().toISOString(),
            httpStatus: result.httpStatus,
            outLinks: 0,
            status: "error",
            error: `HTTP ${result.httpStatus}`,
            linkText: item.linkText,
          };
          graph.set(norm, node);
          state.stats.errors++;
          return;
        }

        const cl = classifyPage(norm, result.html, allowHosts);
        if (norm === seedNorm) seedHtml = result.html;

        let outCount = 0;
        // Never expand from no-expand paths even if misclassified
        const canExpand =
          shouldExpand(cl.pageType) &&
          item.depth < opts.maxDepth &&
          !isNoExpandPath(norm);
        if (canExpand) {
          const links = extractLinks(result.html, norm);
          for (const { href, text } of links) {
            const abs = absolutize(href, norm);
            if (!abs) continue;
            if (isBlockedUrl(abs)) continue;
            const childNorm = normalizeUrl(abs);
            if (childNorm === norm) continue;
            outCount++;

            const enqueueChild = (catalogOnly: boolean) => {
              if (visited.has(childNorm) || queued.has(childNorm)) return;
              if (graph.has(childNorm) && graph.get(childNorm)!.status !== "queued") {
                // Already processed node
                if (!catalogOnly) return;
              }
              queued.add(childNorm);
              state.queue.push({
                url: childNorm,
                depth: item.depth + 1,
                parentUrl: norm,
                linkText: text,
                catalogOnly,
              });
            };

            // Enqueue no-expand paths as catalog-only (one node, no fetch storm)
            if (isNoExpandPath(childNorm)) {
              enqueueChild(true);
              continue;
            }

            const childLocale = detectLocale(childNorm);
            const childPreferred = isPreferredLocale(
              childLocale,
              preferLocales,
            );
            const allowed = isAllowedHost(childNorm, allowHosts);

            if (!allowed) {
              enqueueChild(true);
              continue;
            }

            // non-preferred → catalogOnly to record discovery without body fetch
            enqueueChild(Boolean(childLocale && !childPreferred));
          }
        }

        const node: GraphNode = {
          url: item.url,
          normalizedUrl: norm,
          depth: item.depth,
          parentUrl: item.parentUrl,
          pageType: cl.pageType,
          locale: cl.locale || locale,
          title: cl.title || item.linkText || null,
          contentHash: result.contentHash,
          fetchedAt: new Date().toISOString(),
          httpStatus: result.httpStatus,
          outLinks: outCount,
          status: "fetched",
          linkText: item.linkText,
        };
        graph.set(norm, node);
        state.stats.fetched++;
        bumpType(state.stats, cl.pageType);
        processed++;

        if (processed % 25 === 0 || item.depth <= 1) {
          console.log(
            `[crawl] d=${item.depth} fetched=${state.stats.fetched} queue=${state.queue.length} ${cl.pageType} ${norm.slice(0, 90)}`,
          );
        }
      } catch (err) {
        const node: GraphNode = {
          url: item.url,
          normalizedUrl: norm,
          depth: item.depth,
          parentUrl: item.parentUrl,
          pageType: "unknown",
          locale,
          title: null,
          contentHash: null,
          fetchedAt: new Date().toISOString(),
          httpStatus: null,
          outLinks: 0,
          status: "error",
          error: (err as Error).message,
          linkText: item.linkText,
        };
        graph.set(norm, node);
        state.stats.errors++;
        console.warn(`[crawl] error ${norm}: ${(err as Error).message}`);
      }
    });

    // Persist periodically
    if (processed % 20 === 0 || state.queue.length === 0) {
      saveState(state, paths.statePath, visited);
      rewriteGraph(paths.graphPath, graph);
    }
  }

  state.finishedAt = new Date().toISOString();
  saveState(state, paths.statePath, visited);
  rewriteGraph(paths.graphPath, graph);

  // Recover seed HTML from cache if needed
  if (!seedHtml) {
    const seedNode = graph.get(seedNorm);
    if (seedNode?.contentHash) {
      const p = path.join(
        paths.cacheRoot,
        seedNode.contentHash.slice(0, 2),
        `${seedNode.contentHash}.html`,
      );
      if (fs.existsSync(p)) seedHtml = fs.readFileSync(p, "utf-8");
    }
  }

  const nodes = Array.from(graph.values());
  const organs = buildOrganTree({
    seedId: opts.seed.id,
    seedUrl: opts.seed.url,
    seedHtml,
    nodes,
  });
  writeOrganTree(organs, paths.organsPath);
  console.log(
    `[✓] organs → ${paths.organsPath} (${organs.root.children.length} L1)`,
  );

  const discoveries = buildDiscoveries({
    seedId: opts.seed.id,
    nodes,
    preferLocales,
  });
  writeDiscoveries(discoveries, paths.discoveriesPath);
  console.log(
    `[✓] discoveries → ${paths.discoveriesPath} (${discoveries.documents.length} docs)`,
  );

  console.log(`[✓] graph → ${paths.graphPath} (${nodes.length} nodes)`);
  console.log(`[✓] state → ${paths.statePath}`);
  console.log(`[i] stats`, JSON.stringify(state.stats, null, 2));

  return { stats: state.stats, nodeCount: nodes.length, paths };
}

function freshState(opts: BfsOptions, seedNorm: string): CrawlState {
  return {
    version: 1,
    seedId: opts.seed.id,
    seedUrl: seedNorm,
    maxDepth: opts.maxDepth,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    finishedAt: null,
    queue: [{ url: seedNorm, depth: 0, parentUrl: null }],
    visited: [],
    stats: emptyStats(),
  };
}
