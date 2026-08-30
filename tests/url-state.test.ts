import { describe, expect, it } from "vitest";
import { createUrl, includeYear, parseUrlState } from "../src/url-state";
import { TEST_SITE_URL } from "./test-config";

const bounds = { minYear: 1969, maxYear: 2026 };

describe("parseUrlState", () => {
  it("reads an RFC and publication range", () => {
    expect(parseUrlState("?rfc=2263&from=1995&to=2005", bounds)).toEqual({
      rfcNumber: 2263,
      fromYear: 1995,
      toYear: 2005,
    });
  });

  it("reads a pre-rendered RFC route", () => {
    expect(parseUrlState("?from=1995", bounds, "/rfc/2263/")).toEqual({
      rfcNumber: 2263,
      fromYear: 1995,
      toYear: 2026,
    });
  });

  it("clamps and orders years while rejecting invalid RFC values", () => {
    expect(parseUrlState("?rfc=nope&from=2040&to=1900", bounds)).toEqual({
      rfcNumber: null,
      fromYear: 1969,
      toYear: 2026,
    });
  });
});

describe("createUrl", () => {
  it("normalizes RFC query parameters to routes while preserving unrelated parameters", () => {
    expect(
      createUrl(
        { rfcNumber: 2263, fromYear: bounds.minYear, toYear: bounds.maxYear },
        bounds,
        `${TEST_SITE_URL}/?campaign=docs&from=2000&rfc=2263`,
      ).href,
    ).toBe(`${TEST_SITE_URL}/rfc/2263/?campaign=docs`);
  });
});

describe("includeYear", () => {
  it("widens a range so a selected RFC remains visible", () => {
    expect(includeYear({ rfcNumber: 2263, fromYear: 2010, toYear: 2020 }, 1998)).toEqual({
      rfcNumber: 2263,
      fromYear: 1998,
      toYear: 2020,
    });
  });
});
