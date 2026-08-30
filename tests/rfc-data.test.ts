import { describe, expect, it } from "vitest";
import {
  normalizeRelatedDocument,
  parseBortzmeyerRfcIndex,
  parseBortzmeyerSeriesIndex,
  parseRfcIndex,
} from "../scripts/lib/rfc-data.ts";

describe("parseBortzmeyerRfcIndex", () => {
  it("keeps only explicitly published standalone RFC articles", () => {
    const html = `
      <a href="9803.html" class="rfc">RFC 9803</a>
      <a href="10037.html">L'article seul</a>
      <a href="/10024.html">L’article seul</a>
      <a href="10037.html">L'article seul</a>
    `;

    expect(parseBortzmeyerRfcIndex(html)).toEqual([10024, 10037]);
  });
});

describe("parseBortzmeyerSeriesIndex", () => {
  it("extracts and numerically sorts the official series pages", () => {
    const html = `
      <a href="10000_rfcs.html">10000</a>
      <a href="0_rfcs.html">0</a>
      <a href="1000_rfcs.html">1000</a>
      <a href="1000_rfcs.html">duplicate</a>
    `;

    expect(parseBortzmeyerSeriesIndex(html)).toEqual([
      "0_rfcs.html",
      "1000_rfcs.html",
      "10000_rfcs.html",
    ]);
  });
});

describe("parseRfcIndex", () => {
  it("normalizes metadata and editorial relationships", () => {
    const nodes =
      parseRfcIndex(`<?xml version="1.0"?><rfc-index xmlns="https://www.rfc-editor.org/rfc-index">
      <rfc-entry><doc-id>RFC9000</doc-id><title>QUIC</title><author><name>A. Author</name></author>
      <date><month>May</month><year>2021</year></date><keywords><kw>transport</kw></keywords>
      <abstract><p>A secure <em>transport</em>.</p></abstract><current-status>PROPOSED STANDARD</current-status>
      <publication-status>PROPOSED STANDARD</publication-status><stream>IETF</stream>
      <is-also><doc-id>STD99</doc-id></is-also><updates><doc-id>RFC8000</doc-id></updates><obsoletes><doc-id>RFC7000</doc-id></obsoletes></rfc-entry>
    </rfc-index>`);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({ id: "RFC9000", number: 9000, title: "QUIC", year: 2021 });
    expect(nodes[0].abstract).toContain("secure");
    expect(nodes[0].abstract).toContain("transport");
    expect(nodes[0].updates).toEqual(["RFC8000"]);
    expect(nodes[0].obsoletes).toEqual(["RFC7000"]);
    expect(nodes[0].also).toEqual(["STD99"]);
  });
});

describe("normalizeRelatedDocument", () => {
  it("maps a normative Datatracker reference", () => {
    expect(
      normalizeRelatedDocument({
        id: 42,
        source: "/api/v1/doc/document/rfc9000/",
        target: "/api/v1/doc/document/rfc8446/",
        relationship: "/api/v1/name/docrelationshipname/refnorm/",
      }),
    ).toEqual({ id: "dt-42", source: "RFC9000", target: "RFC8446", kind: "reference-normative" });
  });

  it("ignores targets that are not RFCs", () => {
    expect(
      normalizeRelatedDocument({
        id: 43,
        source: "/api/v1/doc/document/rfc9000/",
        target: "/api/v1/doc/document/bcp38/",
        relationship: "/api/v1/name/docrelationshipname/refnorm/",
      }),
    ).toBeNull();
  });
});
