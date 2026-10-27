import { describe, expect, it } from "vitest";

import { formatPersianMonth, normalizeAmount } from "../expenseFormat";

describe("normalizeAmount", () => {
  it("reads Persian and Arabic digits and drops thousands separators", () => {
    expect(normalizeAmount("۱٬۲۰۰٬۰۰۰")).toBe("1200000");
    expect(normalizeAmount("١٢٣")).toBe("123");
    expect(normalizeAmount("1,200 000")).toBe("1200000");
  });

  it("leaves anything else for the schema to refuse", () => {
    expect(normalizeAmount("12.5")).toBe("12.5");
  });
});

describe("formatPersianMonth", () => {
  it("names the Persian month a cafe day falls in", () => {
    expect(formatPersianMonth("2026-10-22", "en")).toBe("Mehr");
    expect(formatPersianMonth("2026-10-23", "en")).toBe("Aban");
    expect(formatPersianMonth("2026-10-23", "fa")).toBe("آبان");
  });
});
