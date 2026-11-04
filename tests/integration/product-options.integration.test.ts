import { describe, expect, it } from "vitest";

import { PATCH as changeOrder } from "@/app/api/admin/orders/[id]/route";
import { PATCH as changeStatus } from "@/app/api/admin/orders/[id]/status/route";
import { POST as ringUpSale } from "@/app/api/admin/orders/route";
import { GET as getAdminProduct } from "@/app/api/admin/products/[id]/route";
import { GET as salesReport } from "@/app/api/admin/reports/sales/route";
import { GET as getOwnOrder } from "@/app/api/orders/[id]/route";
import { POST as quoteOrder } from "@/app/api/orders/quote/route";
import { POST as placeOrder } from "@/app/api/orders/route";
import { GET as getProduct, PUT as updateProduct } from "@/app/api/products/[id]/route";
import { GET as listProducts } from "@/app/api/products/route";
import type { SalesReport } from "@/src/domain/entities/Analytics";
import type { OrderQuote } from "@/src/domain/entities/Checkout";
import type { Order } from "@/src/domain/entities/Order";
import type { Product } from "@/src/domain/entities/Product";
import { prisma } from "@/src/infrastructure/prisma/client";

import { getRequest, jsonRequest, readError, readJson, routeParams } from "./helpers/http";
import { signInAs } from "./helpers/session";

const LATTE = "seed-espresso"; // 95,000, made to order, with a recipe (beans)
const CAKE = "seed-carrot-cake"; // counted, no options

/** Size (required, Small 0 / Large +20,000 default) and Extras (0–2: shot +15,000, oat +12,000). */
async function giveOptions(productId = LATTE): Promise<{ small: string; large: string; shot: string; oat: string }> {
  const size = await prisma.productOptionGroup.create({
    data: {
      productId,
      name: "Size",
      nameFa: "اندازه",
      required: true,
      selection: "single",
      minChoices: 1,
      maxChoices: 1,
      position: 0,
      choices: {
        create: [
          { name: "Small", nameFa: "کوچک", priceDelta: 0, position: 0 },
          { name: "Large", nameFa: "بزرگ", priceDelta: 20000, isDefault: true, position: 1 },
        ],
      },
    },
    include: { choices: true },
  });
  const extras = await prisma.productOptionGroup.create({
    data: {
      productId,
      name: "Extras",
      selection: "multiple",
      minChoices: 0,
      maxChoices: 2,
      position: 1,
      choices: {
        create: [
          { name: "Extra shot", priceDelta: 15000, position: 0 },
          { name: "Oat milk", nameFa: "شیر جو", priceDelta: 12000, position: 1 },
        ],
      },
    },
    include: { choices: true },
  });
  const byName = (name: string) => [...size.choices, ...extras.choices].find((choice) => choice.name === name)!.id;
  return { small: byName("Small"), large: byName("Large"), shot: byName("Extra shot"), oat: byName("Oat milk") };
}

async function place(items: unknown[], extra: Record<string, unknown> = {}): Promise<Response> {
  signInAs("customer");
  return placeOrder(jsonRequest("POST", "/api/orders", { items, serviceType: "takeaway", ...extra }));
}

async function moveTo(orderId: string, status: string): Promise<void> {
  signInAs("staff");
  const response = await changeStatus(
    jsonRequest("PATCH", `/api/admin/orders/${orderId}/status`, { status }),
    routeParams({ id: orderId }),
  );
  expect(response.status).toBe(200);
}

/** The item's edit form as the dashboard would send it, with these option groups. */
async function formFor(productId: string, optionGroups: unknown[]): Promise<Record<string, unknown>> {
  const row = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
  return {
    kind: row.kind,
    name: row.name,
    categoryId: row.categoryId,
    price: String(row.price),
    originalPrice: "",
    costPrice: row.costPrice != null ? String(row.costPrice) : "",
    imageUrl: row.imageUrl,
    stockQuantity: String(row.stockQuantity),
    madeToOrder: row.madeToOrder,
    isFeatured: row.isFeatured,
    isPublished: row.isPublished,
    badge: "",
    unit: row.unit ?? "",
    description: row.description ?? "",
    nutrition: "",
    origin: row.origin ?? "",
    dietary: row.dietary,
    taxExempt: row.taxExempt,
    bookAuthor: row.bookAuthor ?? "",
    bookIsbn: "",
    bookAvailability: row.bookAvailability ?? "sale",
    faName: "",
    faUnit: "",
    faDescription: "",
    faNutrition: "",
    faOrigin: "",
    optionGroups,
  };
}

