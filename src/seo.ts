import { EXTERNAL_URLS, PROJECT, SEO_CONFIG, URL_CONFIG } from "./config.ts";
import { truncateText } from "./format.ts";
import type { RfcNode } from "./types.ts";

export interface SeoMetadata {
  title: string;
  description: string;
  canonicalUrl: string;
  socialImageUrl: string;
  socialImageAlt: string;
  type: "website" | "article";
  structuredData: Record<string, unknown>;
}

function applicationStructuredData(siteUrl: URL) {
  return {
    "@type": "WebApplication",
    "@id": `${siteUrl.href}#application`,
    name: PROJECT.name,
    url: siteUrl.href,
    description: SEO_CONFIG.description,
    applicationCategory: "ReferenceApplication",
    operatingSystem: "Any",
    isAccessibleForFree: true,
    author: {
      "@type": "Person",
      name: PROJECT.author,
      url: EXTERNAL_URLS.author,
    },
    license: EXTERNAL_URLS.mitLicense,
    codeRepository: PROJECT.repositoryUrl,
  };
}

export function createSeoMetadata(node: RfcNode | null, siteUrl: string): SeoMetadata {
  const canonicalUrl = new URL("/", siteUrl);
  const socialImageUrl = new URL(SEO_CONFIG.socialImagePath, canonicalUrl).href;

  if (!node) {
    return {
      title: SEO_CONFIG.title,
      description: SEO_CONFIG.description,
      canonicalUrl: canonicalUrl.href,
      socialImageUrl,
      socialImageAlt: "RFC Atlas visual map of Internet standards",
      type: "website",
      structuredData: {
        "@context": "https://schema.org",
        ...applicationStructuredData(canonicalUrl),
      },
    };
  }

  canonicalUrl.pathname = `${URL_CONFIG.rfcPathPrefix}${node.number}/`;
  const titlePrefix = `RFC ${node.number}: `;
  const titleSuffix = ` — ${PROJECT.name}`;
  const title = `${titlePrefix}${truncateText(
    node.title,
    SEO_CONFIG.titleMaxLength - titlePrefix.length - titleSuffix.length,
  )}${titleSuffix}`;
  const description = truncateText(
    node.abstract ||
      `Explore RFC ${node.number}, its citations, updates, obsoletes relationships, and metadata in RFC Atlas.`,
    SEO_CONFIG.descriptionMaxLength,
  );
  const officialUrl = EXTERNAL_URLS.rfcEditorInfo(node.number);

  return {
    title,
    description,
    canonicalUrl: canonicalUrl.href,
    socialImageUrl,
    socialImageAlt: truncateText(
      `RFC ${node.number}: ${node.title} — visualized in RFC Atlas`,
      SEO_CONFIG.descriptionMaxLength,
    ),
    type: "article",
    structuredData: {
      "@context": "https://schema.org",
      "@graph": [
        applicationStructuredData(new URL("/", siteUrl)),
        {
          "@type": "TechArticle",
          "@id": `${canonicalUrl.href}#rfc`,
          headline: `RFC ${node.number}: ${node.title}`,
          name: `RFC ${node.number}`,
          identifier: `RFC ${node.number}`,
          description,
          url: canonicalUrl.href,
          mainEntityOfPage: canonicalUrl.href,
          sameAs: [officialUrl, ...(node.bortzmeyerUrl ? [node.bortzmeyerUrl] : [])],
          author: node.authors.map((name) => ({ "@type": "Person", name })),
          datePublished: node.year ? String(node.year) : undefined,
          keywords: node.keywords,
          publisher: {
            "@type": "Organization",
            name: "RFC Editor",
            url: "https://www.rfc-editor.org/",
          },
          isPartOf: { "@id": `${new URL("/", siteUrl).href}#application` },
        },
      ],
    },
  };
}

export function applySeoMetadata(node: RfcNode | null): void {
  const metadata = createSeoMetadata(node, PROJECT.url);
  document.title = metadata.title;

  const setNamedMeta = (name: string, content: string) =>
    document
      .querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
      ?.setAttribute("content", content);
  const setPropertyMeta = (property: string, content: string) =>
    document
      .querySelector<HTMLMetaElement>(`meta[property="${property}"]`)
      ?.setAttribute("content", content);

  setNamedMeta("description", metadata.description);
  setNamedMeta("twitter:title", metadata.title);
  setNamedMeta("twitter:description", metadata.description);
  setNamedMeta("twitter:image", metadata.socialImageUrl);
  setNamedMeta("twitter:image:alt", metadata.socialImageAlt);
  setPropertyMeta("og:type", metadata.type);
  setPropertyMeta("og:title", metadata.title);
  setPropertyMeta("og:description", metadata.description);
  setPropertyMeta("og:url", metadata.canonicalUrl);
  setPropertyMeta("og:image", metadata.socialImageUrl);
  setPropertyMeta("og:image:alt", metadata.socialImageAlt);
  document
    .querySelector<HTMLLinkElement>('link[rel="canonical"]')
    ?.setAttribute("href", metadata.canonicalUrl);

  const structuredData = document.querySelector<HTMLScriptElement>("#structured-data");
  if (structuredData) structuredData.textContent = JSON.stringify(metadata.structuredData);
}
