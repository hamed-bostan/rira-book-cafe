import { describe, expect, it } from "vitest";

import { formatNumberTrimmed } from "../formatNumber";

describe("formatNumberTrimmed", () => {
  it("drops decimals a whole number doesn't need", () => {
    expect(formatNumberTrimmed(30, "en", 3)).toBe("30");
    expect(formatNumberTrimmed(2000, "en", 3)).toBe("2,000");
  });

  it("keeps the decimals a value does need, up to the limit", () => {
    expect(formatNumberTrimmed(0.5, "en", 3)).toBe("0.5");
    expect(formatNumberTrimmed(2.756, "en", 2)).toBe("2.76");
  });

  it("uses Persian digits in Persian", () => {
    expect(formatNumberTrimmed(30, "fa", 1)).toBe("۳۰");
  });
});
