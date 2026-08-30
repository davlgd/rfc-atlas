import type { RfcEdge } from "./types.ts";

export interface EdgeIndex {
  outgoing: Map<string, RfcEdge[]>;
  incoming: Map<string, RfcEdge[]>;
}

function appendEdge(index: Map<string, RfcEdge[]>, key: string, edge: RfcEdge): void {
  const bucket = index.get(key);
  if (bucket) bucket.push(edge);
  else index.set(key, [edge]);
}

/** Indexes each relationship once so selection and SEO lookups scale with node degree. */
export function indexEdges(edges: readonly RfcEdge[]): EdgeIndex {
  const outgoing = new Map<string, RfcEdge[]>();
  const incoming = new Map<string, RfcEdge[]>();
  for (const edge of edges) {
    if (edge.source === edge.target) continue;
    appendEdge(outgoing, edge.source, edge);
    appendEdge(incoming, edge.target, edge);
  }
  return { outgoing, incoming };
}
