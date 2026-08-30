import { describe, expect, it } from "vitest";
import { createPositions } from "../src/spherical-layout";
import type { GraphArtifact, RfcNode } from "../src/types";

function node(id: string, number: number, year: number): RfcNode {
  return {
    id,
    number,
    year,
    title: id,
    authors: [],
    month: null,
    status: "INFORMATIONAL",
    publicationStatus: "INFORMATIONAL",
    stream: "IETF",
    area: null,
    workingGroup: null,
    abstract: "",
    keywords: [],
    also: [],
    doi: null,
    bortzmeyerUrl: null,
    inDegree: 0,
    outDegree: 0,
  };
}

describe("spherical layout", () => {
  it("distributes nodes across every dimension of a spherical shell", () => {
    const artifact: GraphArtifact = {
      meta: {
        generatedAt: "",
        sourceUpdatedAt: null,
        nodeCount: 240,
        edgeCount: 0,
        citationCount: 0,
        minYear: 1968,
        maxYear: 2026,
        sample: true,
      },
      nodes: Array.from({ length: 240 }, (_, index) =>
        node(`RFC${index + 1}`, index + 1, 1968 + (index % 59)),
      ),
      edges: [],
    };
    const positions = [...createPositions(artifact).values()];
    for (const position of positions) {
      expect(position.length()).toBeGreaterThan(550);
      expect(position.length()).toBeLessThan(690);
    }
    const extent = (axis: "x" | "y" | "z") =>
      Math.max(...positions.map((position) => position[axis])) -
      Math.min(...positions.map((position) => position[axis]));
    expect(extent("x")).toBeGreaterThan(1_100);
    expect(extent("y")).toBeGreaterThan(1_100);
    expect(extent("z")).toBeGreaterThan(1_100);
  });
});
