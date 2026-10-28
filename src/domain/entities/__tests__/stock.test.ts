import { describe, expect, it } from "vitest";

import { ingredientAlertFor } from "../Inventory";
import { MAX_LINE_QUANTITY } from "../Order";
import { getStockStatus, isSoldOut, LOW_STOCK_THRESHOLD, maxLineQuantity } from "../stock";

const counted = (stockQuantity: number) => ({ stockQuantity, madeToOrder: false });
const madeToOrder = (stockQuantity: number) => ({ stockQuantity, madeToOrder: true });

describe("getStockStatus", () => {
  it.each<[number, ReturnType<typeof getStockStatus>]>([
    [0, { level: "out" }],
    [-3, { level: "out" }],
    [Number.NaN, { level: "out" }],
    [1, { level: "low", quantity: 1 }],
    [LOW_STOCK_THRESHOLD, { level: "low", quantity: LOW_STOCK_THRESHOLD }],
    [LOW_STOCK_THRESHOLD + 1, { level: "in", quantity: LOW_STOCK_THRESHOLD + 1 }],
  ])("classifies %s units of a counted item", (quantity, expected) => {
    expect(getStockStatus(counted(quantity))).toEqual(expected);
  });

  it.each([0, -3, 1, 976])("never calls a made-to-order item out or low by count (%s)", (quantity) => {
    expect(getStockStatus(madeToOrder(quantity))).toEqual({ level: "madeToOrder" });
  });
});

describe("isSoldOut", () => {
  it("is a counted item with nothing on hand", () => {
    expect(isSoldOut(counted(0))).toBe(true);
    expect(isSoldOut(counted(1))).toBe(false);
  });

  it("is never a made-to-order item", () => {
    expect(isSoldOut(madeToOrder(0))).toBe(false);
  });
});

describe("maxLineQuantity", () => {
  it("caps a counted item at what's on hand, but at least one", () => {
    expect(maxLineQuantity(counted(3))).toBe(3);
    expect(maxLineQuantity(counted(0))).toBe(1);
    expect(maxLineQuantity(counted(MAX_LINE_QUANTITY + 100))).toBe(MAX_LINE_QUANTITY);
  });

  it("gives a made-to-order item the full line maximum", () => {
    expect(maxLineQuantity(madeToOrder(0))).toBe(MAX_LINE_QUANTITY);
    expect(maxLineQuantity(madeToOrder(2))).toBe(MAX_LINE_QUANTITY);
  });
});

describe("ingredientAlertFor", () => {
  const ok = { name: "Espresso beans", onHand: 6000, reorderLevel: 2000 };

  it("is nothing when every ingredient is fine, or there's no recipe", () => {
    expect(ingredientAlertFor([ok, { name: "Sugar", onHand: 10 }])).toBeUndefined();
    expect(ingredientAlertFor([])).toBeUndefined();
  });

  it("warns at or below the reorder level, and only with one set", () => {
    expect(ingredientAlertFor([ok, { name: "Oat milk", onHand: 2000, reorderLevel: 2000 }])).toEqual({
      level: "low",
      ingredient: "Oat milk",
    });
    expect(ingredientAlertFor([{ name: "Sugar", onHand: 1 }])).toBeUndefined();
  });

  it("calls an ingredient at zero or below out", () => {
    expect(ingredientAlertFor([{ name: "Peach syrup", onHand: -0.5, reorderLevel: 100 }])).toEqual({
      level: "out",
      ingredient: "Peach syrup",
    });
  });

  it("names the worst ingredient — out beats low — then the first by name", () => {
    const milk = { name: "Milk", onHand: 8000, reorderLevel: 10_000 };
    const saffron = { name: "Saffron", onHand: 2, reorderLevel: 4 };
    const mint = { name: "Mint", onHand: 0, reorderLevel: 100 };
    const cups = { name: "Cups", onHand: 0, reorderLevel: 50 };

    expect(ingredientAlertFor([saffron, milk])).toEqual({ level: "low", ingredient: "Milk" });
    expect(ingredientAlertFor([milk, mint, saffron])).toEqual({ level: "out", ingredient: "Mint" });
    expect(ingredientAlertFor([mint, milk, cups])).toEqual({ level: "out", ingredient: "Cups" });
  });
});
