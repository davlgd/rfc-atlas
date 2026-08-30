import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  collectRelated,
  createRfcFallback,
  createRootFallback,
  createSeoPage,
} from "../scripts/lib/seo-pages";
import { SEO_CONFIG } from "../src/config";
import { indexEdges } from "../src/edge-index";
import { createSeoMetadata } from "../src/seo";
import type { RfcEdge, RfcNode } from "../src/types";
import { TEST_SITE_URL } from "./test-config";

function createNode(number: number, overrides: Partial<RfcNode> = {}): RfcNode {
  return {
    id: `RFC${number}`,
    number,
    title: `Title ${number}`,
    authors: ["D. Levi"],
    month: "January",
    year: 1998,
    status: "INTERNET STANDARD",
    publicationStatus: "PROPOSED STANDARD",
    stream: "IETF",
    area: "rtg",
    workingGroup: "ripv2",
    abstract: `Abstract ${number}.`,
    keywords: ["SNMP"],
    also: [],
    doi: null,
    bortzmeyerUrl: null,
    inDegree: 0,
    outDegree: 0,
    ...overrides,
  };
}

function createEdge(source: number, target: number, kind: RfcEdge["kind"]): RfcEdge {
  return {
    id: `RFC${source}-RFC${target}-${kind}`,
    source: `RFC${source}`,
    target: `RFC${target}`,
    kind,
  };
}

const node: RfcNode = createNode(2263, {
  title: "SNMPv3 Applications",
  authors: ["D. Levi", "P. Meyer", "B. Stewart"],
  abstract: "This document describes five types of SNMP applications.",
  inDegree: 12,
  outDegree: 8,
});

describe("createSeoMetadata", () => {
  it("creates a canonical, indexable RFC page description", () => {
    const metadata = createSeoMetadata(node, TEST_SITE_URL);

    expect(metadata.canonicalUrl).toBe(`${TEST_SITE_URL}/rfc/2263/`);
    expect(metadata.title).toContain("RFC 2263");
    expect(metadata.title.endsWith("— RFC Atlas")).toBe(true);
    expect(metadata.description.length).toBeLessThanOrEqual(SEO_CONFIG.descriptionMaxLength);
    expect(metadata.type).toBe("article");
  });

  it("pre-renders RFC metadata and readable fallback content", async () => {
    const template = await readFile(new URL("../index.html", import.meta.url), "utf8");
    const metadata = createSeoMetadata(node, TEST_SITE_URL);
    const html = createSeoPage(
      template,
      metadata,
      "<main><h1>RFC 2263: SNMPv3 Applications</h1></main>",
    );

    expect(html).toContain(`<title>${metadata.title}</title>`);
    expect(html).toContain(`href="${metadata.canonicalUrl}"`);
    expect(html).toContain(`content="${metadata.socialImageAlt}"`);
    expect(html).toContain('property="og:type" content="article"');
    expect(html).toContain('"@type":"TechArticle"');
    expect(html).toContain("<h1>RFC 2263: SNMPv3 Applications</h1>");
    expect(html).not.toContain('property="og:url" content="%VITE_SITE_URL%/"');
  });
});

describe("collectRelated", () => {
  const nodes = [node, createNode(2119, { inDegree: 500 }), createNode(5246, { inDegree: 300 })];
  const nodeById = new Map(nodes.map((entry) => [entry.id, entry]));

  it("deduplicates neighbours, aggregates labels and drops self-links", () => {
    const edgeIndex = indexEdges([
      createEdge(2263, 2119, "reference-normative"),
      createEdge(2263, 2119, "updates"),
      createEdge(2263, 2263, "reference-normative"),
      createEdge(2263, 404, "reference-informative"),
      createEdge(2263, 5246, "reference-informative"),
    ]);
    const related = collectRelated(node, "outgoing", edgeIndex, nodeById);

    expect(related.total).toBe(2);
    expect(related.links.map((link) => link.number)).toEqual([2119, 5246]);
    expect(related.links[0].labels).toEqual(["Updates", "Normative reference"]);
    expect(related.links[1].labels).toEqual(["Informative reference"]);
  });

  it("labels incoming relationships from the neighbour's point of view", () => {
    const edgeIndex = indexEdges([
      createEdge(5246, 2263, "obsoletes"),
      createEdge(2119, 2263, "reference-normative"),
    ]);
    const related = collectRelated(node, "incoming", edgeIndex, nodeById);

    expect(related.links).toEqual([
      { number: 5246, title: "Title 5246", labels: ["Obsoleted by"], inDegree: 300 },
      { number: 2119, title: "Title 2119", labels: ["Normatively referenced by"], inDegree: 500 },
    ]);
  });

  it("caps the rendered links while reporting the real total", () => {
    const neighbours = Array.from({ length: SEO_CONFIG.relatedLinkLimit + 10 }, (_, index) =>
      createNode(3000 + index),
    );
    const edgeIndex = indexEdges(
      neighbours.map((neighbour) => createEdge(2263, neighbour.number, "reference-informative")),
    );
    const related = collectRelated(
      node,
      "outgoing",
      edgeIndex,
      new Map([node, ...neighbours].map((entry) => [entry.id, entry])),
    );

    expect(related.total).toBe(SEO_CONFIG.relatedLinkLimit + 10);
    expect(related.links).toHaveLength(SEO_CONFIG.relatedLinkLimit);
  });
});

