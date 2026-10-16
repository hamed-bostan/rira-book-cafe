import { describe, expect, it } from "vitest";

import en from "../../../messages/en.json";
import fa from "../../../messages/fa.json";

type MessageTree = { [key: string]: string | MessageTree };

function collectKeyPaths(tree: MessageTree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? [path] : collectKeyPaths(value, path);
  });
}

function collectEmptyPaths(tree: MessageTree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value !== "string") return collectEmptyPaths(value, path);
    return value.trim() === "" ? [path] : [];
  });
}

describe("locale key parity", () => {
  it("has the same key set in en.json and fa.json", () => {
    const enKeys = collectKeyPaths(en).sort();
    const faKeys = collectKeyPaths(fa).sort();

    const missingInFa = enKeys.filter((key) => !faKeys.includes(key));
    const missingInEn = faKeys.filter((key) => !enKeys.includes(key));

    expect(missingInFa, "keys present in en.json but missing from fa.json").toEqual([]);
    expect(missingInEn, "keys present in fa.json but missing from en.json").toEqual([]);
  });

  it("has no empty string values in en.json", () => {
    expect(collectEmptyPaths(en)).toEqual([]);
  });

  it("has no empty string values in fa.json", () => {
    expect(collectEmptyPaths(fa)).toEqual([]);
  });
});
