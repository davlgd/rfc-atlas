import { RELATIONS } from "./config.ts";
import type { RelationKind } from "./types.ts";

const graphemeSegmenter = new Intl.Segmenter("en", { granularity: "grapheme" });

export function graphemeLength(value: string): number {
  return [...graphemeSegmenter.segment(value)].length;
}

export function truncateText(value: string, maximumLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  const segments = [...graphemeSegmenter.segment(normalized)].map(({ segment }) => segment);
  if (segments.length <= maximumLength) return normalized;

  const shortened = segments.slice(0, Math.max(0, maximumLength - 1)).join("");
  const lastSpace = shortened.lastIndexOf(" ");
  const end = lastSpace > maximumLength * 0.7 ? lastSpace : shortened.length;
  return `${shortened.slice(0, end)}…`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

export function prettyStatus(status: string): string {
  return status.toLocaleLowerCase("en-US").replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

export function relationLabel(kind: RelationKind): string {
  return RELATIONS.find((relation) => relation.kind === kind)?.label ?? kind;
}
