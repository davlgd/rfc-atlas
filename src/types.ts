export type RelationKind =
  "reference-normative" | "reference-informative" | "reference-unknown" | "updates" | "obsoletes";

export interface GraphFilters {
  startYear: number;
  endYear: number;
  status: string;
  stream: string;
  relations: Set<RelationKind>;
}

export interface RfcNode {
  id: string;
  number: number;
  title: string;
  authors: string[];
  month: string | null;
  year: number | null;
  status: string;
  publicationStatus: string;
  stream: string | null;
  area: string | null;
  workingGroup: string | null;
  abstract: string;
  keywords: string[];
  also: string[];
  doi: string | null;
  bortzmeyerUrl: string | null;
  inDegree: number;
  outDegree: number;
}

export interface RfcEdge {
  id: string;
  source: string;
  target: string;
  kind: RelationKind;
}

export interface GraphArtifact {
  meta: {
    generatedAt: string;
    sourceUpdatedAt: string | null;
    nodeCount: number;
    edgeCount: number;
    citationCount: number;
    minYear: number;
    maxYear: number;
    sample: boolean;
  };
  nodes: RfcNode[];
  edges: RfcEdge[];
}
