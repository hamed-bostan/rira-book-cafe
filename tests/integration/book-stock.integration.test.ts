import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { POST as voidExpense } from "@/app/api/admin/expenses/[id]/void/route";
import { POST as trackBooks } from "@/app/api/admin/inventory/books/route";
import { POST as countStock } from "@/app/api/admin/inventory/counts/route";
import { POST as recordOpening } from "@/app/api/admin/inventory/opening/route";
import { POST as receiveStock } from "@/app/api/admin/inventory/receipts/route";
import { POST as recordWaste } from "@/app/api/admin/inventory/waste/route";
import { PATCH as changeStatus } from "@/app/api/admin/orders/[id]/status/route";
import { POST as ringUpSale } from "@/app/api/admin/orders/route";
import { GET as getAdminProduct } from "@/app/api/admin/products/[id]/route";
import { PUT as updateProduct } from "@/app/api/products/[id]/route";
import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import type { Expense } from "@/src/domain/entities/Expense";
import type { Order } from "@/src/domain/entities/Order";
import type { Product } from "@/src/domain/entities/Product";
import { prisma } from "@/src/infrastructure/prisma/client";

import { getRequest, jsonRequest, readJson, routeParams } from "./helpers/http";
import { signInAs } from "./helpers/session";

/**
 * A tracked book keeps one count of its copies: its stock item. Every stock
 * movement moves the book's sale stock with it, the item's form can't set a
 * second one, and the migration brings books that drifted back together.
 */

const today = cafeDayOf(new Date());
const BOOK = "seed-book-blind-owl";
const COPY = "seed-ing-book-blind-owl";

/** The book's sale stock and its stock item's copies on hand. */
async function counts(productId = BOOK, ingredientId = COPY): Promise<{ shelf: number; onHand: number }> {
  const [product, item] = await Promise.all([
    prisma.product.findUniqueOrThrow({ where: { id: productId } }),
    prisma.ingredient.findUniqueOrThrow({ where: { id: ingredientId } }),
  ]);
  return { shelf: product.stockQuantity, onHand: item.onHand };
}

async function ringUp(productId: string, quantity: number): Promise<Order> {
  signInAs("staff");
  const response = await ringUpSale(
    jsonRequest("POST", "/api/admin/orders", {
      items: [{ productId, quantity }],
      serviceType: "takeaway",
      customerPhone: "0912 555 0120",
      customerName: "Shelf Guest",
    }),
  );
  expect(response.status).toBe(201);
  return readJson<Order>(response);
}

async function complete(order: Order): Promise<void> {
  signInAs("staff");
  for (const status of ["preparing", "completed"]) {
    const response = await changeStatus(
      jsonRequest("PATCH", `/api/admin/orders/${order.id}/status`, { status }),
      routeParams({ id: order.id }),
    );
    expect(response.status).toBe(200);
  }
}

/** A book for sale with no stock item behind it yet. */
async function untrackedBook(stockQuantity: number): Promise<string> {
  const template = await prisma.product.findUniqueOrThrow({ where: { id: BOOK } });
  const book = await prisma.product.create({
    data: {
      kind: "book",
      name: "The Colonel",
      price: 300_000,
      costPrice: 200_000,
      stockQuantity,
      imageUrl: template.imageUrl,
      categoryId: template.categoryId,
      taxExempt: true,
      bookAuthor: "Mahmoud Dowlatabadi",
      bookAvailability: "sale",
    },
  });
  return book.id;
}