async function save(productId: string, body: Record<string, unknown>): Promise<Response> {
  signInAs("admin");
  return updateProduct(jsonRequest("PUT", `/api/products/${productId}`, body), routeParams({ id: productId }));
}

const SIZE_FORM = {
  name: "Size",
  nameFa: "اندازه",
  required: true,
  selection: "single",
  minChoices: "",
  maxChoices: "",
  choices: [
    { name: "Small", nameFa: "", priceDelta: "", isAvailable: true, isDefault: true },
    { name: "Large", nameFa: "بزرگ", priceDelta: "20000", isAvailable: true, isDefault: false },
  ],
};

describe("editing an item's options", () => {
  it("saves groups with the item, keeps their ids across saves, and logs the change", async () => {
    const saved = await save(LATTE, await formFor(LATTE, [SIZE_FORM]));
    expect(saved.status).toBe(200);

    signInAs("staff");
    const read = await readJson<Product>(
      await getAdminProduct(getRequest(`/api/admin/products/${LATTE}`), routeParams({ id: LATTE })),
    );
    const [size] = read.optionGroups ?? [];
    expect(size).toMatchObject({ name: "Size", nameFa: "اندازه", required: true, selection: "single", minChoices: 1 });
    expect(size.choices.map((c) => [c.name, c.priceDelta, c.isDefault])).toEqual([
      ["Small", 0, true],
      ["Large", 20000, false],
    ]);

    // Reorder the choices, drop Small, add Medium: Large keeps its id, Small goes.
    const large = size.choices[1];
    const again = await save(
      LATTE,
      await formFor(LATTE, [
        {
          ...SIZE_FORM,
          id: size.id,
          choices: [
            { id: large.id, name: "Large", nameFa: "", priceDelta: "25000", isAvailable: false, isDefault: false },
            { name: "Medium", nameFa: "", priceDelta: "10000", isAvailable: true, isDefault: true },
          ],
        },
      ]),
    );
    expect(again.status).toBe(200);
    const rows = await prisma.productOptionChoice.findMany({
      where: { groupId: size.id },
      orderBy: { position: "asc" },
    });
    expect(rows.map((row) => [row.id === large.id, row.name, row.priceDelta, row.isAvailable])).toEqual([
      [true, "Large", 25000, false],
      [false, "Medium", 10000, true],
    ]);

    const entries = await prisma.activityEntry.findMany({
      where: { entityType: "product", entityId: LATTE, changedFields: { has: "options" } },
      orderBy: { createdAt: "asc" },
    });
    expect(entries).toHaveLength(2);

    // An empty list clears them; a body without the field leaves them.
    const { optionGroups: _omit, ...withoutField } = await formFor(LATTE, []);
    expect((await save(LATTE, withoutField)).status).toBe(200);
    expect(await prisma.productOptionGroup.count({ where: { productId: LATTE } })).toBe(1);
    expect((await save(LATTE, await formFor(LATTE, []))).status).toBe(200);
    expect(await prisma.productOptionGroup.count({ where: { productId: LATTE } })).toBe(0);
  });

  it("re-validates on the server and drops a book's options", async () => {
    const bad = await save(LATTE, await formFor(LATTE, [{ ...SIZE_FORM, choices: [] }]));
    expect(bad.status).toBe(400);
    expect((await readError(bad)).fieldErrors?.optionGroups).toBe("optionChoicesRequired");

    const book = "seed-book-uncle-napoleon";
    expect((await save(book, await formFor(book, [SIZE_FORM]))).status).toBe(200);
    expect(await prisma.productOptionGroup.count({ where: { productId: book } })).toBe(0);
  });

  it("serves the options with the public menu and the item", async () => {
    await giveOptions();
    const menu = await readJson<Product[]>(await listProducts(getRequest("/api/products")));
    expect(menu.find((item) => item.id === LATTE)?.optionGroups?.map((group) => group.name)).toEqual([
      "Size",
      "Extras",
    ]);
    const item = await readJson<Product>(
      await getProduct(getRequest(`/api/products/${LATTE}`), routeParams({ id: LATTE })),
    );
    expect(item.optionGroups?.[1].choices.map((choice) => choice.priceDelta)).toEqual([15000, 12000]);
  });
});

