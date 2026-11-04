import { describe, expect, it } from "vitest";

import { isActivityFiltered, parseAdminActivityFilters } from "../admin-activity-params";

const parse = (query: string) => parseAdminActivityFilters(new URLSearchParams(query));

describe("parseAdminActivityFilters", () => {
  it("turns a span of cafe days into the Tehran instants it covers, both ends inclusive", () => {
    const filters = parse("from=2026-11-01&to=2026-11-03");
    // Midnight in Tehran (+03:30) is 20:30 UTC the day before.
    expect(filters.from?.toISOString()).toBe("2026-10-31T20:30:00.000Z");
    expect(filters.to?.toISOString()).toBe("2026-11-03T20:30:00.000Z");
  });

  it("takes a known action and free text, trimmed and capped", () => {
    expect(parse("action=user.roleCreated").action).toBe("user.roleCreated");
    expect(parse(`q=${encodeURIComponent("  Kian  ")}`).search).toBe("Kian");
    expect(parse(`q=${"x".repeat(300)}`).search).toHaveLength(100);
  });

  it("drops what it doesn't recognise rather than failing", () => {
    expect(parse("action=nope&from=yesterday&to=2026-13-40&q=%20%20&entityType=x")).toEqual({});
  });
});

describe("isActivityFiltered", () => {
  it("is true for any narrowing filter, and not for paging", () => {
    expect(isActivityFiltered(new URLSearchParams("page=2&pageSize=50"))).toBe(false);
    expect(isActivityFiltered(new URLSearchParams("q=Kian"))).toBe(true);
    expect(isActivityFiltered(new URLSearchParams("from=2026-11-01"))).toBe(true);
    expect(isActivityFiltered(new URLSearchParams("action=user.roleCreated"))).toBe(true);
  });
});
