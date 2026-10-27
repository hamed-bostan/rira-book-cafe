import { describe, expect, it } from "vitest";

import { buildExpenseParams, parseExpenseFilters } from "../accounting-params";

describe("parseExpenseFilters", () => {
  it("reads the status, supplier and search", () => {
    const filters = parseExpenseFilters(new URLSearchParams("status=unpaid&supplier=s1&q=%20milk%20"));

    expect(filters).toEqual({ status: "unpaid", supplierId: "s1", query: "milk" });
  });

  it("drops an unknown status and a blank search", () => {
    expect(parseExpenseFilters(new URLSearchParams("status=lost&q=%20%20"))).toEqual({});
  });

  it("cuts a search longer than any description", () => {
    const filters = parseExpenseFilters(new URLSearchParams({ q: "x".repeat(250) }));

    expect(filters.query).toHaveLength(100);
  });

  it("round-trips through buildExpenseParams", () => {
    const filters = { status: "paid" as const, supplierId: "s1", query: "EX-1042" };

    expect(parseExpenseFilters(buildExpenseParams(filters))).toEqual(filters);
  });
});
