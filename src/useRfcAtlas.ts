import { useCallback, useEffect, useMemo, useState } from "react";
import { DATA_CONFIG, MONTH_ORDER, RELATIONS, UI_CONFIG, URL_CONFIG } from "./config";
import { indexEdges } from "./edge-index";
import { applySeoMetadata } from "./seo";
import type { GraphArtifact, GraphFilters, RelationKind } from "./types";
import { includeYear, parseUrlState, writeUrlState } from "./url-state";

const INITIAL_FILTERS: GraphFilters = {
  startYear: UI_CONFIG.initialStartYear,
  endYear: UI_CONFIG.initialEndYear,
  status: "ALL",
  stream: "ALL",
  relations: new Set(RELATIONS.map(({ kind }) => kind)),
};

function resolveLocation(artifact: GraphArtifact) {
  const bounds = { minYear: artifact.meta.minYear, maxYear: artifact.meta.maxYear };
  const urlState = parseUrlState(window.location.search, bounds, window.location.pathname);
  const node = urlState.rfcNumber
    ? artifact.nodes.find((candidate) => candidate.number === urlState.rfcNumber)
    : undefined;
  return { node, urlState: includeYear(urlState, node?.year ?? null) };
}

export function useRfcAtlas() {
  const [artifact, setArtifact] = useState<GraphArtifact | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [urlReady, setUrlReady] = useState(false);
  const [filters, setFilters] = useState<GraphFilters>(INITIAL_FILTERS);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(DATA_CONFIG.graphPath, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<GraphArtifact>;
      })
      .then((data) => {
        const { node, urlState } = resolveLocation(data);
        setArtifact(data);
        setFilters((current) => ({
          ...current,
          startYear: urlState.fromYear,
          endYear: urlState.toYear,
        }));
        setSelectedId(node?.id ?? null);
        setFocusId(node?.id ?? null);
        if (node) setPanelOpen(true);
        setUrlReady(true);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadError(error instanceof Error ? error.message : String(error));
      });
    return () => controller.abort();
  }, []);

  const nodeById = useMemo(
    () => new Map(artifact?.nodes.map((node) => [node.id, node]) ?? []),
    [artifact],
  );
  const edgeIndex = useMemo(() => indexEdges(artifact?.edges ?? []), [artifact]);
  const selectedNode = selectedId ? (nodeById.get(selectedId) ?? null) : null;
  const incoming = selectedId ? (edgeIndex.incoming.get(selectedId) ?? []) : [];
  const outgoing = selectedId ? (edgeIndex.outgoing.get(selectedId) ?? []) : [];

  useEffect(() => {
    if (urlReady) applySeoMetadata(selectedNode);
  }, [selectedNode, urlReady]);

  const statuses = useMemo(
    () => [...new Set(artifact?.nodes.map((node) => node.status) ?? [])].sort(),
    [artifact],
  );
  const streams = useMemo(
    () => [...new Set(artifact?.nodes.flatMap((node) => node.stream ?? []) ?? [])].sort(),
    [artifact],
  );
  const topNodes = useMemo(
    () =>
      [...(artifact?.nodes ?? [])]
        .sort((left, right) => right.inDegree - left.inDegree)
        .slice(0, UI_CONFIG.mostCitedLimit),
    [artifact],
  );
  const latestNodes = useMemo(
    () =>
      [...(artifact?.nodes ?? [])]
        .filter((node) => node.year !== null)
        .sort(
          (left, right) =>
            (right.year ?? 0) - (left.year ?? 0) ||
            (MONTH_ORDER.get(right.month ?? "") ?? -1) -
              (MONTH_ORDER.get(left.month ?? "") ?? -1) ||
            right.number - left.number,
        )
        .slice(0, UI_CONFIG.latestRfcLimit),
    [artifact],
  );
  const results = useMemo(() => {
    const needle = query
      .trim()
      .toLocaleLowerCase("en-US")
      .replace(/^rfc\s*/, "");
    if (!needle || !artifact) return [];
    return artifact.nodes
      .filter((node) =>
        `${node.number} ${node.title} ${node.authors.join(" ")} ${node.keywords.join(" ")}`
          .toLocaleLowerCase("en-US")
          .includes(needle),
      )
      .sort((left, right) => {
        const leftStartsWith = Number(String(left.number).startsWith(needle));
        const rightStartsWith = Number(String(right.number).startsWith(needle));
        return leftStartsWith === rightStartsWith
          ? right.inDegree - left.inDegree
          : rightStartsWith - leftStartsWith;
      })
      .slice(0, UI_CONFIG.searchResultLimit);
  }, [artifact, query]);

  const selectNode = useCallback(
    (id: string | null) => {
      const node = id ? nodeById.get(id) : undefined;
      const nextUrlState = includeYear(
        {
          rfcNumber: node?.number ?? null,
          fromYear: filters.startYear,
          toYear: filters.endYear,
        },
        node?.year ?? null,
      );
      if (artifact && urlReady) {
        writeUrlState(
          nextUrlState,
          { minYear: artifact.meta.minYear, maxYear: artifact.meta.maxYear },
          "push",
        );
      }
      if (nextUrlState.fromYear !== filters.startYear || nextUrlState.toYear !== filters.endYear) {
        setFilters((current) => ({
          ...current,
          startYear: nextUrlState.fromYear,
          endYear: nextUrlState.toYear,
        }));
      }
      setSelectedId(id);
      setFocusId(id);
      if (id) setPanelOpen(true);
    },
    [artifact, filters.endYear, filters.startYear, nodeById, urlReady],
  );

  useEffect(() => {
    if (!artifact || !urlReady) return;
    const timer = window.setTimeout(
      () =>
        writeUrlState(
          {
            rfcNumber: selectedNode?.number ?? null,
            fromYear: filters.startYear,
            toYear: filters.endYear,
          },
          { minYear: artifact.meta.minYear, maxYear: artifact.meta.maxYear },
          "replace",
        ),
      URL_CONFIG.syncDebounceMs,
    );
    return () => window.clearTimeout(timer);
  }, [artifact, filters.endYear, filters.startYear, selectedNode, urlReady]);

  useEffect(() => {
    if (!artifact) return;
    const onPopState = () => {
      const { node, urlState } = resolveLocation(artifact);
      setFilters((current) => ({
        ...current,
        startYear: urlState.fromYear,
        endYear: urlState.toYear,
      }));
      setSelectedId(node?.id ?? null);
      setFocusId(node?.id ?? null);
      if (node) setPanelOpen(true);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [artifact]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        selectNode(null);
        setQuery("");
      }
      if (event.key === "/" && document.activeElement?.tagName !== "INPUT") {
        event.preventDefault();
        document.querySelector<HTMLInputElement>("#rfc-search")?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectNode]);

  const toggleRelation = useCallback((kind: RelationKind) => {
    setFilters((current) => {
      const relations = new Set(current.relations);
      if (relations.has(kind)) relations.delete(kind);
      else relations.add(kind);
      return { ...current, relations };
    });
  }, []);

  return {
    artifact,
    edgeIndex,
    filters,
    focusId,
    incoming,
    latestNodes,
    loadError,
    nodeById,
    outgoing,
    panelOpen,
    query,
    results,
    selectedId,
    selectedNode,
    setFilters,
    setPanelOpen,
    setQuery,
    statuses,
    streams,
    topNodes,
    selectNode,
    toggleRelation,
  };
}
