import { describe, expect, it } from "vitest";

import { isImageUrl } from "../image-url";

describe("isImageUrl", () => {
  it("accepts uploads and site-relative paths", () => {
    expect(isImageUrl("https://abc.supabase.co/storage/v1/object/public/images/a.png")).toBe(true);
    expect(isImageUrl("/images/seed/espresso.svg")).toBe(true);
  });

  it("refuses protocol-relative, other schemes and junk", () => {
    expect(isImageUrl("//evil.example/a.png")).toBe(false);
    expect(isImageUrl("javascript:alert(1)")).toBe(false);
    expect(isImageUrl("images/a.png")).toBe(false);
  });
});
