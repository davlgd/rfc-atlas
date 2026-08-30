import { PROJECT } from "./config";
import { formatDate } from "./format";
import type { RfcNode } from "./types";

interface HeaderProps {
  query: string;
  results: RfcNode[];
  onQueryChange: (query: string) => void;
  onSelect: (id: string) => void;
}

function SearchResult({ node, onClick }: { node: RfcNode; onClick: () => void }) {
  return (
    <button className="rfc-mini" type="button" onClick={onClick}>
      <span className="rfc-mini-number">{node.number}</span>
      <span className="rfc-mini-copy">
        <strong>{node.title}</strong>
        <small>
          {node.year ?? "Unknown date"} · {node.inDegree} citations
        </small>
      </span>
    </button>
  );
}

export default function Header({ query, results, onQueryChange, onSelect }: HeaderProps) {
  return (
    <header className="topbar">
      <a className="brand" href={PROJECT.url} aria-label="RFC Atlas home">
        <span className="brand-slash">/</span>
        <span>RFC</span>
        <strong>ATLAS</strong>
      </a>
      <div className="search-wrap">
        <span className="search-icon">⌕</span>
        <input
          id="rfc-search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Number, title, author, keyword…"
          autoComplete="off"
        />
        <kbd>/</kbd>
        {results.length > 0 && (
          <div className="search-results">
            {results.map((node) => (
              <SearchResult
                key={node.id}
                node={node}
                onClick={() => {
                  onSelect(node.id);
                  onQueryChange("");
                }}
              />
            ))}
          </div>
        )}
      </div>
      <div className="topbar-meta">
        <div className="dataset-stamp">
          <span>
            {PROJECT.name} v{PROJECT.version} · © {PROJECT.copyrightYear} {PROJECT.author} ·{" "}
            {PROJECT.license}
          </span>
          <small>Build {formatDate(__BUILD_DATE__)}</small>
        </div>
        <a
          className="github-link"
          href={PROJECT.repositoryUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="RFC Atlas on GitHub"
        >
          <span className="github-mark" aria-hidden="true" />
        </a>
      </div>
    </header>
  );
}
