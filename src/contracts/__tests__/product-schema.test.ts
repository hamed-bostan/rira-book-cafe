import { describe, expect, it } from "vitest";

import { productFormSchema, type ProductFormInput } from "../product-schema";

const BASE: ProductFormInput = {
  kind: "drink",
  name: "Iced Spanish Latte",
  categoryId: "cat-1",
  price: "185000",
  originalPrice: "",
  imageUrl: "https://example.supabase.co/storage/v1/object/public/images/latte.png",
  stockQuantity: "12",
  isFeatured: false,
  isPublished: true,
  badge: "",
  unit: "",
  description: "",
  nutrition: "",
  origin: "",
  dietary: [],
  taxExempt: true,
  bookAuthor: "",
  bookIsbn: "",
  bookAvailability: "sale",
  faName: "",
  faUnit: "",
  faDescription: "",
  faNutrition: "",
  faOrigin: "",
};

describe("productFormSchema", () => {
  it("drops book details for drinks even when the form still holds them", () => {
    const parsed = productFormSchema.parse({ ...BASE, bookAuthor: "Hedayat" });
    expect(parsed.book).toBeUndefined();
  });

  it("requires an author for books", () => {
    const result = productFormSchema.safeParse({ ...BASE, kind: "book" });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain("authorRequired");
  });

  it("normalizes the ISBN and carries book details for books", () => {
    const parsed = productFormSchema.parse({
      ...BASE,
      kind: "book",
      bookAuthor: "Sadegh Hedayat",
      bookIsbn: "978-964-351-118-0",
      bookAvailability: "reading",
    });
    expect(parsed.book).toEqual({ author: "Sadegh Hedayat", isbn: "9789643511180", availability: "reading" });
  });

  it("rejects a malformed ISBN", () => {
    const result = productFormSchema.safeParse({ ...BASE, kind: "book", bookAuthor: "A", bookIsbn: "12345" });
    expect(result.error?.issues.map((issue) => issue.message)).toContain("isbnInvalid");
  });

  it("only accepts whole-Toman prices", () => {
    expect(productFormSchema.safeParse({ ...BASE, price: "185000.5" }).success).toBe(false);
    expect(productFormSchema.parse(BASE).price).toBe(185000);
  });
});
