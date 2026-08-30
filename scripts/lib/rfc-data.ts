import { XMLParser } from "fast-xml-parser";
import type { RelationKind } from "../../src/types.ts";

export interface ParsedRfc {
  id: string;
  number: number;
  title: string;
  authors: string[];
  month: string | null;
  year: number | null;
  status: string;
  publicationStatus: string;
  stream: string | null;
  area: string | null;
  workingGroup: string | null;
  abstract: string;
  keywords: string[];
  also: string[];
  doi: string | null;
  updates: string[];
  obsoletes: string[];
}

export interface RelatedDocumentApiObject {
  id: number;
  source: string;
  target: string;
  relationship: string;
}

export interface NormalizedRelation {
  id: string;
  source: string;
  target: string;
  kind: RelationKind;
}

const BORTZMEYER_ARTICLE_LINK =
  /<a\b[^>]*href=["'](?:https?:\/\/www\.bortzmeyer\.org\/|\/)?(\d+)\.html["'][^>]*>\s*L(?:'|’|&#39;|&apos;)article seul\s*<\/a>/giu;
const BORTZMEYER_SERIES_LINK = /href=["'](\d+_rfcs\.html)["']/giu;

const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
});

function array<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function text(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(" ");
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.entries(record)
      .filter(([key]) => !key.startsWith("@_"))
      .map(([, child]) => text(child))
      .filter(Boolean)
      .join(" ");
  }
  return "";
}

function documentIds(value: unknown, pattern = /^RFC\d+$/i): string[] {
  if (!value || typeof value !== "object") return [];
  const ids = array((value as { "doc-id"?: unknown })["doc-id"]);
  return ids
    .map(text)
    .filter((id) => pattern.test(id))
    .map((id) => id.toUpperCase());
}

export function parseRfcIndex(xml: string): ParsedRfc[] {
  const parsed = parser.parse(xml) as { "rfc-index"?: { "rfc-entry"?: Record<string, unknown>[] } };
  const entries = array(parsed["rfc-index"]?.["rfc-entry"]);

  return entries.flatMap((entry) => {
    const id = text(entry["doc-id"]).toUpperCase();
    const match = /^RFC(\d+)$/.exec(id);
    if (!match) return [];

    const authors = array(entry.author as Record<string, unknown> | Record<string, unknown>[])
      .map((author) => text(author?.name))
      .filter(Boolean);
    const date = (entry.date ?? {}) as Record<string, unknown>;
    const keywords = (entry.keywords ?? {}) as { kw?: unknown };
    const abstract = text(entry.abstract).replace(/\s+/g, " ").trim();

    return [
      {
        id,
        number: Number(match[1]),
        title: text(entry.title),
        authors,
        month: text(date.month) || null,
        year: Number(text(date.year)) || null,
        status: text(entry["current-status"]) || "UNKNOWN",
        publicationStatus: text(entry["publication-status"]) || "UNKNOWN",
        stream: text(entry.stream) || null,
        area: text(entry.area) || null,
        workingGroup: text(entry.wg_acronym) || null,
        abstract,
        keywords: array(keywords.kw).map(text).filter(Boolean),
        also: documentIds(entry["is-also"], /^(?:RFC|BCP|STD|FYI)\d+$/i),
        doi: text(entry.doi) || null,
        updates: documentIds(entry.updates),
        obsoletes: documentIds(entry.obsoletes),
      },
    ];
  });
}

export function parseBortzmeyerRfcIndex(html: string): number[] {
  return [
    ...new Set([...html.matchAll(BORTZMEYER_ARTICLE_LINK)].map((match) => Number(match[1]))),
  ].sort((left, right) => left - right);
}

export function parseBortzmeyerSeriesIndex(html: string): string[] {
  return [...new Set([...html.matchAll(BORTZMEYER_SERIES_LINK)].map((match) => match[1]))].sort(
    (left, right) => Number.parseInt(left, 10) - Number.parseInt(right, 10),
  );
}

function idFromResourceUri(uri: string): string | null {
  const match = /\/document\/(rfc\d+)\/?$/i.exec(uri);
  return match ? match[1].toUpperCase() : null;
}

export function normalizeRelatedDocument(
  item: RelatedDocumentApiObject,
): NormalizedRelation | null {
  const source = idFromResourceUri(item.source);
  const target = idFromResourceUri(item.target);
  const slug = /\/([^/]+)\/?$/.exec(item.relationship)?.[1];
  const kind: RelationKind | undefined =
    slug === "refnorm"
      ? "reference-normative"
      : slug === "refinfo"
        ? "reference-informative"
        : slug === "ref"
          ? "reference-unknown"
          : undefined;
  if (!source || !target || !kind) return null;
  return { id: `dt-${item.id}`, source, target, kind };
}
