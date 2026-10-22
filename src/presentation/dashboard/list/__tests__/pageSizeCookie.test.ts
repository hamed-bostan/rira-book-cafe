import { describe, expect, it } from "vitest";

import { rememberedPageSize, type PageSizeChoices } from "../pageSizeCookie";

/** A short list's own choices: smaller pages, and no 100-row option. */
const SHORT_LIST_PAGE_SIZES = { options: [10, 25, 50], defaultPageSize: 10 } as const satisfies PageSizeChoices;

describe("rememberedPageSize", () => {
  it("asks for the remembered size, and nothing when it's the API's default", () => {
    expect(rememberedPageSize("50")).toBe(50);
    expect(rememberedPageSize("25")).toBeUndefined();
    expect(rememberedPageSize(undefined)).toBeUndefined();
  });

  it("ignores a size the list doesn't offer", () => {
    expect(rememberedPageSize("37")).toBeUndefined();
    expect(rememberedPageSize("abc")).toBeUndefined();
    expect(rememberedPageSize("100", SHORT_LIST_PAGE_SIZES)).toBe(10);
  });

  it("sends a list's own default when it differs from the API's", () => {
    expect(rememberedPageSize(undefined, SHORT_LIST_PAGE_SIZES)).toBe(10);
    expect(rememberedPageSize("25", SHORT_LIST_PAGE_SIZES)).toBeUndefined();
    expect(rememberedPageSize("50", SHORT_LIST_PAGE_SIZES)).toBe(50);
  });
});
