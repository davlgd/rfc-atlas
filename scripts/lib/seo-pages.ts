import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  EXTERNAL_URLS,
  MONTH_ORDER,
  RELATION_LABELS,
  RELATION_PRIORITY,
  SEO_CONFIG,
  URL_CONFIG,
  type RelationDirection,
} from "../../src/config.ts";
import { indexEdges, type EdgeIndex } from "../../src/edge-index.ts";
import { createSeoMetadata, type SeoMetadata } from "../../src/seo.ts";
import type { GraphArtifact, RelationKind, RfcNode } from "../../src/types.ts";

interface RelatedRfc {
  number: number;
  title: string;
  labels: string[];
  inDegree: number;
}

export interface RelatedRfcs {
  links: RelatedRfc[];
  total: number;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function replaceRequired(
  html: string,
  pattern: RegExp,
  replacement: (before: string, after: string) => string,
): string {
  let replaced = false;
  const result = html.replace(pattern, (_match, before: string, after: string) => {
    replaced = true;
    return replacement(before, after);
  });
  if (!replaced) throw new Error(`SEO template marker not found: ${pattern.source}`);
  return result;
}

function replaceMeta(
  html: string,
  attribute: "name" | "property",
  key: string,
  value: string,
): string {
  const pattern = new RegExp(`(<meta\\s+${attribute}="${key}"\\s+content=")[^"]*("\\s*/?>)`);
  return replaceRequired(html, pattern, (before, after) => `${before}${escapeHtml(value)}${after}`);
}

export function collectRelated(
  node: RfcNode,
  direction: RelationDirection,
  edgeIndex: EdgeIndex,
  nodeById: Map<string, RfcNode>,
): RelatedRfcs {
  const neighbors = new Map<string, { node: RfcNode; kinds: Set<RelationKind> }>();
  for (const edge of edgeIndex[direction].get(node.id) ?? []) {
    const neighborId = direction === "outgoing" ? edge.target : edge.source;
    if (neighborId === node.id) continue;
    const neighbor = nodeById.get(neighborId);
    if (!neighbor) continue;
    const existing = neighbors.get(neighborId);
    if (existing) existing.kinds.add(edge.kind);
    else neighbors.set(neighborId, { node: neighbor, kinds: new Set([edge.kind]) });
  }

  const links = [...neighbors.values()]
    .map(({ node: neighbor, kinds }) => {
      const orderedKinds = RELATION_PRIORITY.filter((kind) => kinds.has(kind));
      return {
        number: neighbor.number,
        title: neighbor.title,
        labels: orderedKinds.map((kind) => RELATION_LABELS[direction][kind]),
        inDegree: neighbor.inDegree,
        priority: RELATION_PRIORITY.indexOf(orderedKinds[0]),
      };
    })
    .sort(
      (left, right) =>
        left.priority - right.priority ||
        right.inDegree - left.inDegree ||
        left.number - right.number,
    )
    .map(({ number, title, labels, inDegree }) => ({ number, title, labels, inDegree }));

  return { links: links.slice(0, SEO_CONFIG.relatedLinkLimit), total: links.length };
}

function rfcHref(number: number): string {
  return `${URL_CONFIG.rfcPathPrefix}${number}/`;
}

function rfcListItem(number: number, title: string, prefix = ""): string {
  return `<li>${prefix}<a href="${rfcHref(number)}">RFC ${number}: ${escapeHtml(title)}</a></li>`;
}

function countRelated(count: number): string {
  return `${count} related RFC${count === 1 ? "" : "s"}`;
}

function relatedSection(heading: string, related: RelatedRfcs): string {
  if (related.links.length === 0) return "";
  const truncated =
    related.total > related.links.length
      ? `<p>Showing ${related.links.length} of ${countRelated(related.total)}.</p>`
      : "";
  const items = related.links
    .map((link) => rfcListItem(link.number, link.title, `${escapeHtml(link.labels.join(", "))} — `))
    .join("");
  return `<section><h2>${heading} (${countRelated(related.total)})</h2>${truncated}<ul>${items}</ul></section>`;
}

export function createRfcFallback(
  node: RfcNode,
  metadata: SeoMetadata,
  outgoing: RelatedRfcs,
  incoming: RelatedRfcs,
): string {
  const officialUrl = escapeHtml(EXTERNAL_URLS.rfcEditorInfo(node.number));
  return [
    `<main><h1>RFC ${node.number}: ${escapeHtml(node.title)}</h1>`,
    `<p>${escapeHtml(metadata.description)}</p>`,
    `<p><a href="${officialUrl}">Read RFC ${node.number} on the RFC Editor</a></p>`,
    relatedSection("Outgoing relationships", outgoing),
    relatedSection("Incoming relationships", incoming),
    "</main>",
  ].join("");
}

export function createRootFallback(nodes: readonly RfcNode[]): string {
  const mostCited = [...nodes]
    .sort((left, right) => right.inDegree - left.inDegree || left.number - right.number)
    .slice(0, SEO_CONFIG.rootMostCitedLimit);
  const mostCitedIds = new Set(mostCited.map((node) => node.id));
  const latest = [...nodes]
    .filter((node) => node.year !== null && !mostCitedIds.has(node.id))
    .sort(
      (left, right) =>
        (right.year ?? 0) - (left.year ?? 0) ||
        (MONTH_ORDER.get(right.month ?? "") ?? -1) - (MONTH_ORDER.get(left.month ?? "") ?? -1) ||
        right.number - left.number,
    )
    .slice(0, SEO_CONFIG.rootLatestLimit);

  const list = (items: readonly RfcNode[]) =>
    `<ul>${items.map((node) => rfcListItem(node.number, node.title)).join("")}</ul>`;
  return [
    `<main><h1>${escapeHtml(SEO_CONFIG.title)}</h1>`,
    `<p>${escapeHtml(SEO_CONFIG.description)}</p>`,
    `<section><h2>Most cited RFCs</h2>${list(mostCited)}</section>`,
    `<section><h2>Latest RFCs</h2>${list(latest)}</section>`,
    "</main>",
  ].join("");
}

export function createSeoPage(
  htmlTemplate: string,
  metadata: SeoMetadata,
  fallbackBody: string,
): string {
  let html = replaceRequired(
    htmlTemplate,
    /(<title>)[\s\S]*?(<\/title>)/,
    (before, after) => `${before}${escapeHtml(metadata.title)}${after}`,
  );
  html = replaceMeta(html, "name", "description", metadata.description);
  html = replaceMeta(html, "name", "twitter:title", metadata.title);
  html = replaceMeta(html, "name", "twitter:description", metadata.description);
  html = replaceMeta(html, "name", "twitter:image", metadata.socialImageUrl);
  html = replaceMeta(html, "name", "twitter:image:alt", metadata.socialImageAlt);
  html = replaceMeta(html, "property", "og:type", metadata.type);
  html = replaceMeta(html, "property", "og:title", metadata.title);
  html = replaceMeta(html, "property", "og:description", metadata.description);
  html = replaceMeta(html, "property", "og:url", metadata.canonicalUrl);
  html = replaceMeta(html, "property", "og:image", metadata.socialImageUrl);
  html = replaceMeta(html, "property", "og:image:alt", metadata.socialImageAlt);
  html = replaceRequired(
    html,
    /(<link\s+rel="canonical"\s+href=")[^"]*("\s*\/?>)/,
    (before, after) => `${before}${escapeHtml(metadata.canonicalUrl)}${after}`,
  );
  const structuredData = JSON.stringify(metadata.structuredData).replaceAll("<", "\\u003c");
  html = replaceRequired(
    html,
    /(<script id="structured-data" type="application\/ld\+json">)[\s\S]*?(<\/script>)/,
    (before, after) => `${before}${structuredData}${after}`,
  );
  return replaceRequired(
    html,
    /(<noscript id="seo-fallback">)[\s\S]*?(<\/noscript>)/,
    (before, after) => `${before}${fallbackBody}${after}`,
  );
}

export async function generateSeoPages(
  graphPath: string,
  outputDirectory: string,
  siteUrl: string,
): Promise<number> {
  const artifact = JSON.parse(await readFile(graphPath, "utf8")) as GraphArtifact;
  const htmlTemplate = await readFile(join(outputDirectory, "index.html"), "utf8");
  const routeDirectory = URL_CONFIG.rfcPathPrefix.replace(/^\/+|\/+$/g, "");
  const nodeById = new Map(artifact.nodes.map((node) => [node.id, node]));
  const edgeIndex = indexEdges(artifact.edges);

  for (let index = 0; index < artifact.nodes.length; index += SEO_CONFIG.prerenderBatchSize) {
    const batch = artifact.nodes.slice(index, index + SEO_CONFIG.prerenderBatchSize);
    await Promise.all(
      batch.map(async (node) => {
        const outputPath = join(outputDirectory, routeDirectory, String(node.number), "index.html");
        const metadata = createSeoMetadata(node, siteUrl);
        const fallback = createRfcFallback(
          node,
          metadata,
          collectRelated(node, "outgoing", edgeIndex, nodeById),
          collectRelated(node, "incoming", edgeIndex, nodeById),
        );
        await mkdir(dirname(outputPath), { recursive: true });
        await writeFile(outputPath, createSeoPage(htmlTemplate, metadata, fallback));
      }),
    );
  }

  await writeFile(
    join(outputDirectory, "index.html"),
    createSeoPage(
      htmlTemplate,
      createSeoMetadata(null, siteUrl),
      createRootFallback(artifact.nodes),
    ),
  );
  return artifact.nodes.length;
}
