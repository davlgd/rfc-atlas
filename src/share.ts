import { SHARE_CONFIG } from "./config.ts";
import { graphemeLength, truncateText } from "./format.ts";
import { createSeoMetadata } from "./seo.ts";
import type { RfcNode } from "./types.ts";

export interface ShareTargets {
  canonicalUrl: string;
  x: string;
  bluesky: string;
  linkedin: string;
}

function intentUrl(baseUrl: string, parameters: Record<string, string>): string {
  const url = new URL(baseUrl);
  for (const [name, value] of Object.entries(parameters)) url.searchParams.set(name, value);
  return url.href;
}

export function createShareLinks(node: RfcNode, siteUrl: string): ShareTargets {
  const canonicalUrl = createSeoMetadata(node, siteUrl).canonicalUrl;
  const label = `RFC ${node.number}: ${node.title}`;
  const blueskyLabelLimit =
    SHARE_CONFIG.blueskyTextLimit - graphemeLength(canonicalUrl) - graphemeLength("\n");

  return {
    canonicalUrl,
    x: intentUrl(SHARE_CONFIG.xIntentUrl, {
      text: truncateText(label, SHARE_CONFIG.xTextLimit),
      url: canonicalUrl,
    }),
    bluesky: intentUrl(SHARE_CONFIG.blueskyIntentUrl, {
      text: `${truncateText(label, blueskyLabelLimit)}\n${canonicalUrl}`,
    }),
    linkedin: intentUrl(SHARE_CONFIG.linkedinIntentUrl, { url: canonicalUrl }),
  };
}
