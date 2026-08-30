import ControlPanel from "./ControlPanel";
import Graph3DView from "./Graph3DView";
import Header from "./Header";
import RfcDetails from "./RfcDetails";
import { UI_CONFIG, statusColor } from "./config";
import { formatNumber, prettyStatus } from "./format";
import { useRfcAtlas } from "./useRfcAtlas";

export default function App() {
  const atlas = useRfcAtlas();

  if (atlas.loadError) {
    return (
      <main className="state-screen">
        <span className="brand-mark">RFC/ATLAS</span>
        <h1>Data unavailable</h1>
        <p>
          Generate the graph with <code>npm run data:update</code>, then reload the page.
        </p>
        <small>{atlas.loadError}</small>
      </main>
    );
  }
  if (!atlas.artifact) {
    return (
      <main className="state-screen loading">
        <span className="brand-mark">RFC/ATLAS</span>
        <div className="loader" />
        <p>Loading the memory of the Internet…</p>
      </main>
    );
  }

  const artifact = atlas.artifact;
  return (
    <div className="app-shell">
      <Header
        query={atlas.query}
        results={atlas.results}
        onQueryChange={atlas.setQuery}
        onSelect={atlas.selectNode}
      />

      <ControlPanel
        artifact={artifact}
        filters={atlas.filters}
        setFilters={atlas.setFilters}
        open={atlas.panelOpen}
        statuses={atlas.statuses}
        streams={atlas.streams}
        latestNodes={atlas.latestNodes}
        topNodes={atlas.topNodes}
        onToggle={() => atlas.setPanelOpen((open) => !open)}
        onSelect={atlas.selectNode}
        onToggleRelation={atlas.toggleRelation}
      />

      <main className="graph-stage">
        <Graph3DView
          artifact={artifact}
          edgeIndex={atlas.edgeIndex}
          filters={atlas.filters}
          selectedId={atlas.selectedId}
          onSelect={atlas.selectNode}
          focusId={atlas.focusId}
        />
        <div className="metric-strip">
          <div>
            <strong>{formatNumber(artifact.meta.nodeCount)}</strong>
            <span>Indexed RFCs</span>
          </div>
          <div>
            <strong>{formatNumber(artifact.meta.citationCount)}</strong>
            <span>Citations</span>
          </div>
          <div>
            <strong>{artifact.meta.maxYear - artifact.meta.minYear + 1}</strong>
            <span>Years of history</span>
          </div>
        </div>
        <div className="graph-hint">
          <span>DRAG</span> to rotate <i /> <span>SCROLL</span> to dive <i /> <span>CLICK</span> to
          explore
        </div>
        <div className="status-legend">
          {atlas.statuses.slice(0, UI_CONFIG.statusLegendLimit).map((status) => (
            <span key={status}>
              <i style={{ background: statusColor(status) }} />
              {prettyStatus(status)}
            </span>
          ))}
        </div>
      </main>

      <aside
        className={`detail-panel ${atlas.selectedNode ? "visible" : ""}`}
        aria-hidden={!atlas.selectedNode}
      >
        {atlas.selectedNode && (
          <RfcDetails
            node={atlas.selectedNode}
            incoming={atlas.incoming}
            outgoing={atlas.outgoing}
            nodeById={atlas.nodeById}
            onSelect={atlas.selectNode}
            onClose={() => atlas.selectNode(null)}
          />
        )}
      </aside>
    </div>
  );
}