describe("createRfcFallback", () => {
  it("emits crawlable internal links, a truncation notice and escaped titles", () => {
    const hostile = createNode(9999, { title: 'Tags <b> & "quotes"' });
    const nodeById = new Map([node, hostile].map((entry) => [entry.id, entry]));
    const edgeIndex = indexEdges([createEdge(2263, 9999, "updates")]);
    const outgoing = collectRelated(node, "outgoing", edgeIndex, nodeById);
    const incoming = { links: outgoing.links, total: outgoing.total + 5 };
    const metadata = createSeoMetadata(node, TEST_SITE_URL);
    const fallback = createRfcFallback(node, metadata, outgoing, incoming);

    expect(fallback).toContain(
      '<a href="/rfc/9999/">RFC 9999: Tags &lt;b&gt; &amp; &quot;quotes&quot;</a>',
    );
    expect(fallback).toContain("Updates — ");
    expect(fallback).toContain("<h2>Outgoing relationships (1 related RFC)</h2>");
    expect(fallback).toContain("<p>Showing 1 of 6 related RFCs.</p>");
    expect(fallback).not.toContain("<b>");
  });

  it("omits empty relationship sections", () => {
    const metadata = createSeoMetadata(node, TEST_SITE_URL);
    const fallback = createRfcFallback(
      node,
      metadata,
      { links: [], total: 0 },
      { links: [], total: 0 },
    );

    expect(fallback).not.toContain("<h2>");
    expect(fallback).toContain("Read RFC 2263 on the RFC Editor");
  });
});

describe("createRootFallback", () => {
  it("links the most cited and the most recent RFCs", () => {
    const fallback = createRootFallback([
      createNode(2119, { inDegree: 500, year: 1997 }),
      createNode(9999, { inDegree: 1, year: 2026, month: "June" }),
      createNode(8446, { inDegree: 300, year: 2018 }),
    ]);

    expect(fallback).toContain("<h2>Most cited RFCs</h2>");
    expect(fallback).toContain("<h2>Latest RFCs</h2>");
    expect(fallback.indexOf('href="/rfc/2119/"')).toBeLessThan(
      fallback.indexOf('href="/rfc/8446/"'),
    );
    expect(fallback).toContain('<a href="/rfc/9999/">RFC 9999: Title 9999</a>');
  });

  it("never lists the same RFC in both root sections, and still fills the second one", () => {
    // Enough nodes to saturate "most cited", so "latest" only survives through the exclusion.
    const cited = Array.from({ length: SEO_CONFIG.rootMostCitedLimit }, (_, index) =>
      createNode(1000 + index, { inDegree: 500 - index, year: 1990 }),
    );
    // The most cited RFC is also the most recent one: it must appear in a single section.
    cited[0] = createNode(1000, { inDegree: 500, year: 2026, month: "June" });
    const recent = createNode(9000, { inDegree: 0, year: 2025, month: "May" });
    const fallback = createRootFallback([...cited, recent]);

    expect(fallback.match(/href="\/rfc\/1000\/"/g)).toHaveLength(1);
    expect(fallback.indexOf('href="/rfc/9000/"')).toBeGreaterThan(
      fallback.indexOf("<h2>Latest RFCs</h2>"),
    );
  });
});
