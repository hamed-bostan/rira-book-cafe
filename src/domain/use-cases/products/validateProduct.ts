import { MAX_ORDER_AMOUNT } from "../../entities/Order";
import { MAX_STOCK_QUANTITY, PRODUCT_KINDS } from "../../entities/Product";
import { normalizeOptionGroups, optionGroupsProblem } from "../../entities/ProductOptions";
import { ValidationError } from "../../errors/ValidationError";

import type { NewProduct } from "../../repositories/IProductRepository";

/**
 * Last-resort domain guard behind the route's schema validation, so a direct
 * caller (seed script, importer) still can't bypass the invariants. Shared by
 * `CreateProduct` and `UpdateProduct` so both enforce the same rules.
 *
 * Returns the input with its name trimmed, and its option groups tidied (see
 * `normalizeOptionGroups`) — a book has none: its groups are dropped like a
 * drink's book details.
 */
export function validateProduct(input: NewProduct): NewProduct {
  const name = input.name.trim();
  if (!name) throw new ValidationError("name", "Name is required.");
  if (!PRODUCT_KINDS.includes(input.kind)) throw new ValidationError("kind", "Choose drink, food or book.");
  if (!input.categoryId) throw new ValidationError("categoryId", "Choose a category.");
  if (!Number.isInteger(input.price) || input.price <= 0) {
    throw new ValidationError("price", "Price must be a whole number greater than 0.");
  }
  if (input.originalPrice != null && input.originalPrice <= input.price) {
    throw new ValidationError("originalPrice", "Original price must be higher than the price.");
  }
  for (const field of ["price", "originalPrice", "costPrice"] as const) {
    const amount = input[field];
    if (amount != null && amount > MAX_ORDER_AMOUNT) throw new ValidationError(field, "That price is too large.");
  }
  if (!input.imageUrl) throw new ValidationError("imageUrl", "An image is required.");
  // A made-to-order item isn't counted, so it may leave its count out; a count
  // that is given must still be a real one.
  if (input.stockQuantity === undefined && !input.madeToOrder) {
    throw new ValidationError("stockQuantity", "A counted item needs its stock.");
  }
  if (input.stockQuantity !== undefined && (!Number.isInteger(input.stockQuantity) || input.stockQuantity < 0)) {
    throw new ValidationError("stockQuantity", "Stock must be a whole number of 0 or more.");
  }
  if (input.stockQuantity !== undefined && input.stockQuantity > MAX_STOCK_QUANTITY) {
    throw new ValidationError("stockQuantity", `Stock can be at most ${MAX_STOCK_QUANTITY}.`);
  }
  if (input.kind === "book" && !input.book?.author.trim()) {
    throw new ValidationError("bookAuthor", "A book needs an author.");
  }

  // Options belong to drinks and food; a book saved with a list has it cleared.
  const optionGroups =
    input.optionGroups === undefined
      ? undefined
      : input.kind === "book"
        ? []
        : normalizeOptionGroups(input.optionGroups);
  const optionProblem = optionGroups ? optionGroupsProblem(optionGroups) : null;
  if (optionProblem) throw new ValidationError("optionGroups", optionProblem);
  if (optionGroups?.some((group) => group.choices.some((choice) => choice.priceDelta > MAX_ORDER_AMOUNT))) {
    throw new ValidationError("optionGroups", "amountTooLarge");
  }

  // Book details belong to books only; drop them for drinks and food.
  return {
    ...input,
    name,
    book: input.kind === "book" ? input.book : undefined,
    ...(optionGroups !== undefined ? { optionGroups } : {}),
  };
}
