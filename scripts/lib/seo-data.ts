export function createSitemap(
  rfcNumbers: number[],
  siteUrl: string,
  rfcPathPrefix: string,
  lastModified?: string,
): string {
  const rootUrl = new URL("/", siteUrl);
  const locations = [rootUrl.href];
  for (const number of [...new Set(rfcNumbers)].sort((left, right) => left - right)) {
    const rfcUrl = new URL(`${rfcPathPrefix}${number}/`, rootUrl);
    locations.push(rfcUrl.href);
  }

  const lastModifiedDate = lastModified ? new Date(lastModified) : null;
  const lastModifiedElement =
    lastModifiedDate && !Number.isNaN(lastModifiedDate.getTime())
      ? `<lastmod>${lastModifiedDate.toISOString()}</lastmod>`
      : "";
  const entries = locations
    .map(
      (location, index) =>
        `  <url><loc>${location}</loc>${index === 0 ? lastModifiedElement : ""}</url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;
}

export function createRobots(siteUrl: string): string {
  const sitemapUrl = new URL("/sitemap.xml", siteUrl);
  return `User-agent: *
Allow: /

Sitemap: ${sitemapUrl.href}
`;
}
