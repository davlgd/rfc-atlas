import type { RelationKind } from "./types.ts";

export const PROJECT = {
  name: "RFC Atlas",
  version: "0.1.0",
  author: "davlgd",
  license: "MIT",
  copyrightYear: 2026,
  get url(): string {
    const siteUrl = import.meta.env?.VITE_SITE_URL;
    if (!siteUrl) throw new Error("VITE_SITE_URL must be defined");
    return siteUrl;
  },
  repositoryUrl: "https://github.com/davlgd/rfc-atlas",
} as const;

export const SEO_CONFIG = {
  title: "RFC Atlas — Visual map of Internet standards",
  description:
    "Explore every RFC through an interactive 3D map of citations, updates, obsoletes relationships, metadata, and Internet standards history.",
  socialImagePath: "/og-image.png",
  titleMaxLength: 70,
  descriptionMaxLength: 160,
  prerenderBatchSize: 100,
  relatedLinkLimit: 50,
  rootMostCitedLimit: 25,
  rootLatestLimit: 25,
} as const;

export const DATA_CONFIG = {
  graphPath: "/data/graph.json",
} as const;

export const DATA_UPDATE_CONFIG = {
  rfcIndexUrl: "https://www.rfc-editor.org/rfc-index.xml",
  datatrackerRelationsUrl: "https://datatracker.ietf.org/api/v1/doc/relateddocument/",
  bortzmeyerUrl: "https://www.bortzmeyer.org",
  userAgent: `rfc-atlas/${PROJECT.version} (metadata visualizer)`,
  relationCacheMaxAgeMs: 24 * 60 * 60 * 1000,
  relationPageSize: 1000,
  relationConcurrency: 4,
  retryAttempts: 4,
  retryDelayMs: 800,
} as const;

export const EXTERNAL_URLS = {
  author: "https://www.davlgd.fr/",
  mitLicense: "https://opensource.org/license/mit/",
  rfcEditorInfo: (number: number) => `https://www.rfc-editor.org/info/rfc${number}`,
} as const;

export const SHARE_CONFIG = {
  xIntentUrl: "https://x.com/intent/tweet",
  blueskyIntentUrl: "https://bsky.app/intent/compose",
  linkedinIntentUrl: "https://www.linkedin.com/sharing/share-offsite/",
  xTextLimit: 240,
  blueskyTextLimit: 300,
  feedbackDurationMs: 2000,
} as const;

export const URL_CONFIG = {
  rfcPathPrefix: "/rfc/",
  syncDebounceMs: 250,
  parameters: {
    rfc: "rfc",
    fromYear: "from",
    toYear: "to",
  },
} as const;

export const UI_CONFIG = {
  initialStartYear: 0,
  initialEndYear: 9999,
  latestRfcLimit: 7,
  mostCitedLimit: 7,
  searchResultLimit: 8,
  statusLegendLimit: 6,
  relatedRfcLimit: 12,
  keywordLimit: 8,
} as const;

export const RELATIONS: readonly { kind: RelationKind; label: string }[] = [
  { kind: "reference-normative", label: "Normative references" },
  { kind: "reference-informative", label: "Informative references" },
  { kind: "reference-unknown", label: "Unclassified references" },
  { kind: "updates", label: "Updates" },
  { kind: "obsoletes", label: "Obsoletes" },
];

export type RelationDirection = "outgoing" | "incoming";

/** Most specific relation first: it decides both the ordering and the primary label. */
export const RELATION_PRIORITY: readonly RelationKind[] = [
  "updates",
  "obsoletes",
  "reference-normative",
  "reference-informative",
  "reference-unknown",
];

export const RELATION_LABELS: Record<RelationDirection, Record<RelationKind, string>> = {
  outgoing: {
    updates: "Updates",
    obsoletes: "Obsoletes",
    "reference-normative": "Normative reference",
    "reference-informative": "Informative reference",
    "reference-unknown": "Reference",
  },
  incoming: {
    updates: "Updated by",
    obsoletes: "Obsoleted by",
    "reference-normative": "Normatively referenced by",
    "reference-informative": "Informatively referenced by",
    "reference-unknown": "Referenced by",
  },
};

export const MONTH_ORDER = new Map(
  [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ].map((month, index) => [month, index]),
);

const STATUS_COLORS: Record<string, string> = {
  "INTERNET STANDARD": "#3b82f6",
  "DRAFT STANDARD": "#38bdf8",
  "PROPOSED STANDARD": "#705cff",
  "BEST CURRENT PRACTICE": "#ffc42e",
  INFORMATIONAL: "#ff3ea5",
  EXPERIMENTAL: "#ff6534",
  HISTORIC: "#5f6f86",
  UNKNOWN: "#42536a",
};

export const EDGE_COLORS: Record<RelationKind, string> = {
  "reference-normative": "#60a5fa",
  "reference-informative": "#2563eb",
  "reference-unknown": "#53657a",
  updates: "#ffbd21",
  obsoletes: "#ff3d35",
};

export function statusColor(status: string): string {
  return STATUS_COLORS[status] ?? "#5b6f87";
}

export const GRAPH_CONFIG = {
  renderer: {
    maxPixelRatio: 1.35,
  },
  fog: {
    color: 0x0a0e12,
    density: 0.00022,
  },
  camera: {
    fieldOfView: 48,
    near: 1,
    far: 7000,
    position: [0, 140, 1950] as const,
  },
  controls: {
    dampingFactor: 0.055,
    rotateSpeed: 0.55,
    zoomSpeed: 0.75,
    panSpeed: 0.55,
    minDistance: 250,
    maxDistance: 3500,
    autoRotateSpeed: 0.22,
    resumeDelayMs: 5000,
  },
  shell: {
    color: 0x3b82f6,
    outer: { radius: 710, widthSegments: 42, heightSegments: 26, opacity: 0.032 },
    inner: {
      radius: 500,
      widthSegments: 32,
      heightSegments: 20,
      opacity: 0.012,
      rotation: [0.4, 0.2, 0.1] as const,
    },
    outerRotationSpeed: 0.00012,
    innerRotationSpeed: -0.00009,
  },
  nodes: {
    baseSize: 6.2,
    maxCitationBonus: 15,
    citationScale: 1.75,
    selectedScale: 1.55,
    neighborScale: 1.08,
    contextScale: 0.82,
    shader: {
      visibleThreshold: 0.1,
      perspectiveScale: 1750,
      minPointSize: 2,
      maxPointSize: 32,
      discardThreshold: 0.5,
      coreEdge: 0.08,
      haloEdge: 0.28,
      haloStrength: 0.38,
      baseBrightness: 0.95,
      haloBrightness: 0.35,
    },
  },
  edges: {
    contextOpacity: 0.12,
    selectedContextOpacity: 0.055,
    activeOpacity: 0.95,
    activeWidth: 2.4,
    activeRenderOrder: 2,
    globalIntensity: 0.52,
    selectedContextIntensity: 0.28,
    activeIntensity: 1,
    contextArcSegments: 6,
    activeArcSegments: 12,
    contextCitationThreshold: 250,
  },
  focus: {
    minimumDistance: 1250,
    durationMs: 780,
    easingPower: 3,
  },
  interaction: {
    pointThreshold: 13,
    maximumClickTravel: 5,
    tooltipOffset: 16,
  },
} as const;

export const SPHERE_LAYOUT_CONFIG = {
  baseRadius: 625,
  temporalRadiusSpread: 42,
  arcHeight: 24,
  defaultArcSegments: 7,
  collinearityEpsilon: 1e-6,
} as const;
