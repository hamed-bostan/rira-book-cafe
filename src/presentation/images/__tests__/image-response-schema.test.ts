import { describe, expect, it } from "vitest";

import { imageUploadResponseSchema } from "../image-response-schema";

describe("imageUploadResponseSchema", () => {
  it("accepts the self-hosted upload's root-relative URL", () => {
    const body = { image: { path: "products/a.png", url: "/uploads/products/a.png" } };

    expect(imageUploadResponseSchema.safeParse(body).success).toBe(true);
  });

  it("accepts an absolute http(s) URL", () => {
    expect(imageUploadResponseSchema.safeParse({ image: { url: "https://cdn.example.com/a.png" } }).success).toBe(true);
  });

  it("refuses a body without an image URL", () => {
    expect(imageUploadResponseSchema.safeParse({ image: {} }).success).toBe(false);
    expect(imageUploadResponseSchema.safeParse({ image: { url: "javascript:alert(1)" } }).success).toBe(false);
    expect(imageUploadResponseSchema.safeParse({ image: { url: "//evil.example.com/a.png" } }).success).toBe(false);
  });
});
