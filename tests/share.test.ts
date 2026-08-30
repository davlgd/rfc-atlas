import { describe, expect, it } from "vitest";
import { SHARE_CONFIG } from "../src/config";
import { createShareLinks } from "../src/share";
import type { RfcNode } from "../src/types";
import { TEST_SITE_URL } from "./test-config";

const node: RfcNode = {
  id: "RFC8446",
  number: 8446,
  title: "The Transport Layer Security (TLS) Protocol & Version 1.3",
  authors: ["E. Rescorla"],
  month: "August",
  year: 2018,
  status: "PROPOSED STANDARD",
  publicationStatus: "PROPOSED STANDARD",
  stream: "IETF",
  area: "sec",
  workingGroup: "tls",
  abstract: "TLS 1.3.",
  keywords: ["TLS"],
  also: [],
  doi: "10.17487/RFC8446",
  bortzmeyerUrl: null,
  inDegree: 1,
  outDegree: 1,
};

function graphemeCount(value: string): number {
  return [...new Intl.Segmenter("en", { granularity: "grapheme" }).segment(value)].length;
}

describe("createShareLinks", () => {
  it("uses the pre-rendered canonical RFC URL for every target", () => {
    const links = createShareLinks(node, `${TEST_SITE_URL}/?from=1990&to=2000`);
    const x = new URL(links.x);
    const bluesky = new URL(links.bluesky);
    const linkedin = new URL(links.linkedin);

    expect(links.canonicalUrl).toBe(`${TEST_SITE_URL}/rfc/8446/`);
    expect(x.origin + x.pathname).toBe("https://x.com/intent/tweet");
    expect(x.searchParams.get("text")).toBe(
      "RFC 8446: The Transport Layer Security (TLS) Protocol & Version 1.3",
    );
    expect(x.searchParams.get("url")).toBe(links.canonicalUrl);
    expect(bluesky.searchParams.get("text")).toBe(
      `RFC 8446: The Transport Layer Security (TLS) Protocol & Version 1.3\n${links.canonicalUrl}`,
    );
    expect(Object.fromEntries(linkedin.searchParams)).toEqual({ url: links.canonicalUrl });
  });

  it("keeps generated social text within the configured limits", () => {
    const links = createShareLinks(
      { ...node, title: "Protocol ".repeat(100) },
      "https://example.com",
    );
    const xText = new URL(links.x).searchParams.get("text") ?? "";
    const blueskyText = new URL(links.bluesky).searchParams.get("text") ?? "";

    expect(graphemeCount(xText)).toBeLessThanOrEqual(SHARE_CONFIG.xTextLimit);
    expect(graphemeCount(blueskyText)).toBeLessThanOrEqual(SHARE_CONFIG.blueskyTextLimit);
    expect(xText.endsWith("…")).toBe(true);
    expect(blueskyText).toContain("…\nhttps://example.com/rfc/8446/");
  });
});