describe("ordering with options", () => {
  it("prices the line from the item's options now, snapshots them, and past orders don't change", async () => {
    const ids = await giveOptions();
    const response = await place([
      { productId: LATTE, quantity: 2, choiceIds: [ids.oat, ids.small, ids.shot] },
      { productId: LATTE, quantity: 1 },
      { productId: CAKE, quantity: 1 },
    ]);
    expect(response.status).toBe(201);
    const order = await readJson<Order>(response);

    // 95,000 + 15,000 + 12,000; the other gets the default Large (+20,000).
    expect(order.items.map((item) => item.unitPrice)).toEqual([122000, 115000, 120000]);
    expect(order.subtotal).toBe(2 * 122000 + 115000 + 120000);
    expect(order.items[0].options?.map((option) => [option.group, option.choice, option.choiceFa])).toEqual([
      ["Size", "Small", "کوچک"],
      ["Extras", "Extra shot", undefined],
      ["Extras", "Oat milk", "شیر جو"],
    ]);
    expect(order.items[2].options).toBeUndefined();

    // The menu changes; the order reads as it was placed.
    await prisma.productOptionChoice.update({
      where: { id: ids.shot },
      data: { name: "Double shot", priceDelta: 30000 },
    });
    await prisma.productOptionGroup.deleteMany({ where: { productId: LATTE, name: "Size" } });
    signInAs("customer");
    const mine = await readJson<Order>(
      await getOwnOrder(getRequest(`/api/orders/${order.id}`), routeParams({ id: order.id })),
    );
    expect(mine.items[0].unitPrice).toBe(122000);
    expect(mine.items[0].options?.map((option) => option.choice)).toEqual(["Small", "Extra shot", "Oat milk"]);
  });

  it("refuses unknown, switched-off and out-of-bounds choices", async () => {
    const ids = await giveOptions();
    await prisma.productOptionChoice.update({ where: { id: ids.oat }, data: { isAvailable: false } });
    const cases: [unknown[], string][] = [
      [[ids.small, "not-a-choice"], "optionUnknown"],
      [[ids.small, ids.oat], "optionUnavailable"],
      [[ids.small, ids.large], "optionTooMany"],
    ];
    for (const [choiceIds, message] of cases) {
      const response = await place([{ productId: LATTE, quantity: 1, choiceIds }]);
      expect(response.status).toBe(400);
      expect((await readError(response)).fieldErrors?.items).toBe(message);
    }
    // A choice of another item is unknown to this one.
    const cake = await place([{ productId: CAKE, quantity: 1, choiceIds: [ids.small] }]);
    expect((await readError(cake)).fieldErrors?.items).toBe("optionUnknown");
    // Without a default, a required group must be answered.
    await prisma.productOptionChoice.update({ where: { id: ids.large }, data: { isDefault: false } });
    const none = await place([{ productId: LATTE, quantity: 1 }]);
    expect((await readError(none)).fieldErrors?.items).toBe("optionRequired");
    expect(await prisma.order.count({ where: { userId: { not: null }, items: { some: { productId: LATTE } } } })).toBe(
      0,
    );
  });

  it("quotes with the options, and a promo's minimum counts them", async () => {
    const ids = await giveOptions();
    await prisma.promoCode.create({ data: { code: "OPTIONS", kind: "fixed", value: 10000, minSubtotal: 120000 } });
    signInAs("customer");
    const plain = await quoteOrder(
      jsonRequest("POST", "/api/orders/quote", {
        items: [{ productId: LATTE, quantity: 1, choiceIds: [ids.small] }],
        promoCode: "OPTIONS",
      }),
    );
    expect(plain.status).toBe(409);

    const withShot = await quoteOrder(
      jsonRequest("POST", "/api/orders/quote", {
        items: [{ productId: LATTE, quantity: 1, choiceIds: [ids.small, ids.shot, ids.oat] }],
        promoCode: "OPTIONS",
      }),
    );
    expect(withShot.status).toBe(200);
    expect(await readJson<OrderQuote>(withShot)).toMatchObject({
      subtotal: 122000,
      promoDiscount: 10000,
      total: 112000,
    });
  });

  it("rings up a counter sale with options, completes it on the recipe as before, and reports it under the item", async () => {
    const ids = await giveOptions();
    signInAs("staff");
    const response = await ringUpSale(
      jsonRequest("POST", "/api/admin/orders", {
        items: [
          { productId: LATTE, quantity: 1, choiceIds: [ids.large, ids.shot] },
          { productId: LATTE, quantity: 1, choiceIds: [ids.small] },
        ],
        serviceType: "takeaway",
        customerPhone: "0912 555 0110",
        customerName: "Nima Rad",
        paymentParts: [{ method: "cash", amount: 130000 + 95000 }],
        complete: true,
      }),
    );
    expect(response.status).toBe(201);
    const order = await readJson<Order>(response);
    expect(order).toMatchObject({ status: "completed", paymentStatus: "paid", total: 225000 });
    // Stock follows the item's own recipe, whatever was chosen.
    const lines = await prisma.orderItem.findMany({ where: { orderId: order.id } });
    expect(lines.every((line) => line.stockTracked)).toBe(true);

    const refused = await ringUpSale(
      jsonRequest("POST", "/api/admin/orders", {
        items: [{ productId: LATTE, quantity: 1, choiceIds: [ids.small, ids.large] }],
        serviceType: "takeaway",
        customerPhone: "0912 555 0110",
        customerName: "Nima Rad",
      }),
    );
    expect((await readError(refused)).fieldErrors?.items).toBe("optionTooMany");

    signInAs("admin");
    const report = await readJson<SalesReport>(await salesReport(getRequest("/api/admin/reports/sales?range=7d")));
    expect(report.topItems.filter((item) => item.productId === LATTE)).toEqual([
      expect.objectContaining({ quantity: 2, revenue: 225000 }),
    ]);
  });

  it("adds a round with options to an order staff are changing", async () => {
    const ids = await giveOptions();
    const placed = await readJson<Order>(await place([{ productId: CAKE, quantity: 1 }]));
    await moveTo(placed.id, "preparing");

    signInAs("staff");
    const response = await changeOrder(
      jsonRequest("PATCH", `/api/admin/orders/${placed.id}`, {
        version: (await prisma.order.findUniqueOrThrow({ where: { id: placed.id } })).updatedAt.toISOString(),
        add: [{ productId: LATTE, quantity: 2, choiceIds: [ids.small, ids.oat], note: "hot" }],
      }),
      routeParams({ id: placed.id }),
    );
    expect(response.status).toBe(200);
    const changed = await readJson<Order>(response);
    const added = changed.items.find((item) => item.productId === LATTE);
    expect(added).toMatchObject({ unitPrice: 107000, quantity: 2, note: "hot" });
    expect(added?.options?.map((option) => option.choice)).toEqual(["Small", "Oat milk"]);
    expect(changed.subtotal).toBe(placed.subtotal + 214000);

    const entry = await prisma.activityEntry.findFirstOrThrow({
      where: { entityId: placed.id, action: "order.changed" },
    });
    expect(JSON.stringify(entry.changes)).toContain("Espresso [Small, Oat milk]");

    const bad = await changeOrder(
      jsonRequest("PATCH", `/api/admin/orders/${placed.id}`, {
        add: [{ productId: LATTE, quantity: 1, choiceIds: ["nope"] }],
      }),
      routeParams({ id: placed.id }),
    );
    expect((await readError(bad)).fieldErrors?.items).toBe("optionUnknown");
  });
});