describe("a tracked book's copies", () => {
  it("move with a delivery, a count, waste and a voided delivery — lending copies don't", async () => {
    await prisma.product.update({ where: { id: BOOK }, data: { bookCopies: 3 } });
    expect(await counts()).toEqual({ shelf: 6, onHand: 6 });
    signInAs("admin");

    const received = await receiveStock(
      jsonRequest("POST", "/api/admin/inventory/receipts", {
        date: today,
        supplierId: "",
        description: "Reprint",
        lines: [{ ingredientId: COPY, quantity: "3", cost: "546000" }],
        vatAmount: "",
        payment: "cash",
      }),
    );
    expect(received.status).toBe(201);
    const delivery = await readJson<Expense>(received);
    expect(await counts()).toEqual({ shelf: 9, onHand: 9 });

    const counted = await countStock(
      jsonRequest("POST", "/api/admin/inventory/counts", {
        date: today,
        lines: [{ ingredientId: COPY, counted: "7" }],
        note: "",
      }),
    );
    expect(counted.status).toBe(201);
    expect(await counts()).toEqual({ shelf: 7, onHand: 7 });

    const wasted = await recordWaste(
      jsonRequest("POST", "/api/admin/inventory/waste", { date: today, ingredientId: COPY, quantity: "1", note: "" }),
    );
    expect(wasted.status).toBe(201);
    expect(await counts()).toEqual({ shelf: 6, onHand: 6 });

    const voided = await voidExpense(
      jsonRequest("POST", `/api/admin/expenses/${delivery.id}/void`, { reason: "Wrong invoice" }),
      routeParams({ id: delivery.id }),
    );
    expect(voided.status).toBe(200);
    expect(await counts()).toEqual({ shelf: 3, onHand: 3 });

    // The lending shelf is its own count.
    expect((await prisma.product.findUniqueOrThrow({ where: { id: BOOK } })).bookCopies).toBe(3);
  });

  it("leave a sold copy off both counts once the order is completed", async () => {
    const order = await ringUp(BOOK, 2);
    // Placed: off the sale stock, still on the shelf.
    expect(await counts()).toEqual({ shelf: 4, onHand: 6 });
    await complete(order);
    expect(await counts()).toEqual({ shelf: 4, onHand: 4 });
  });

  it("can't be set from the book's form, which says Inventory counts them", async () => {
    signInAs("admin");
    const read = await getAdminProduct(getRequest(`/api/admin/products/${BOOK}`), routeParams({ id: BOOK }));
    expect(await readJson<Product>(read)).toMatchObject({ inventoryTracked: true, stockQuantity: 6 });

    const row = await prisma.product.findUniqueOrThrow({ where: { id: BOOK } });
    const form = {
      kind: "book",
      name: "The Blind Owl (new edition)",
      categoryId: row.categoryId,
      price: String(row.price),
      originalPrice: "",
      costPrice: "",
      imageUrl: row.imageUrl,
      stockQuantity: "99",
      madeToOrder: false,
      isFeatured: row.isFeatured,
      isPublished: true,
      badge: "",
      unit: "",
      description: "",
      nutrition: "",
      origin: "",
      dietary: [],
      taxExempt: true,
      bookAuthor: "Sadegh Hedayat",
      bookIsbn: "",
      bookAvailability: "both",
      bookCopies: "",
      faName: "",
      faUnit: "",
      faDescription: "",
      faNutrition: "",
      faOrigin: "",
    };
    const saved = await updateProduct(jsonRequest("PUT", `/api/products/${BOOK}`, form), routeParams({ id: BOOK }));
    expect(saved.status).toBe(200);
    expect(await prisma.product.findUniqueOrThrow({ where: { id: BOOK } })).toMatchObject({
      name: "The Blind Owl (new edition)",
      stockQuantity: 6,
    });

    // Without a stock item behind it, the form sets the stock as before.
    await prisma.recipeLine.deleteMany({ where: { productId: BOOK } });
    const untracked = await updateProduct(jsonRequest("PUT", `/api/products/${BOOK}`, form), routeParams({ id: BOOK }));
    expect(untracked.status).toBe(200);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: BOOK } })).stockQuantity).toBe(99);
  });

  it("come into stock with the copies open orders still hold when the book is tracked", async () => {
    const id = await untrackedBook(5);
    const order = await ringUp(id, 2);
    expect((await prisma.product.findUniqueOrThrow({ where: { id } })).stockQuantity).toBe(3);

    signInAs("admin");
    expect((await trackBooks(jsonRequest("POST", "/api/admin/inventory/books", {}))).status).toBe(201);
    const { ingredientId } = await prisma.recipeLine.findFirstOrThrow({ where: { productId: id } });
    expect(await counts(id, ingredientId)).toEqual({ shelf: 3, onHand: 5 });

    await complete(order);
    expect(await counts(id, ingredientId)).toEqual({ shelf: 3, onHand: 3 });
  });

  it("come onto the menu with opening stock recorded after the book was tracked empty", async () => {
    const id = await untrackedBook(0);
    signInAs("admin");
    expect((await trackBooks(jsonRequest("POST", "/api/admin/inventory/books", {}))).status).toBe(201);
    const { ingredientId } = await prisma.recipeLine.findFirstOrThrow({ where: { productId: id } });

    const opened = await recordOpening(
      jsonRequest("POST", "/api/admin/inventory/opening", {
        date: today,
        lines: [{ ingredientId, quantity: "4", cost: "800000" }],
      }),
    );
    expect(opened.status).toBe(201);
    expect(await counts(id, ingredientId)).toEqual({ shelf: 4, onHand: 4 });
  });
});

describe("the book stock migration", () => {
  const MIGRATION = readFileSync(
    join(process.cwd(), "prisma/migrations/20261109010000_book_stock_follows_inventory/migration.sql"),
    "utf8",
  )
    .trim()
    // One statement; the driver takes it without the closing semicolon.
    .replace(/;$/, "");

  it("sets a tracked book's sale stock from its copies on hand, less what open orders hold", async () => {
    const NAPOLEON = "seed-book-uncle-napoleon";
    const CAKE = "seed-carrot-cake";
    await ringUp(NAPOLEON, 1);
    const before = await prisma.product.findUniqueOrThrow({ where: { id: CAKE } });
    // Drifted the old way: copies typed into the form, a delivery that only reached Inventory.
    await prisma.product.update({ where: { id: BOOK }, data: { stockQuantity: 99 } });
    await prisma.product.update({ where: { id: NAPOLEON }, data: { stockQuantity: 10 } });
    await prisma.ingredient.update({ where: { id: COPY }, data: { onHand: 8 } });

    expect(await prisma.$executeRawUnsafe(MIGRATION)).toBe(2);

    expect((await prisma.product.findUniqueOrThrow({ where: { id: BOOK } })).stockQuantity).toBe(8);
    // Four copies on the shelf, one held by the open order.
    expect((await prisma.product.findUniqueOrThrow({ where: { id: NAPOLEON } })).stockQuantity).toBe(3);
    // A cake's slices aren't a book's copies.
    expect((await prisma.product.findUniqueOrThrow({ where: { id: CAKE } })).stockQuantity).toBe(before.stockQuantity);
    // Running it again changes nothing.
    expect(await prisma.$executeRawUnsafe(MIGRATION)).toBe(0);
  });
});
