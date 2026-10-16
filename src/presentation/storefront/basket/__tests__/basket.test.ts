import { describe, expect, it } from "vitest";

import { MAX_ORDER_LINES } from "@/src/contracts/order-schema";
import { MAX_LINE_QUANTITY } from "@/src/domain/entities/Order";

import {
  EMPTY_BASKET,
  addToBasket,
  basketCount,
  basketToOrderItems,
  basketTotal,
  parseStoredBasket,
  setLineQuantity,
  type BasketLine,
} from "../basket";

const LATTE: BasketLine = {
  productId: "latte",
  name: "Latte",
  imageUrl: "https://example.com/latte.png",
  kind: "drink",
  unitPrice: 150000,
  quantity: 1,
};

describe("basket", () => {
  it("merges the same item with the same request, and keeps different requests apart", () => {
    let basket = addToBasket(EMPTY_BASKET, LATTE);
    basket = addToBasket(basket, { ...LATTE, quantity: 2 });
    basket = addToBasket(basket, { ...LATTE, note: "  oat milk " });
    expect(basket.lines).toHaveLength(2);
    expect(basket.lines[0].quantity).toBe(3);
    expect(basket.lines[1].note).toBe("oat milk");
    expect(basketCount(basket)).toBe(4);
    expect(basketTotal(basket)).toBe(600000);
  });

  it("caps quantities and removes a line set to zero", () => {
    let basket = addToBasket(EMPTY_BASKET, { ...LATTE, quantity: MAX_LINE_QUANTITY + 10 });
    expect(basket.lines[0].quantity).toBe(MAX_LINE_QUANTITY);
    basket = setLineQuantity(basket, 0, 0);
    expect(basket.lines).toHaveLength(0);
  });

  it("stops at the most lines one order may hold", () => {
    let basket = EMPTY_BASKET;
    for (let i = 0; i < MAX_ORDER_LINES + 3; i++) basket = addToBasket(basket, { ...LATTE, productId: `p${i}` });
    expect(basket.lines).toHaveLength(MAX_ORDER_LINES);
  });

  it("sends ids, quantities and notes — never prices", () => {
    const basket = addToBasket(EMPTY_BASKET, { ...LATTE, note: "hot" });
    expect(basketToOrderItems(basket)).toEqual([{ productId: "latte", quantity: 1, note: "hot" }]);
  });

  it("reads stored baskets defensively", () => {
    expect(parseStoredBasket(null)).toEqual(EMPTY_BASKET);
    expect(parseStoredBasket("not json")).toEqual(EMPTY_BASKET);
    expect(parseStoredBasket(JSON.stringify({ lines: [{ productId: 1 }, LATTE, { ...LATTE, quantity: 0 }] })).lines).toEqual([LATTE]);
  });
});
