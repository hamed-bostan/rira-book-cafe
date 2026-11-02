import { describe, expect, it } from "vitest";

import { POST as lendBook } from "@/app/api/admin/book-loans/route";
import { PUT as updateIngredient } from "@/app/api/admin/ingredients/[id]/route";
import { POST as createIngredient } from "@/app/api/admin/ingredients/route";
import { POST as ringUpSale } from "@/app/api/admin/orders/route";
import { PUT as saveRecipe } from "@/app/api/admin/recipes/[productId]/route";
import { POST as createEvent } from "@/app/api/events/route";
import { POST as createProduct } from "@/app/api/products/route";
import type { BookLoan } from "@/src/domain/entities/BookLoan";
import { MAX_EVENT_CAPACITY, type CafeEvent } from "@/src/domain/entities/CafeEvent";
import { cafeDayOf, shiftCafeDay } from "@/src/domain/entities/CafeTime";
import { MAX_ORDER_AMOUNT } from "@/src/domain/entities/Order";
import type { Ingredient } from "@/src/domain/entities/Pricing";
import { MAX_STOCK_QUANTITY, type Product } from "@/src/domain/entities/Product";
import { prisma } from "@/src/infrastructure/prisma/client";

import { jsonRequest, readError, readJson, routeParams } from "./helpers/http";
import { signInAs } from "./helpers/session";

/**
 * Amounts and counts at the edge of what their columns hold: every one either saves
 * and reads back whole, or is refused with a 400 — never a 500 from the database.
 */

/** Past the largest INTEGER (int4), 2,147,483,647. */
const PAST_INT4 = 3_000_000_000;

async function product(price: number, stockQuantity = 40): Promise<Response> {
  signInAs("admin");
  const category = await prisma.category.findUniqueOrThrow({ where: { slug: "hot-drinks" } });
  return createProduct(
    jsonRequest("POST", "/api/products", {
      kind: "drink",
      name: "Gold-leaf latte",
      categoryId: category.id,
      price: String(price),
      originalPrice: "",
      costPrice: "",
      imageUrl: "/images/seed/espresso.svg",
      stockQuantity: String(stockQuantity),
      madeToOrder: false,
      isFeatured: false,
      isPublished: true,
      badge: "",
      unit: "",
      description: "",
      nutrition: "",
      origin: "",
      dietary: [],
      taxExempt: false,
      bookAuthor: "",
      bookIsbn: "",
      bookAvailability: "sale",
      faName: "",
      faUnit: "",
      faDescription: "",
      faNutrition: "",
      faOrigin: "",
    }),
  );
}

const ingredientForm = (purchasePrice: number) => ({
  name: "Saffron",
  unit: "piece",
  purchasePrice: String(purchasePrice),
  purchaseQuantity: "1",
  isActive: true,
});

async function ingredient(purchasePrice: number): Promise<Ingredient> {
  signInAs("admin");
  const response = await createIngredient(jsonRequest("POST", "/api/admin/ingredients", ingredientForm(purchasePrice)));
  expect(response.status).toBe(201);
  return readJson<Ingredient>(response);
}

const recipe = (productId: string, ingredientId: string, quantity: string): Promise<Response> =>
  saveRecipe(
    jsonRequest("PUT", `/api/admin/recipes/${productId}`, { lines: [{ ingredientId, quantity }] }),
    routeParams({ productId }),
  );

describe("menu prices", () => {
  it("take the most an order can hold, and answer 400 one Toman past it", async () => {
    const saved = await product(MAX_ORDER_AMOUNT);
    expect(saved.status).toBe(201);
    expect((await readJson<Product>(saved)).price).toBe(MAX_ORDER_AMOUNT);

    const refused = await product(MAX_ORDER_AMOUNT + 1);
    expect(refused.status).toBe(400);
    expect((await readError(refused)).fieldErrors).toEqual({ price: "amountTooLarge" });
  });
});

describe("a stock count", () => {
  it("takes its limit, and answers 400 past it — even past INTEGER", async () => {
    const saved = await product(130_000, MAX_STOCK_QUANTITY);
    expect(saved.status).toBe(201);
    expect((await readJson<Product>(saved)).stockQuantity).toBe(MAX_STOCK_QUANTITY);

    for (const stock of [MAX_STOCK_QUANTITY + 1, PAST_INT4]) {
      const refused = await product(130_000, stock);
      expect(refused.status).toBe(400);
      expect((await readError(refused)).fieldErrors).toEqual({ stockQuantity: "stockTooLarge" });
    }
  });
});

