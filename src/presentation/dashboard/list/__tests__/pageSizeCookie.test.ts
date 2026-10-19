import { describe, expect, it } from "vitest";

import { CATEGORY_PAGE_SIZES } from "../../categories/category-page-sizes";
import { rememberedPageSize } from "../pageSizeCookie";

describe("rememberedPageSize", () => {
  it("asks for the remembered size, and nothing when it's the API's default", () => {
    expect(rememberedPageSize("50")).toBe(50);
    expect(rememberedPageSize("25")).toBeUndefined();
    expect(rememberedPageSize(undefined)).toBeUndefined();
  });

  it("ignores a size the list doesn't offer", () => {
    expect(rememberedPageSize("37")).toBeUndefined();
    expect(rememberedPageSize("abc")).toBeUndefined();
    expect(rememberedPageSize("100", CATEGORY_PAGE_SIZES)).toBe(10);
  });

  it("sends a list's own default when it differs from the API's", () => {
    expect(rememberedPageSize(undefined, CATEGORY_PAGE_SIZES)).toBe(10);
    expect(rememberedPageSize("25", CATEGORY_PAGE_SIZES)).toBeUndefined();
    expect(rememberedPageSize("50", CATEGORY_PAGE_SIZES)).toBe(50);
  });
});
