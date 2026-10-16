import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { parseAnalyticsRange, parseTopItemSort, rangeParams, selectedRangeOption } from "../analytics-params";

const NOW = new Date("2026-10-20T10:00:00Z");

describe("analytics params", () => {
  it("defaults to the last 30 days", () => {
    expect(parseAnalyticsRange(new URLSearchParams(), NOW)).toMatchObject({ fromDay: "2026-09-21", toDay: "2026-10-20" });
    expect(selectedRangeOption(new URLSearchParams())).toBe("30d");
  });

  it("takes a custom span of cafe days, inclusive", () => {
    const params = new URLSearchParams({ from: "2026-10-01", to: "2026-10-03" });
    expect(parseAnalyticsRange(params, NOW)).toMatchObject({ fromDay: "2026-10-01", toDay: "2026-10-03" });
    expect(selectedRangeOption(params)).toBe("custom");
  });

  it("rejects half spans, reversed spans, bad presets and over-long spans", () => {
    const queries: Record<string, string>[] = [{ from: "2026-10-01" }, { from: "2026-10-05", to: "2026-10-01" }, { range: "1y" }, { from: "2024-01-01", to: "2026-01-01" }];
    for (const query of queries) {
      expect(() => parseAnalyticsRange(new URLSearchParams(query), NOW)).toThrow(ZodError);
    }
  });

  it("forwards only range and sort params", () => {
    const params = new URLSearchParams({ range: "7d", sort: "quantity", page: "2" });
    expect(rangeParams(params)).toEqual({ range: "7d", sort: "quantity" });
    expect(parseTopItemSort(params)).toBe("quantity");
    expect(parseTopItemSort(new URLSearchParams({ sort: "nope" }))).toBe("revenue");
  });
});
