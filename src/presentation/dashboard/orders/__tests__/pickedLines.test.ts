import { describe, expect, it } from "vitest";

import { MAX_LINE_QUANTITY } from "@/src/domain/entities/Order";

import { addPick, maxPickQuantity, pickedItems, pickedUnits, updatePick, type MenuPick } from "../pickedLines";

const LATTE: MenuPick = {
  id: "latte",
  name: "Latte",
  price: 100000,
  imageUrl: "/latte.png",
  madeToOrder: true,
  stockQuantity: 0,
  optionGroups: [
    {
      id: "size",
      name: "Size",
      required: true,
      selection: "single",
      minChoices: 1,
      maxChoices: 1,
      choices: [
        { id: "s", name: "Small", priceDelta: 0, isAvailable: true, isDefault: true },
        { id: "l", name: "Large", priceDelta: 20000, isAvailable: true, isDefault: false },
      ],
    },
  ],
};

const CAKE: MenuPick = {
  id: "cake",
  name: "Cake",
  price: 90000,
  imageUrl: "/cake.png",
  madeToOrder: false,
  stockQuantity: 3,
};

describe("picked lines", () => {
  it("keeps an item with other choices on its own line, priced with what they add", () => {
    let lines = addPick([], LATTE, ["l"]);
    lines = addPick(lines, LATTE, ["s"]);
    lines = addPick(lines, LATTE, ["l"]);
    lines = addPick(lines, CAKE);
    expect(lines.map((line) => [line.choiceIds, line.quantity, line.unitPrice])).toEqual([
      [["l"], 2, 120000],
      [["s"], 1, 100000],
      [[], 1, 90000],
    ]);
    expect(lines[0].options.map((option) => option.choice)).toEqual(["Large"]);
    expect(pickedUnits(lines, "latte")).toBe(3);
  });

  it("sends ids, quantities, notes and choices — never prices", () => {
    let lines = addPick(addPick([], LATTE, ["l"]), CAKE);
    lines = updatePick(lines, lines[1].key, { note: "warm" });
    expect(pickedItems(lines)).toEqual([
      { productId: "latte", quantity: 1, choiceIds: ["l"] },
      { productId: "cake", quantity: 1, note: "warm" },
    ]);
    expect(updatePick(lines, lines[0].key, { quantity: 0 })).toHaveLength(1);
  });

  it("stops a counted item at what's on the shelf", () => {
    expect(maxPickQuantity(CAKE)).toBe(3);
    expect(maxPickQuantity(LATTE)).toBe(MAX_LINE_QUANTITY);
  });
});
