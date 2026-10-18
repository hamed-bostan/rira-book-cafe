import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { cn } from "@/src/lib/utils";

import { typography } from "./typography";

describe("typography accessibility contracts", () => {
  const generatedCss = readFileSync("src/styles/tokens.css", "utf8");

  for (const [group, variants] of Object.entries(typography)) {
    for (const [name, token] of Object.entries(variants)) {
      it(`${group}.${name} scales with user font preferences`, () => {
        expect(token.size).toMatch(/^\d*\.?\d+rem$/);
        expect(parseFloat(token.size)).toBeGreaterThanOrEqual(0.75);
        expect(token.lineHeight).toMatch(/^\d*\.?\d+$/);
        expect(Number(token.lineHeight)).toBeGreaterThanOrEqual(1.4);
      });

      it(`${group}.${name} survives composition with text colors`, () => {
        const tokenName = `${group}-${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
        const utility = `text-${tokenName}`;
        expect(generatedCss).toContain(`--text-${tokenName}: ${token.size};`);
        expect(cn(utility, "text-foreground")).toBe(`${utility} text-foreground`);
        expect(cn("text-foreground", utility)).toBe(`text-foreground ${utility}`);
        expect(cn("text-body-default", utility)).toBe(utility);
        expect(cn(utility, "text-sm")).toBe("text-sm");
      });
    }
  }

  it("exports descriptive styles without numbered aliases", () => {
    for (const variants of Object.values(typography)) {
      for (const name of Object.keys(variants)) {
        expect(name).not.toMatch(/^(?:h|b|btn|l)\d+$/);
      }
    }
    expect(generatedCss).not.toMatch(/--text-(?:heading-h|body-b|button-btn|label-l)\d+(?=:|--)/);
  });

  it("defines every typography utility referenced by application source", () => {
    // Tailwind silently omits unknown utilities; TypeScript cannot catch a
    // stale class name after a token rename. Check literal classes and variants.
    const known = new Set(Array.from(generatedCss.matchAll(/--(text-[a-z-]+):/g), (match) => match[1]));
    const missing: string[] = [];
    const scan = (directory: string) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
          scan(path);
        } else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith(".test.ts")) {
          for (const match of readFileSync(path, "utf8").matchAll(
            /\btext-(?:heading|body|button|label)-[a-zA-Z0-9-]+/g,
          )) {
            if (!known.has(match[0])) missing.push(`${path}: ${match[0]}`);
          }
        }
      }
    };
    scan("src");
    scan("app");
    expect(missing).toEqual([]);
  });
});
