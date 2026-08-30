import { describe, expect, it } from "vitest";
import packageMetadata from "../package.json";
import { PROJECT } from "../src/config";

describe("project configuration", () => {
  it("stays aligned with package metadata", () => {
    expect(PROJECT.version).toBe(packageMetadata.version);
    expect(PROJECT.author).toBe(packageMetadata.author);
    expect(PROJECT.license).toBe(packageMetadata.license);
    expect(`${PROJECT.repositoryUrl}.git`).toBe(packageMetadata.repository.url);
  });
});
