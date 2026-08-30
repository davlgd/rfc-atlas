import { EDGE_COLORS, EXTERNAL_URLS, UI_CONFIG, statusColor } from "./config";
import { prettyStatus, relationLabel } from "./format";
import ShareLinks from "./ShareLinks";
import type { RfcEdge, RfcNode } from "./types";

interface RfcDetailsProps {
  node: RfcNode;
  incoming: RfcEdge[];
  outgoing: RfcEdge[];
  nodeById: Map<string, RfcNode>;
  onSelect: (id: string) => void;
  onClose: () => void;
}

interface RelatedItem {
  edge: RfcEdge;
  node: RfcNode;
}

function relatedItems(
  edges: RfcEdge[],
  incomingDirection: boolean,
  nodeById: Map<string, RfcNode>,
): RelatedItem[] {
  return edges
    .slice(0, UI_CONFIG.relatedRfcLimit)
    .map((edge) => ({ edge, node: nodeById.get(incomingDirection ? edge.source : edge.target) }))
    .filter((item): item is RelatedItem => Boolean(item.node));
}

function Related({
  title,
  items,
  onSelect,
}: {
  title: string;
  items: RelatedItem[];
  onSelect: (id: string) => void;
}) {
  return (
    <section className="related">
      <h3>{title}</h3>
      {items.map(({ edge, node }) => (
        <button key={edge.id} type="button" onClick={() => onSelect(node.id)}>
          <span style={{ background: EDGE_COLORS[edge.kind] }} />
          <strong>RFC {node.number}</strong>
          <small>{relationLabel(edge.kind)}</small>
        </button>
      ))}
    </section>
  );
}

export default function RfcDetails({
  node,
  incoming,
  outgoing,
  nodeById,
  onSelect,
  onClose,
}: RfcDetailsProps) {
  const color = statusColor(node.status);
  return (
    <div className="detail-scroll">
      <button className="detail-close" type="button" onClick={onClose} aria-label="Close">
        ×
      </button>
      <div className="detail-number">
        <span>RFC</span>
        {node.number}
      </div>
      <span className="status-pill" style={{ color, borderColor: `${color}55` }}>
        <i style={{ background: color }} />
        {prettyStatus(node.status)}
      </span>
      <h2>{node.title}</h2>
      <ShareLinks node={node} />
      <p className="detail-byline">
        {node.authors.join(", ") || "Unknown author"}
        <br />
        {[node.month, node.year].filter(Boolean).join(" ")} {node.stream ? `· ${node.stream}` : ""}
      </p>
      <div className="detail-stats">
        <div>
          <strong>{node.inDegree}</strong>
          <span>cited by</span>
        </div>
        <div>
          <strong>{node.outDegree}</strong>
          <span>references</span>
        </div>
        <div>
          <strong>{incoming.filter((edge) => edge.kind === "updates").length}</strong>
          <span>updates</span>
        </div>
      </div>
      {node.abstract && (
        <section>
          <h3>Abstract</h3>
          <p className="abstract">{node.abstract}</p>
        </section>
      )}
      {node.keywords.length > 0 && (
        <div className="tags">
          {node.keywords.slice(0, UI_CONFIG.keywordLimit).map((keyword) => (
            <span key={keyword}>{keyword}</span>
          ))}
        </div>
      )}
      {outgoing.length > 0 && (
        <Related
          title="Outgoing references"
          items={relatedItems(outgoing, false, nodeById)}
          onSelect={onSelect}
        />
      )}
      {incoming.length > 0 && (
        <Related
          title="Incoming related documents"
          items={relatedItems(incoming, true, nodeById)}
          onSelect={onSelect}
        />
      )}
      <div className="external-links">
        <a
          className="official-link"
          href={EXTERNAL_URLS.rfcEditorInfo(node.number)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Read on RFC Editor <span>↗</span>
        </a>
        {node.bortzmeyerUrl && (
          <a
            className="official-link"
            href={node.bortzmeyerUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Read Bortzmeyer's analysis <span>↗</span>
          </a>
        )}
      </div>
    </div>
  );
}
