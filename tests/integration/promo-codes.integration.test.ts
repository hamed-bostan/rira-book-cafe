import { describe, expect, it } from "vitest";

import { PATCH as changeOrder } from "@/app/api/admin/orders/[id]/route";
import {
  DELETE as deletePromoCode,
  PATCH as setPromoCodeActive,
  PUT as updatePromoCode,
} from "@/app/api/admin/promo-codes/[id]/route";
import { GET as listPromoCodes, POST as createPromoCode } from "@/app/api/admin/promo-codes/route";
import { POST as quoteOrder } from "@/app/api/orders/quote/route";
import { POST as placeOrder } from "@/app/api/orders/route";
import type { OrderQuote } from "@/src/domain/entities/Checkout";
import type { Order } from "@/src/domain/entities/Order";
import type { PromoCodeWithUses } from "@/src/domain/entities/Promotion";
import { prisma } from "@/src/infrastructure/prisma/client";
import { PrismaPromotionRepository } from "@/src/infrastructure/repositories/PrismaPromotionRepository";

import { jsonRequest, readError, readJson, routeParams } from "./helpers/http";
import { signInAs } from "./helpers/session";

/** Codes saved straight to the table — older ones may carry `-` or `_`, which a new code can't. */
async function saveCodes(...codes: string[]): Promise<void> {
  await prisma.promoCode.createMany({ data: codes.map((code) => ({ code, kind: "fixed", value: 10_000 })) });
}

/** Quote one cappuccino with the code as a guest typed it. */
async function quoteWith(promoCode: string): Promise<Response> {
  signInAs("customer");
  return quoteOrder(
    jsonRequest("POST", "/api/orders/quote", { items: [{ productId: "seed-cappuccino", quantity: 1 }], promoCode }),
  );
}

/** The stored code the quote applied. */
async function appliedCode(promoCode: string): Promise<string | undefined> {
  const response = await quoteWith(promoCode);
  expect(response.status).toBe(200);
  return (await readJson<OrderQuote>(response)).promoCode;
}

describe("finding the code a guest typed at checkout", () => {
  it("ignores case, spaces, dashes and underscores", async () => {
    await saveCodes("AUTUMN15");

    for (const typed of ["autumn-15", "Autumn 15", "AUTUMN15", " autumn_15 "]) {
      expect(await appliedCode(typed)).toBe("AUTUMN15");
    }
  });

  it("still finds a code saved with a dash before codes were letters and numbers only", async () => {
    await saveCodes("SPRING-10");

    for (const typed of ["SPRING-10", "spring10", "Spring 10"]) {
      expect(await appliedCode(typed)).toBe("SPRING-10");
    }
  });

  it("prefers the code saved exactly as typed, then the plain one, when two collapse to the same letters", async () => {
    await saveCodes("AUTUMN-15", "AUTUMN15");

    expect(await appliedCode("autumn-15")).toBe("AUTUMN-15");
    expect(await appliedCode("AUTUMN15")).toBe("AUTUMN15");
    expect(await appliedCode("autumn 15")).toBe("AUTUMN15");
  });

  it("refuses rather than guess between two old codes typed as neither", async () => {
    await saveCodes("WIN-TER", "WIN_TER");

    expect(await appliedCode("win_ter")).toBe("WIN_TER");
    const response = await quoteWith("winter");
    expect(response.status).toBe(409);
    expect((await readError(response)).code).toBe("PROMO_INVALID");
  });

  it("refuses a typed code that's all separators, even against an old code that was", async () => {
    await saveCodes("---");

    const response = await quoteWith("- -");
    expect(response.status).toBe(409);
    expect((await readError(response)).code).toBe("PROMO_INVALID");
  });
});

/** The form staff send for a code, as the dashboard does (strings for the figures). */
function promoForm(code: string): Record<string, unknown> {
  return {
    code,
    description: "",
    kind: "fixed",
    value: "20000",
    maxDiscount: "",
    minSubtotal: "",
    startsOn: "",
    endsOn: "",
    usageLimit: "",
    perGuestLimit: "1",
    isActive: true,
  };
}

/** A code made by staff, and its id. */
async function createCode(code: string): Promise<string> {
  signInAs("admin");
  const response = await createPromoCode(jsonRequest("POST", "/api/admin/promo-codes", promoForm(code)));
  expect(response.status).toBe(201);
  return (await readJson<{ id: string }>(response)).id;
}

