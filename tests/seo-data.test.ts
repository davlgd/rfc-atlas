import { describe, expect, it } from "vitest";
import { createRobots, createSitemap } from "../scripts/lib/seo-data.ts";
import { TEST_SITE_URL } from "./test-config.ts";

describe("createSitemap", () => {
  it("creates canonical, deduplicated RFC URLs", () => {
    const sitemap = createSitemap([2263, 1, 2263], TEST_SITE_URL, "/rfc/", "2026-08-30T12:00:00Z");

    expect(sitemap).toContain(`<loc>${TEST_SITE_URL}/</loc>`);
    expect(sitemap).toContain(`<loc>${TEST_SITE_URL}/rfc/1/</loc>`);
    expect(sitemap).toContain(`<loc>${TEST_SITE_URL}/rfc/2263/</loc>`);
    expect(sitemap).toContain("<lastmod>2026-08-30T12:00:00.000Z</lastmod>");
    expect(sitemap.match(/<lastmod>/g)).toHaveLength(1);
    expect(sitemap.match(/\/rfc\/2263\//g)).toHaveLength(1);
  });

  it("omits an invalid last-modified value", () => {
    expect(createSitemap([1], TEST_SITE_URL, "/rfc/", "not-a-date")).not.toContain("<lastmod>");
  });
});

describe("createRobots", () => {
  it("points crawlers to the configured sitemap", () => {
    expect(createRobots("https://example.test/subpath")).toContain(
      "Sitemap: https://example.test/sitemap.xml",
    );
  });
});
