import { MAX_LINE_QUANTITY, MAX_ORDER_LINES, MAX_ORDER_NOTE_TEXT_LENGTH } from "@/src/domain/entities/Order";
import type { Product } from "@/src/domain/entities/Product";

/**
 * The guest's basket before they order: which items, how many, and a note per
 * line. It is ephemeral UI state, not a copy of server data — nothing exists on the
 * server until the guest places the order, and the server prices every line from
 * the menu then. The price kept here is only for showing a running total.
 *
 * Pure functions, so the rules are testable without React.
 */
export type BasketLine = {
  productId: string;
  name: string;
  imageUrl: string;
  kind: Product["kind"];
  /** Price per unit when added, Toman — display only. */
  unitPrice: number;
  quantity: number;
  /** e.g. "oat milk"; the same item with different notes is two lines. */
  note?: string;
};

export type Basket = { lines: BasketLine[] };

export const EMPTY_BASKET: Basket = { lines: [] };

/** Two lines merge when they're the same item with the same request. */
function sameLine(a: Pick<BasketLine, "productId" | "note">, b: Pick<BasketLine, "productId" | "note">): boolean {
  return a.productId === b.productId && (a.note ?? "") === (b.note ?? "");
}

function clampQuantity(quantity: number): number {
  return Math.min(Math.max(Math.round(quantity), 0), MAX_LINE_QUANTITY);
}

function cleanNote(note: string | undefined): string | undefined {
  const trimmed = note?.trim().slice(0, MAX_ORDER_NOTE_TEXT_LENGTH);
  return trimmed ? trimmed : undefined;
}

/** Add an item (merging with a matching line). Ignored once the basket holds the most lines an order may. */
export function addToBasket(basket: Basket, line: BasketLine): Basket {
  const incoming = { ...line, note: cleanNote(line.note) };
  const existing = basket.lines.find((current) => sameLine(current, incoming));
  if (existing) {
    return {
      lines: basket.lines.map((current) =>
        current === existing ? { ...current, quantity: clampQuantity(current.quantity + incoming.quantity) } : current,
      ),
    };
  }
  if (basket.lines.length >= MAX_ORDER_LINES) return basket;
  const quantity = clampQuantity(incoming.quantity);
  return quantity > 0 ? { lines: [...basket.lines, { ...incoming, quantity }] } : basket;
}

/** Set a line's quantity; 0 removes it. */
export function setLineQuantity(basket: Basket, index: number, quantity: number): Basket {
  const next = clampQuantity(quantity);
  if (next === 0) return removeLine(basket, index);
  return { lines: basket.lines.map((line, i) => (i === index ? { ...line, quantity: next } : line)) };
}

export function removeLine(basket: Basket, index: number): Basket {
  return { lines: basket.lines.filter((_, i) => i !== index) };
}

export function basketCount(basket: Basket): number {
  return basket.lines.reduce((sum, line) => sum + line.quantity, 0);
}

export function basketTotal(basket: Basket): number {
  return basket.lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
}

/** What `POST /api/orders` needs from the basket: ids, quantities and notes — never prices. */
export function basketToOrderItems(basket: Basket): { productId: string; quantity: number; note?: string }[] {
  return basket.lines.map(({ productId, quantity, note }) => ({ productId, quantity, note }));
}

/** Read a stored basket defensively — anything malformed is an empty basket. */
export function parseStoredBasket(raw: string | null): Basket {
  if (!raw) return EMPTY_BASKET;
  try {
    const value = JSON.parse(raw) as { lines?: unknown };
    if (!Array.isArray(value.lines)) return EMPTY_BASKET;
    const lines = value.lines.filter(
      (line): line is BasketLine =>
        typeof line === "object" &&
        line !== null &&
        typeof (line as BasketLine).productId === "string" &&
        typeof (line as BasketLine).name === "string" &&
        typeof (line as BasketLine).unitPrice === "number" &&
        typeof (line as BasketLine).quantity === "number" &&
        (line as BasketLine).quantity > 0,
    );
    return { lines: lines.slice(0, MAX_ORDER_LINES) };
  } catch {
    return EMPTY_BASKET;
  }
}