describe("an event's capacity", () => {
  const event = (capacity: number): Promise<Response> => {
    signInAs("admin");
    const nextWeek = shiftCafeDay(cafeDayOf(new Date()), 7);
    return createEvent(
      jsonRequest("POST", "/api/events", {
        kind: "workshop",
        title: "Latte art workshop",
        description: "",
        titleFa: "",
        descriptionFa: "",
        imageUrl: "",
        startsAt: `${nextWeek}T17:00`,
        endsAt: `${nextWeek}T19:00`,
        capacity: String(capacity),
        price: "",
        isPublished: true,
      }),
    );
  };

  it("takes its limit, and answers 400 past it — even past INTEGER", async () => {
    const saved = await event(MAX_EVENT_CAPACITY);
    expect(saved.status).toBe(201);
    expect((await readJson<CafeEvent>(saved)).capacity).toBe(MAX_EVENT_CAPACITY);

    for (const capacity of [MAX_EVENT_CAPACITY + 1, PAST_INT4]) {
      const refused = await event(capacity);
      expect(refused.status).toBe(400);
      expect((await readError(refused)).fieldErrors).toEqual({ capacity: "capacityTooLarge" });
    }
  });
});

describe("an order", () => {
  it("can come to the most one holds, and is refused with a 400 past it", async () => {
    const { id } = await readJson<Product>(await product(MAX_ORDER_AMOUNT));
    const sale = (quantity: number): Promise<Response> => {
      signInAs("staff");
      return ringUpSale(
        jsonRequest("POST", "/api/admin/orders", {
          items: [{ productId: id, quantity }],
          serviceType: "takeaway",
          customerName: "Walk-in guest",
        }),
      );
    };

    const placed = await sale(1);
    expect(placed.status).toBe(201);
    expect(await readJson(placed)).toMatchObject({ subtotal: MAX_ORDER_AMOUNT, total: MAX_ORDER_AMOUNT });

    const refused = await sale(2);
    expect(refused.status).toBe(400);
    expect(await readError(refused)).toMatchObject({ code: "VALIDATION", fieldErrors: { items: expect.any(String) } });
  });
});

describe("an ingredient's price", () => {
  it("holds more than INTEGER does, and reads back whole", async () => {
    const saved = await ingredient(PAST_INT4);
    expect(saved.purchasePrice).toBe(PAST_INT4);
    expect((await prisma.ingredient.findUniqueOrThrow({ where: { id: saved.id } })).purchasePrice).toBe(
      BigInt(PAST_INT4),
    );
  });

  it("can't cost an item past what a menu price can be — 400s, and the recipe stays as it was", async () => {
    const saffron = await ingredient(MAX_ORDER_AMOUNT);
    const before = await prisma.product.findUniqueOrThrow({ where: { id: "seed-espresso" } });

    const tooMuch = await recipe("seed-espresso", saffron.id, "2");
    expect(tooMuch.status).toBe(400);
    expect((await readError(tooMuch)).fieldErrors).toHaveProperty("lines");
    const after = await prisma.product.findUniqueOrThrow({ where: { id: "seed-espresso" } });
    expect(after.costPrice).toBe(before.costPrice);
    expect(await prisma.recipeLine.count({ where: { ingredientId: saffron.id } })).toBe(0);

    expect((await recipe("seed-espresso", saffron.id, "1")).status).toBe(200);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: "seed-espresso" } })).costPrice).toBe(
      MAX_ORDER_AMOUNT,
    );

    // Raising the price now would push the item past it too.
    const raised = await updateIngredient(
      jsonRequest("PUT", `/api/admin/ingredients/${saffron.id}`, ingredientForm(MAX_ORDER_AMOUNT + 1)),
      routeParams({ id: saffron.id }),
    );
    expect(raised.status).toBe(400);
    expect((await readError(raised)).fieldErrors).toHaveProperty("purchasePrice");
  });
});

describe("a book loan's deposit", () => {
  it("holds more than INTEGER does, and reads back whole", async () => {
    signInAs("staff");
    const response = await lendBook(
      jsonRequest("POST", "/api/admin/book-loans", {
        productId: "seed-book-blind-owl",
        borrowerName: "Sara",
        borrowerPhone: "09121234567",
        dueOn: cafeDayOf(new Date()),
        depositAmount: String(PAST_INT4),
        depositMethod: "cash",
      }),
    );
    expect(response.status).toBe(201);
    expect((await readJson<BookLoan>(response)).depositAmount).toBe(PAST_INT4);
  });
});
