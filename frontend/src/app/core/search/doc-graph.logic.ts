/**
 * Pure helpers for the document citation map (no Angular).
 */

import type {
  DocGraphEdge,
  DocGraphFile,
  DocGraphNode,
} from './topic-pack.models';

export const KIND_LABEL: Record<string, string> = {
  bible: 'Escritura',
  catechism: 'Catecismo',
  magisterium: 'Magisterio',
  council: 'Concilio',
  'canon-law': 'Derecho',
  patristic: 'Padres',
};

export function kindLabel(kind: string | undefined): string {
  if (!kind) return 'Obra';
  return KIND_LABEL[kind] || kind;
}

export function nodeById(
  graph: DocGraphFile | null | undefined,
  id: string,
): DocGraphNode | null {
  if (!graph?.nodes || !id) return null;
  return graph.nodes.find((n) => n.id === id) || null;
}

export function neighborsForDoc(
  graph: DocGraphFile | null | undefined,
  documentId: string,
): DocGraphEdge[] {
  if (!graph?.edges || !documentId) return [];
  return graph.edges[documentId] || [];
}

/** Incoming neighbors (who cites this document). */
export function incomingForDoc(
  graph: DocGraphFile | null | undefined,
  documentId: string,
): Array<DocGraphEdge & { fromId: string }> {
  if (!graph?.edges || !documentId) return [];
  const out: Array<DocGraphEdge & { fromId: string }> = [];
  for (const [from, list] of Object.entries(graph.edges)) {
    for (const e of list) {
      if (e.documentId === documentId) {
        out.push({ ...e, fromId: from });
      }
    }
  }
  out.sort((a, b) => b.count - a.count || a.fromId.localeCompare(b.fromId));
  return out;
}

export interface VisibleGraph {
  nodes: DocGraphNode[];
  links: Array<{ from: string; to: string; count: number; w: number }>;
}

/**
 * Overview: connected nodes only, cap by degree.
 * Focus: ego + neighbors (outgoing and incoming).
 */
export function visibleSubgraph(
  graph: DocGraphFile | null | undefined,
  opts?: { focusId?: string | null; kind?: string | null; q?: string; cap?: number },
): VisibleGraph {
  if (!graph?.nodes?.length) return { nodes: [], links: [] };
  const cap = opts?.cap ?? 40;
  const q = (opts?.q || '').trim().toLowerCase();
  const kind = opts?.kind || null;
  const focusId = opts?.focusId || null;

  let nodes = graph.nodes.slice();
  if (kind) nodes = nodes.filter((n) => n.kind === kind);
  if (q) {
    nodes = nodes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.shortTitle.toLowerCase().includes(q) ||
        n.id.toLowerCase().includes(q),
    );
  }

  if (focusId) {
    const neigh = new Set<string>([focusId]);
    for (const e of neighborsForDoc(graph, focusId)) neigh.add(e.documentId);
    for (const e of incomingForDoc(graph, focusId)) neigh.add(e.fromId);
    nodes = graph.nodes.filter((n) => neigh.has(n.id));
  } else {
    nodes = nodes
      .slice()
      .sort(
        (a, b) =>
          b.inDegree + b.outDegree - (a.inDegree + a.outDegree) ||
          a.id.localeCompare(b.id),
      )
      .slice(0, cap);
  }

  const keep = new Set(nodes.map((n) => n.id));
  const links: VisibleGraph['links'] = [];
  const seen = new Set<string>();
  for (const from of keep) {
    for (const e of neighborsForDoc(graph, from)) {
      if (!keep.has(e.documentId)) continue;
      const k = `${from}>${e.documentId}`;
      if (seen.has(k)) continue;
      seen.add(k);
      links.push({ from, to: e.documentId, count: e.count, w: e.w });
    }
  }
  return { nodes, links };
}

export function edgeSamples(
  graph: DocGraphFile | null | undefined,
  fromId: string,
  toId: string,
): DocGraphEdge | null {
  if (!graph) return null;
  return neighborsForDoc(graph, fromId).find((e) => e.documentId === toId) || null;
}
