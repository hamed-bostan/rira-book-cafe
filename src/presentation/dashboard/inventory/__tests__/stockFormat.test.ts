import { describe, expect, it } from "vitest";

import { formatStockQuantity, formatUnitCost } from "../stockFormat";

describe("formatStockQuantity", () => {
  it("shows whole quantities without decimals", () => {
    expect(formatStockQuantity(24, "en")).toBe("24");
    expect(formatStockQuantity(1200, "en")).toBe("1,200");
  });

  it("keeps only the decimals a quantity carries, up to three", () => {
    expect(formatStockQuantity(8.4, "en")).toBe("8.4");
    expect(formatStockQuantity(0.125, "en")).toBe("0.125");
    expect(formatStockQuantity(2.0004, "en")).toBe("2");
  });

  it("uses Persian digits under fa", () => {
    expect(formatStockQuantity(8.4, "fa")).toBe("۸٫۴");
  });
});

describe("formatUnitCost", () => {
  it("rounds costs of a hundred Toman or more to the Toman", () => {
    expect(formatUnitCost(1450000, "en")).toBe("1,450,000");
    expect(formatUnitCost(145.6, "en")).toBe("146");
  });

  it("keeps up to two decimals for small per-gram costs", () => {
    expect(formatUnitCost(1.8, "en")).toBe("1.8");
    expect(formatUnitCost(12.345, "en")).toBe("12.35");
    expect(formatUnitCost(7, "en")).toBe("7");
  });
});
