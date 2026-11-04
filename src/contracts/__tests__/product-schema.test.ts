import { describe, expect, it } from "vitest";

import { MAX_ORDER_AMOUNT } from "@/src/domain/entities/Order";
import { MAX_STOCK_QUANTITY } from "@/src/domain/entities/Product";

import { productFormSchema, type ProductFormInput } from "../product-schema";

import { messagesAt } from "./zod-issues";

const BASE: ProductFormInput = {
  kind: "drink",
  name: "Iced Spanish Latte",
  categoryId: "cat-1",
  price: "185000",
  originalPrice: "",
  costPrice: "",
  imageUrl: "https://example.supabase.co/storage/v1/object/public/images/latte.png",
  stockQuantity: "12",
  madeToOrder: false,
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
  bookCopies: "",
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

  it("requires a whole-number stock for a counted item", () => {
    const messages = (stockQuantity: string) =>
      productFormSchema.safeParse({ ...BASE, stockQuantity }).error?.issues.map((issue) => issue.message);
    expect(messages("")).toEqual(["stockRequired"]);
    expect(messages("2.5")).toEqual(["stockWhole"]);
    expect(productFormSchema.parse(BASE).stockQuantity).toBe(12);
  });

  it("caps the stock count", () => {
    expect(productFormSchema.parse({ ...BASE, stockQuantity: String(MAX_STOCK_QUANTITY) }).stockQuantity).toBe(
      MAX_STOCK_QUANTITY,
    );
    const result = productFormSchema.safeParse({ ...BASE, stockQuantity: String(MAX_STOCK_QUANTITY + 1) });
    expect(messagesAt(result, "stockQuantity")).toEqual(["stockTooLarge"]);
  });

  it("ignores the stock of a made-to-order item, so saving leaves the stored count", () => {
    for (const stockQuantity of ["", "abc", "12"]) {
      const parsed = productFormSchema.parse({ ...BASE, madeToOrder: true, stockQuantity });
      expect(parsed.madeToOrder).toBe(true);
      expect(parsed.stockQuantity).toBeUndefined();
    }
  });

  it("only accepts whole-Toman prices", () => {
    expect(productFormSchema.safeParse({ ...BASE, price: "185000.5" }).success).toBe(false);
    expect(productFormSchema.parse(BASE).price).toBe(185000);
  });

  it("caps every price at what an order can hold", () => {
    const top = String(MAX_ORDER_AMOUNT);
    const over = String(MAX_ORDER_AMOUNT + 1);
    expect(productFormSchema.parse({ ...BASE, price: top, costPrice: top })).toMatchObject({
      price: MAX_ORDER_AMOUNT,
      costPrice: MAX_ORDER_AMOUNT,
    });
    for (const field of ["price", "originalPrice", "costPrice"]) {
      expect(messagesAt(productFormSchema.safeParse({ ...BASE, [field]: over }), field)).toEqual(["amountTooLarge"]);
    }
  });
});

describe("productFormSchema options", () => {
  type GroupInput = NonNullable<ProductFormInput["optionGroups"]>[number];
  const choice = (name: string, priceDelta = "", extra: Partial<GroupInput["choices"][number]> = {}) => ({
    name,
    nameFa: "",
    priceDelta,
    isAvailable: true,
    isDefault: false,
    ...extra,
  });
  const group = (overrides: Partial<GroupInput> = {}): GroupInput => ({
    name: "Size",
    nameFa: "اندازه",
    required: true,
    selection: "single",
    minChoices: "",
    maxChoices: "",
    choices: [choice("Small"), choice("Large", "20000", { isDefault: true })],
    ...overrides,
  });

  it("leaves the groups alone when the request has none, and parses the form's strings", () => {
    expect(productFormSchema.parse(BASE).optionGroups).toBeUndefined();
    const [size] = productFormSchema.parse({ ...BASE, optionGroups: [group()] }).optionGroups ?? [];
    expect(size).toMatchObject({ name: "Size", nameFa: "اندازه", required: true, minChoices: 1, maxChoices: 1 });
    expect(size.choices.map((c) => [c.name, c.priceDelta, c.isDefault, c.nameFa])).toEqual([
      ["Small", 0, false, undefined],
      ["Large", 20000, true, undefined],
    ]);
  });

  it("drops a book's groups and a default where it means nothing", () => {
    expect(
      productFormSchema.parse({ ...BASE, kind: "book", bookAuthor: "Hedayat", optionGroups: [group()] }).optionGroups,
    ).toEqual([]);
    const [optional] =
      productFormSchema.parse({ ...BASE, optionGroups: [group({ required: false })] }).optionGroups ?? [];
    expect(optional.choices[1].isDefault).toBe(false);
  });

  it("refuses names, prices and bounds that can't be ordered from", () => {
    const parse = (g: GroupInput) => productFormSchema.safeParse({ ...BASE, optionGroups: [g] });
    expect(messagesAt(parse(group({ name: " " })), "optionGroups.0.name")).toEqual(["optionNameRequired"]);
    expect(messagesAt(parse(group({ choices: [] })), "optionGroups.0.choices")).toEqual(["optionChoicesRequired"]);
    expect(messagesAt(parse(group({ choices: [choice("A", "-5")] })), "optionGroups.0.choices.0.priceDelta")).toEqual([
      "priceInvalid",
    ]);
    expect(
      messagesAt(parse(group({ choices: [choice("Oat"), choice("oat")] })), "optionGroups.0.choices.1.name"),
    ).toEqual(["optionChoiceDuplicate"]);
    expect(
      messagesAt(
        parse(group({ choices: [choice("A", "", { isDefault: true }), choice("B", "", { isDefault: true })] })),
        "optionGroups.0.choices",
      ),
    ).toEqual(["optionDefaultOne"]);
    const extras = (overrides: Partial<GroupInput>) =>
      group({ selection: "multiple", choices: [choice("Shot"), choice("Oat")], ...overrides });
    expect(messagesAt(parse(extras({ maxChoices: "3" })), "optionGroups.0.maxChoices")).toEqual(["optionMaxInvalid"]);
    expect(messagesAt(parse(extras({ minChoices: "2", maxChoices: "1" })), "optionGroups.0.minChoices")).toEqual([
      "optionMinInvalid",
    ]);
    const [parsed] =
      productFormSchema.parse({ ...BASE, optionGroups: [extras({ maxChoices: "2" })] }).optionGroups ?? [];
    expect(parsed).toMatchObject({ selection: "multiple", minChoices: 1, maxChoices: 2 });
  });
});
