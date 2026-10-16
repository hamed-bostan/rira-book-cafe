import { describe, expect, it } from "vitest";

import { ValidationError } from "../../../errors/ValidationError";
import { validateProduct } from "../validateProduct";

import type { NewProduct } from "../../../repositories/IProductRepository";

const BASE: NewProduct = {
  kind: "food",
  name: "  Saffron cake  ",
  price: 95000,
  stockQuantity: 4,
  imageUrl: "https://example.com/cake.png",
  categoryId: "cat-1",
  isFeatured: false,
  isPublished: true,
  taxExempt: true,
};

describe("validateProduct", () => {
  it("trims the name", () => {
    expect(validateProduct(BASE).name).toBe("Saffron cake");
  });

  it("strips book details from non-books", () => {
    const result = validateProduct({ ...BASE, book: { author: "X", availability: "sale" } });
    expect(result.book).toBeUndefined();
  });

  it("rejects a book without an author", () => {
    expect(() => validateProduct({ ...BASE, kind: "book" })).toThrow(ValidationError);
  });

  it("rejects fractional prices", () => {
    expect(() => validateProduct({ ...BASE, price: 95000.5 })).toThrow(ValidationError);
  });
});