function remove(id: string): Promise<Response> {
  signInAs("admin");
  return deletePromoCode(jsonRequest("DELETE", `/api/admin/promo-codes/${id}`), routeParams({ id }));
}

/** A guest's takeaway order with the code: two cappuccinos. */
async function orderWith(promoCode: string): Promise<Order> {
  signInAs("customer");
  const response = await placeOrder(
    jsonRequest("POST", "/api/orders", {
      items: [{ productId: "seed-cappuccino", quantity: 2 }],
      serviceType: "takeaway",
      promoCode,
    }),
  );
  expect(response.status).toBe(201);
  return readJson<Order>(response);
}

async function listedCodes(): Promise<string[]> {
  signInAs("admin");
  const response = await listPromoCodes();
  expect(response.status).toBe(200);
  return (await readJson<PromoCodeWithUses[]>(response)).map((promo) => promo.code);
}

describe("deleting a promo code", () => {
  it("removes a code no order used, for good", async () => {
    const id = await createCode("UNUSED10");

    expect((await remove(id)).status).toBe(204);
    expect(await prisma.promoCode.count({ where: { id } })).toBe(0);
    expect(await prisma.activityEntry.count({ where: { entityId: id, action: "promoCode.deleted" } })).toBe(1);
    // Nothing used it, so its code is free again.
    await createCode("UNUSED10");
  });

  it("archives a code orders used: gone from the list and checkout, kept for its orders", async () => {
    const id = await createCode("THANKS20");
    const order = await orderWith("thanks20");
    expect(order).toMatchObject({ promoCodeId: id, promoDiscount: 20_000 });

    expect((await remove(id)).status).toBe(204);
    const row = await prisma.promoCode.findUniqueOrThrow({ where: { id } });
    expect(row.archivedAt).not.toBeNull();
    expect(row.isActive).toBe(false);
    expect(await listedCodes()).not.toContain("THANKS20");
    expect(await prisma.activityEntry.count({ where: { entityId: id, action: "promoCode.archived" } })).toBe(1);

    // No guest can take it any more.
    const quote = await quoteWith("THANKS20");
    expect(quote.status).toBe(409);
    expect((await readError(quote)).code).toBe("PROMO_INVALID");

    // Staff changing the order it's on: the order keeps its discount.
    signInAs("staff");
    const changed = await changeOrder(
      jsonRequest("PATCH", `/api/admin/orders/${order.id}`, { add: [{ productId: "seed-espresso", quantity: 1 }] }),
      routeParams({ id: order.id }),
    );
    expect(changed.status).toBe(200);
    expect(await readJson<Order>(changed)).toMatchObject({ promoCodeId: id, promoDiscount: 20_000 });
  });

  it("won't let an archived code be switched on, edited, deleted again or created afresh", async () => {
    const id = await createCode("ONCEONLY");
    await orderWith("ONCEONLY");
    expect((await remove(id)).status).toBe(204);

    signInAs("admin");
    const switched = await setPromoCodeActive(
      jsonRequest("PATCH", `/api/admin/promo-codes/${id}`, { isActive: true }),
      routeParams({ id }),
    );
    expect(switched.status).toBe(404);
    const edited = await updatePromoCode(
      jsonRequest("PUT", `/api/admin/promo-codes/${id}`, promoForm("ONCEONLY")),
      routeParams({ id }),
    );
    expect(edited.status).toBe(404);
    expect((await remove(id)).status).toBe(404);

    // A new code under the old name would hand every guest its per-guest limit again.
    signInAs("admin");
    const again = await createPromoCode(jsonRequest("POST", "/api/admin/promo-codes", promoForm("onceonly")));
    expect(again.status).toBe(400);
    expect((await readError(again)).fieldErrors).toEqual({ code: "codeArchived" });
    expect(await prisma.promoCode.count({ where: { code: "ONCEONLY" } })).toBe(1);
    expect((await prisma.promoCode.findUniqueOrThrow({ where: { id } })).isActive).toBe(false);
  });

  it("never removes a code from under an order: the delete itself refuses one an order carries", async () => {
    const id = await createCode("RACE5");
    await orderWith("RACE5");

    await expect(new PrismaPromotionRepository().delete(id)).rejects.toMatchObject({ name: "ResourceInUseError" });
    expect(await prisma.promoCode.count({ where: { id } })).toBe(1);
  });
});
