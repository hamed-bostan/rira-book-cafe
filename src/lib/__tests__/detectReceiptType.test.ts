import { describe, expect, it } from "vitest";

import { detectReceiptType } from "../detectReceiptType";

const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);

describe("detectReceiptType", () => {
  it("knows a PDF by its header", () => {
    expect(detectReceiptType(bytes("%PDF-1.7\n%âãÏÓ\n1 0 obj"))).toBe("application/pdf");
  });

  it("still knows the images", () => {
    expect(detectReceiptType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(detectReceiptType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
  });

  it.each([
    ["a header further in", bytes("<html><script>alert(1)</script>%PDF-1.7")],
    ["half a header", bytes("%PDF")],
    ["HTML", bytes("<!doctype html><title>x</title>")],
    ["nothing", new Uint8Array(0)],
  ])("refuses %s", (_label, data) => {
    expect(detectReceiptType(data)).toBeNull();
  });
});
