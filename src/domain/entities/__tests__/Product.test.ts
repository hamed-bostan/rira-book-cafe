import { describe, expect, it } from "vitest";

import { isHeldInInventory } from "../Product";

describe("isHeldInInventory", () => {
  const book = { kind: "book" as const, madeToOrder: false };

  it("holds a book whose recipe is one stock item", () => {
    expect(isHeldInInventory(book, [{ quantity: 1 }])).toBe(true);
  });

  it("leaves out a book with no recipe, or one made of several items", () => {
    expect(isHeldInInventory(book, [])).toBe(false);
    expect(isHeldInInventory(book, [{ quantity: 1 }, { quantity: 1 }])).toBe(false);
    expect(isHeldInInventory(book, [{ quantity: 0 }])).toBe(false);
  });

  it("leaves out drinks, food and anything made to order", () => {
    expect(isHeldInInventory({ kind: "food", madeToOrder: false }, [{ quantity: 1 }])).toBe(false);
    expect(isHeldInInventory({ kind: "drink", madeToOrder: true }, [{ quantity: 18 }])).toBe(false);
    expect(isHeldInInventory({ kind: "book", madeToOrder: true }, [{ quantity: 1 }])).toBe(false);
  });
});
