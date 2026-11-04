import { isCategoryShown, type MenuCategory } from "./Category";

import type { IngredientAlert } from "./Inventory";

/**
 * What a menu item is. The cafe sells drinks and food over the counter and keeps a
 * shelf of books, so one catalog holds all three — they share price, image,
 * category, stock and visibility, and only books carry the extra fields below.
 */
export const PRODUCT_KINDS = ["drink", "food", "book"] as const;
export type ProductKind = (typeof PRODUCT_KINDS)[number];

/**
 * How a book on the shelf can be used:
 * - `sale` — bought and taken home.
 * - `reading` — read in the cafe only, not for sale.
 * - `both` — either.
 */
export const BOOK_AVAILABILITIES = ["sale", "reading", "both"] as const;
export type BookAvailability = (typeof BOOK_AVAILABILITIES)[number];

/** Book-only details. Present exactly when `kind` is `"book"`. */
export type BookDetails = {
  author: string;
  /** ISBN-10 or ISBN-13, digits (and a trailing X) only. Optional — not every used book has one. */
  isbn?: string;
  availability: BookAvailability;
  /** Copies the shelf lends; absent means one, 0 once every copy is lost. */
  copies?: number;
};

/** The most copies of one book the lending shelf tracks. */
export const MAX_BOOK_COPIES = 20;

/** The most a counted item can have in stock — a typo guard, not a policy. */
export const MAX_STOCK_QUANTITY = 1_000_000;

/** Copies of a book the shelf can lend — one unless the book says otherwise. */
export function lendingCopies(book: Pick<BookDetails, "copies"> | undefined): number {
  return book?.copies ?? 1;
}

/** Copies to lend once `change` copies come off (negative) or go back on the shelf — never fewer than none, nor more than the shelf tracks. */
export function shiftLendingCopies(copies: number, change: number): number {
  return Math.min(MAX_BOOK_COPIES, Math.max(0, copies + change));
}

export type Product = {
  id: string;
  kind: ProductKind;
  name: string;
  /** Selling price in Toman (whole units). */
  price: number;
  /** Pre-discount price in Toman, when the item is on offer. */
  originalPrice?: number;
  /**
   * What one unit costs the cafe, in Toman — ingredients for a drink, the purchase
   * price of a book. Optional; when set, every sale also books its cost of sales,
   * which is what gross margins are made of. Never shown to guests.
   */
  costPrice?: number;
  discountPercent?: number;
  rating: number;
  ratingCount: number;
  /**
   * Units on hand. 0 = sold out; the storefront blocks ordering it. Meaningless for
   * a {@link Product.madeToOrder} item, which keeps whatever it last held.
   */
  stockQuantity: number;
  /**
   * Made when ordered — a drink, a breakfast plate — rather than taken off a shelf.
   * Never counted: ordering neither checks nor takes `stockQuantity`, it never sells
   * out by count, and the dashboard warns from its recipe's ingredients instead.
   */
  madeToOrder: boolean;
  imageUrl: string;
  categoryId: string;
  isFeatured: boolean;
  /**
   * Whether the public site may show it. `false` takes the item off the menu without
   * touching the order lines that already reference it — the difference between
   * withdrawing an item and deleting one. Orthogonal to {@link Product.isFeatured}.
   * Its category being hidden takes it off too — see {@link isOnPublicMenu}.
   */
  isPublished: boolean;
  badge?: string;
  /** Gallery shots for the detail carousel. Falls back to `[imageUrl]` when omitted. */
  images?: string[];
  /** Size/measure shown under the name, e.g. "350 ml" or "Paperback, 220 pages". */
  unit?: string;
  /** Detail copy. */
  description?: string;
  /** Nutrition / allergen copy (drinks and food). */
  nutrition?: string;
  /** Origin copy, e.g. a coffee's farm and process. */
  origin?: string;
  /** Dietary tags the item satisfies (see `DIETARY_TAGS`). */
  dietary?: string[];
  /** Whether this item is exempt from VAT. An operator opts an item *in* to taxation. */
  taxExempt: boolean;
  /** Book-only details; `undefined` for drinks and food. */
  book?: BookDetails;
  /**
   * A book whose copies Inventory counts (see {@link isHeldInInventory}): its
   * `stockQuantity` moves only with stock movements and orders, never from the
   * item's form. Set by the dashboard's single-item read (`getById`); absent
   * elsewhere.
   */
  inventoryTracked?: boolean;
};

/**
 * Whether Inventory counts an item's units: a book off the shelf (not made to order)
 * whose recipe is a single stock item — the one-copy recipe "Track books" gives it.
 * Every movement of that stock item moves the book's sale stock with it, so there
 * is one count of its copies, and the item's form can't set a second one.
 */
export function isHeldInInventory(
  item: Pick<Product, "kind" | "madeToOrder">,
  recipe: readonly { quantity: number }[],
): boolean {
  return item.kind === "book" && !item.madeToOrder && recipe.length === 1 && recipe[0].quantity > 0;
}

/**
 * One row of the dashboard's menu list: the item, plus — for a made-to-order item
 * whose recipe has an ingredient out or running low — the one that most needs
 * attention. Absent for counted items and for made-to-order items that are fine.
 */
export type ProductListItem = Product & { ingredientAlert?: IngredientAlert };

/**
 * The product as guests may see it: without its cost price, which is the cafe's
 * business (margins) and only ever returned by the dashboard's endpoints.
 */
export function withoutCost(product: Product): Product {
  const { costPrice: _costPrice, ...rest } = product;
  return rest;
}

/** True for items that can be sold to take home — everything except a reading-only book. */
export function isSellable(product: Pick<Product, "kind" | "book">): boolean {
  return product.kind !== "book" || product.book?.availability !== "reading";
}

/**
 * Whether an item is on the public menu: published, in a category that's shown.
 * Hiding a category hides everything in it — guests can't see, open, order or
 * review those items — while each item keeps its own switch for when the category
 * comes back. Hiding a parent category hides its subcategories' items too (see
 * `isCategoryShown`): a subcategory must arrive with its `parent` attached, or
 * it reads as hidden. An item whose category can't be found isn't on the menu either.
 *
 * The one rule every public path applies: the menu, featured and search reads, an
 * item's own page, placing and pricing an order, and writing a review. Staff
 * selling at the counter (or adding to an order) follow it too: their picker is
 * the public menu, so an item hidden from guests is hidden there as well, exactly
 * as an unpublished one always was. Lending and holding books is not a sale, so a
 * book on the shelf can still be lent while its category is hidden.
 */
export function isOnPublicMenu(
  product: Pick<Product, "isPublished">,
  category: MenuCategory | null | undefined,
): boolean {
  return product.isPublished && category != null && isCategoryShown(category, category.parent);
}
