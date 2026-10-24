/**
 * Aggregate unit-level citation edges into a compact document graph
 * (inter-document only) plus a static polar layout for the SVG map.
 */

export interface UnitGraphEdgeIn {
  documentId: string;
  unitIndex: number;
  weight?: number;
  type?: string;
}

export interface UnitGraphFileIn {
  version?: number;
  locale?: string;
  edges: Record<string, UnitGraphEdgeIn[]>;
}

export interface DocMetaLite {
  id: string;
  title?: string;
  shortTitle?: string;
  kind?: string;
  locale?: string;
  unitCount?: number;
}

export interface DocGraphSample {
  fromUnit: number;
  toUnit: number;
}

export interface DocGraphEdge {
  documentId: string;
  count: number;
  back?: number;
  w: number;
  samples: DocGraphSample[];
}

export interface DocGraphNode {
  id: string;
  title: string;
  shortTitle: string;
  kind: string;
  inDegree: number;
  outDegree: number;
  x: number;
  y: number;
}

export interface DocGraphFile {
  version: number;
  locale: string;
  generatedFrom: string;
  nodes: DocGraphNode[];
  edges: Record<string, DocGraphEdge[]>;
}

const KIND_RING: Record<string, number> = {
  bible: 0.16,
  catechism: 0.32,
  canon_law: 0.42,
  "canon-law": 0.42,
  council: 0.52,
  magisterium: 0.68,
  patristic: 0.86,
};

const MAX_SAMPLES = 4;
const MAX_NEIGHBORS = 16;

function parseUnitKey(key: string): { documentId: string; unitIndex: number } | null {
  const i = key.lastIndexOf(":");
  if (i <= 0) return null;
  const documentId = key.slice(0, i);
  const unitIndex = Number(key.slice(i + 1));
  if (!documentId || !Number.isInteger(unitIndex) || unitIndex < 0) return null;
  return { documentId, unitIndex };
}

export function aggregateDocGraph(
  unitGraph: UnitGraphFileIn,
  metas: DocMetaLite[],
  opts?: { locale?: string; maxNeighbors?: number; maxSamples?: number },
): DocGraphFile {
  const locale = opts?.locale || unitGraph.locale || "es";
  const maxN = opts?.maxNeighbors ?? MAX_NEIGHBORS;
  const maxS = opts?.maxSamples ?? MAX_SAMPLES;
  const metaById = new Map(metas.map((m) => [m.id, m]));

  /** from → to → { count, samples } */
  const pair = new Map<string, Map<string, { count: number; samples: DocGraphSample[] }>>();

  const bump = (from: string, to: string, sample: DocGraphSample) => {
    if (from === to) return;
    let inner = pair.get(from);
    if (!inner) {
      inner = new Map();
      pair.set(from, inner);
    }
    let cell = inner.get(to);
    if (!cell) {
      cell = { count: 0, samples: [] };
      inner.set(to, cell);
    }
    cell.count += 1;
    if (cell.samples.length < maxS) cell.samples.push(sample);
  };

  for (const [key, list] of Object.entries(unitGraph.edges || {})) {
    const src = parseUnitKey(key);
    if (!src) continue;
    for (const e of list || []) {
      if (!e?.documentId || !Number.isFinite(e.unitIndex)) continue;
      if (e.type && e.type !== "ref") continue;
      bump(src.documentId, e.documentId, {
        fromUnit: src.unitIndex,
        toUnit: e.unitIndex,
      });
    }
  }

  const outCount = new Map<string, number>();
  const inCount = new Map<string, number>();
  const edges: Record<string, DocGraphEdge[]> = {};

  for (const [from, inner] of pair) {
    const rows: DocGraphEdge[] = [];
    for (const [to, cell] of inner) {
      const back = pair.get(to)?.get(from)?.count ?? 0;
      const w = Math.min(1, Math.log1p(cell.count) / Math.log1p(80));
      rows.push({
        documentId: to,
        count: cell.count,
        ...(back ? { back } : {}),
        w: Math.round(w * 1000) / 1000,
        samples: cell.samples,
      });
      outCount.set(from, (outCount.get(from) || 0) + cell.count);
      inCount.set(to, (inCount.get(to) || 0) + cell.count);
    }
    rows.sort(
      (a, b) =>
        b.count - a.count || a.documentId.localeCompare(b.documentId),
    );
    edges[from] = rows.slice(0, maxN);
  }

  const connected = new Set<string>([
    ...Object.keys(edges),
    ...[...inCount.keys()],
  ]);

  const nodesRaw: Omit<DocGraphNode, "x" | "y">[] = [...connected]
    .sort()
    .map((id) => {
      const m = metaById.get(id);
      return {
        id,
        title: m?.title || id,
        shortTitle: m?.shortTitle || id,
        kind: m?.kind || "other",
        inDegree: inCount.get(id) || 0,
        outDegree: outCount.get(id) || 0,
      };
    });

  const laid = layoutDocNodes(nodesRaw);

  return {
    version: 1,
    locale,
    generatedFrom: "unit-graph.json",
    nodes: laid,
    edges,
  };
}

export function layoutDocNodes(
  nodes: Array<Omit<DocGraphNode, "x" | "y">>,
): DocGraphNode[] {
  const byKind = new Map<string, typeof nodes>();
  for (const n of nodes) {
    const k = n.kind || "other";
    const list = byKind.get(k) || [];
    list.push(n);
    byKind.set(k, list);
  }
  const kinds = [...byKind.keys()].sort((a, b) => {
    const ra = KIND_RING[a] ?? 0.75;
    const rb = KIND_RING[b] ?? 0.75;
    return ra - rb || a.localeCompare(b);
  });

  const out: DocGraphNode[] = [];
  for (const kind of kinds) {
    const list = (byKind.get(kind) || []).slice().sort((a, b) => {
      const da = a.inDegree + a.outDegree;
      const db = b.inDegree + b.outDegree;
      return db - da || a.id.localeCompare(b.id);
    });
    const ring = KIND_RING[kind] ?? 0.75;
    const n = list.length || 1;
    list.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      const jitter = 0.04 * ((i % 3) - 1);
      const r = Math.min(0.92, Math.max(0.08, ring + jitter));
      out.push({
        ...node,
        x: Math.round((0.5 + r * 0.46 * Math.cos(angle)) * 1000) / 1000,
        y: Math.round((0.5 + r * 0.46 * Math.sin(angle)) * 1000) / 1000,
      });
    });
  }
  return out;
}

export function neighborsForDoc(
  graph: DocGraphFile | null | undefined,
  documentId: string,
): DocGraphEdge[] {
  if (!graph?.edges || !documentId) return [];
  return graph.edges[documentId] || [];
}
