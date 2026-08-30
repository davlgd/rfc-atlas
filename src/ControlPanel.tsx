import type { Dispatch, SetStateAction } from "react";
import { EDGE_COLORS, RELATIONS } from "./config";
import type { GraphArtifact, GraphFilters, RelationKind, RfcNode } from "./types";

interface ControlPanelProps {
  artifact: GraphArtifact;
  filters: GraphFilters;
  setFilters: Dispatch<SetStateAction<GraphFilters>>;
  open: boolean;
  statuses: string[];
  streams: string[];
  latestNodes: RfcNode[];
  topNodes: RfcNode[];
  onToggle: () => void;
  onSelect: (id: string) => void;
  onToggleRelation: (kind: RelationKind) => void;
}

export default function ControlPanel({
  artifact,
  filters,
  setFilters,
  open,
  statuses,
  streams,
  latestNodes,
  topNodes,
  onToggle,
  onSelect,
  onToggleRelation,
}: ControlPanelProps) {
  return (
    <aside className={`control-panel ${open ? "open" : "closed"}`}>
      <button
        className="panel-toggle"
        type="button"
        onClick={onToggle}
        aria-label={open ? "Close filters" : "Open filters"}
      >
        {open ? "‹" : "›"}
      </button>
      <div className="panel-scroll">
        <section className="intro-block">
          <p className="eyebrow">
            RFC SERIES · {artifact.meta.minYear}—{artifact.meta.maxYear}
          </p>
          <h1>
            The living map
            <br />
            of <em>Internet</em> standards.
          </h1>
          <p>
            Explore the documents that built the network — and the intellectual links connecting
            them.
          </p>
        </section>
        <section className="filter-section">
          <div className="section-heading">
            <h2>Relationships</h2>
            <button
              type="button"
              onClick={() =>
                setFilters((current) => ({
                  ...current,
                  relations: current.relations.size
                    ? new Set()
                    : new Set(RELATIONS.map(({ kind }) => kind)),
                }))
              }
            >
              {filters.relations.size ? "Hide all" : "Show all"}
            </button>
          </div>
          <div className="relation-list">
            {RELATIONS.map(({ kind, label }) => (
              <button
                key={kind}
                type="button"
                className={filters.relations.has(kind) ? "active" : ""}
                onClick={() => onToggleRelation(kind)}
              >
                <span className="relation-line" style={{ backgroundColor: EDGE_COLORS[kind] }} />
                {label}
                <span className="check">{filters.relations.has(kind) ? "✓" : ""}</span>
              </button>
            ))}
          </div>
        </section>
        <section className="filter-section two-selects">
          <label>
            Status
            <select
              value={filters.status}
              onChange={(event) =>
                setFilters((current) => ({ ...current, status: event.target.value }))
              }
            >
              <option value="ALL">All</option>
              {statuses.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
          <label>
            Stream
            <select
              value={filters.stream}
              onChange={(event) =>
                setFilters((current) => ({ ...current, stream: event.target.value }))
              }
            >
              <option value="ALL">All</option>
              {streams.map((stream) => (
                <option key={stream}>{stream}</option>
              ))}
            </select>
          </label>
        </section>
        <section className="filter-section year-filter">
          <div className="section-heading">
            <h2>Publication range</h2>
            <strong>
              {filters.startYear}—{filters.endYear}
            </strong>
          </div>
          <label className="year-bound">
            <span>From</span>
            <input
              aria-label="Minimum publication year"
              type="range"
              min={artifact.meta.minYear}
              max={filters.endYear}
              value={filters.startYear}
              onChange={(event) =>
                setFilters((current) => ({ ...current, startYear: Number(event.target.value) }))
              }
            />
            <strong>{filters.startYear}</strong>
          </label>
          <label className="year-bound">
            <span>To</span>
            <input
              aria-label="Maximum publication year"
              type="range"
              min={filters.startYear}
              max={artifact.meta.maxYear}
              value={filters.endYear}
              onChange={(event) =>
                setFilters((current) => ({ ...current, endYear: Number(event.target.value) }))
              }
            />
            <strong>{filters.endYear}</strong>
          </label>
          <div className="year-extents">
            <span>{artifact.meta.minYear}</span>
            <span>{artifact.meta.maxYear}</span>
          </div>
        </section>
        <section className="filter-section latest-list">
          <div className="section-heading">
            <h2>Latest RFCs</h2>
            <span>PUBLICATION</span>
          </div>
          {latestNodes.map((node) => (
            <button
              key={node.id}
              type="button"
              onClick={() => onSelect(node.id)}
              aria-label={`Select RFC ${node.number}: ${node.title}`}
            >
              <span>
                <strong>RFC {node.number}</strong>
                <small>{node.title}</small>
              </span>
            </button>
          ))}
        </section>
        <section className="filter-section top-list">
          <div className="section-heading">
            <h2>Most cited</h2>
            <span>IN-DEGREE</span>
          </div>
          {topNodes.map((node, index) => (
            <button key={node.id} type="button" onClick={() => onSelect(node.id)}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>RFC {node.number}</strong>
              <small>{node.inDegree}</small>
            </button>
          ))}
        </section>
      </div>
    </aside>
  );
}
