import { describe, expect, it } from "vitest";

import {
  canNestUnder,
  categoryAndChildren,
  inMenuOrder,
  isCategoryShown,
  shownCategories,
  type Category,
} from "../Category";
import { isOnPublicMenu } from "../Product";

type Row = Pick<Category, "id" | "parentId" | "isActive">;
const row = (id: string, parentId: string | null = null, isActive = true): Row => ({ id, parentId, isActive });

describe("isCategoryShown", () => {
  it("shows a top-level category by its own switch", () => {
    expect(isCategoryShown(row("a"), null)).toBe(true);
    expect(isCategoryShown(row("a", null, false), null)).toBe(false);
  });

  it("hides a subcategory with its parent, and when the parent can't be found", () => {
    expect(isCategoryShown(row("b", "a"), row("a"))).toBe(true);
    expect(isCategoryShown(row("b", "a"), row("a", null, false))).toBe(false);
    expect(isCategoryShown(row("b", "a"), undefined)).toBe(false);
    expect(isCategoryShown(row("b", "a", false), row("a"))).toBe(false);
  });
});

describe("isOnPublicMenu with nesting", () => {
  it("takes an item off the menu when its subcategory's parent is hidden", () => {
    const published = { isPublished: true };
    expect(isOnPublicMenu(published, { ...row("b", "a"), parent: row("a") })).toBe(true);
    expect(isOnPublicMenu(published, { ...row("b", "a"), parent: row("a", null, false) })).toBe(false);
    // A subcategory looked up without its parent reads as hidden, never shown.
    expect(isOnPublicMenu(published, row("b", "a"))).toBe(false);
    expect(isOnPublicMenu(published, row("a"))).toBe(true);
    expect(isOnPublicMenu({ isPublished: false }, row("a"))).toBe(false);
  });
});

describe("shownCategories", () => {
  it("drops hidden categories and every subcategory of a hidden parent", () => {
    const all = [row("a", null, false), row("a1", "a"), row("b"), row("b1", "b"), row("b2", "b", false)];
    expect(shownCategories(all).map((category) => category.id)).toEqual(["b", "b1"]);
  });
});

describe("canNestUnder", () => {
  const all = [row("a"), row("a1", "a"), row("b")];

  it("allows a top-level parent", () => {
    expect(canNestUnder("b", row("a"), all)).toBeNull();
    expect(canNestUnder(null, row("a"), all)).toBeNull();
  });

  it("refuses itself, a subcategory as parent, and nesting a parent", () => {
    expect(canNestUnder("a", row("a"), all)).toBe("self");
    expect(canNestUnder("b", row("a1", "a"), all)).toBe("parentIsSubcategory");
    expect(canNestUnder("a", row("b"), all)).toBe("hasSubcategories");
  });
});

describe("inMenuOrder", () => {
  it("puts each parent's subcategories straight after it, in their own order", () => {
    const sorted = [row("x1", "x"), row("x"), row("y2", "y"), row("y"), row("y1", "y")];
    // Sorted by place among siblings: x (0), y (1); y2 (0), y1 (1); x1 (0).
    const bySiblingPlace = [row("x"), row("x1", "x"), row("y2", "y"), row("y1", "y"), row("y")];
    expect(inMenuOrder(bySiblingPlace).map((category) => category.id)).toEqual(["x", "x1", "y", "y2", "y1"]);
    expect(inMenuOrder(sorted).map((category) => category.id)).toEqual(["x", "x1", "y", "y2", "y1"]);
  });

  it("keeps a subcategory whose parent is missing, at the end", () => {
    expect(inMenuOrder([row("z1", "z"), row("a")]).map((category) => category.id)).toEqual(["a", "z1"]);
  });
});

describe("categoryAndChildren", () => {
  it("is the category plus its direct subcategories", () => {
    const all = [row("a"), row("a1", "a"), row("a2", "a"), row("b")];
    expect([...categoryAndChildren("a", all)]).toEqual(["a", "a1", "a2"]);
    expect([...categoryAndChildren("b", all)]).toEqual(["b"]);
  });
});
