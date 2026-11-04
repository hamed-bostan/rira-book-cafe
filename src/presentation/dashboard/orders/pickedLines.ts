import { MAX_LINE_QUANTITY } from "@/src/domain/entities/Order";
import type { Product } from "@/src/domain/entities/Product";
import { choiceKey, optionsDelta, snapshotOptions, type OrderItemOption } from "@/src/domain/entities/ProductOptions";

/** What staff pick from: the menu as it is now, with what's left of counted items and their options. */
export type MenuPick = Pick<
  Product,
  "id" | "name" | "price" | "imageUrl" | "madeToOrder" | "stockQuantity" | "optionGroups"
>;

/**
 * One line staff are putting together at the counter or for a second round: an
 * item with its chosen options. The same item with other choices is another line.
 * The price is the menu's now, for the running total only — the server prices it.
 */
export type PickedLine = {
  /** The item and its choices (`choiceKey`). */
  key: string;
  product: MenuPick;
  choiceIds: string[];
  options: OrderItemOption[];
  /** The item's price with what its choices add, Toman — display only. */
  unitPrice: number;
  quantity: number;
  note: string;
};

/** How many of an item can be picked in all: counted items stop at what's on the shelf. */
export function maxPickQuantity(product: MenuPick): number {
  return product.madeToOrder ? MAX_LINE_QUANTITY : Math.min(product.stockQuantity, MAX_LINE_QUANTITY);
}

/** Units of an item across its lines, whatever was chosen — what its stock limit counts. */
export function pickedUnits(lines: readonly PickedLine[], productId: string): number {
  return lines.reduce((sum, line) => (line.product.id === productId ? sum + line.quantity : sum), 0);
}

/** Add one of an item with these choices: one more on its line, or a new line. */
export function addPick(
  lines: readonly PickedLine[],
  product: MenuPick,
  choiceIds: readonly string[] = [],
): PickedLine[] {
  const key = choiceKey(product.id, choiceIds);
  if (lines.some((line) => line.key === key)) {
    return lines.map((line) => (line.key === key ? { ...line, quantity: line.quantity + 1 } : line));
  }
  const options = snapshotOptions(product.optionGroups ?? [], choiceIds);
  return [
    ...lines,
    {
      key,
      product,
      choiceIds: [...choiceIds],
      options,
      unitPrice: product.price + optionsDelta(options),
      quantity: 1,
      note: "",
    },
  ];
}

/** Change a line; a quantity of 0 takes it off. */
export function updatePick(
  lines: readonly PickedLine[],
  key: string,
  change: Partial<Pick<PickedLine, "quantity" | "note">>,
): PickedLine[] {
  return lines.flatMap((line) => {
    if (line.key !== key) return [line];
    const next = { ...line, ...change };
    return next.quantity > 0 ? [next] : [];
  });
}

/** The lines as an order's `items`: ids, quantities, notes and choices — never prices. */
export function pickedItems(
  lines: readonly PickedLine[],
): { productId: string; quantity: number; note?: string; choiceIds?: string[] }[] {
  return lines.map((line) => ({
    productId: line.product.id,
    quantity: line.quantity,
    ...(line.note.trim() ? { note: line.note } : {}),
    ...(line.choiceIds.length > 0 ? { choiceIds: line.choiceIds } : {}),
  }));
}
