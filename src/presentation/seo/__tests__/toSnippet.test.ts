import { describe, expect, it } from "vitest";

import { toSnippet } from "../toSnippet";

describe("toSnippet", () => {
  it("collapses whitespace and keeps short copy whole", () => {
    expect(toSnippet("  Single origin\n\n espresso  ")).toBe("Single origin espresso");
  });

  it("cuts long copy on a word boundary under 160 characters", () => {
    const snippet = toSnippet("word ".repeat(60));
    expect(snippet.length).toBeLessThanOrEqual(160);
    expect(snippet.endsWith("word…")).toBe(true);
  });

  it("hard-cuts a long run with no spaces", () => {
    const snippet = toSnippet("x".repeat(400));
    expect(snippet).toHaveLength(160);
    expect(snippet.endsWith("…")).toBe(true);
  });
});
