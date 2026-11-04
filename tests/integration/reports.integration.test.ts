import { describe, expect, it } from "vitest";

import { PATCH as setPayment } from "@/app/api/admin/orders/[id]/payment/route";
import { POST as refundOrder } from "@/app/api/admin/orders/[id]/refunds/route";
import { PATCH as changeStatus } from "@/app/api/admin/orders/[id]/status/route";
import { POST as ringUpSale } from "@/app/api/admin/orders/route";
import { GET as paymentReport } from "@/app/api/admin/reports/payments/route";
import { GET as salesReport } from "@/app/api/admin/reports/sales/route";
import { POST as placeOrder } from "@/app/api/orders/route";
import type { PaymentReport, SalesReport } from "@/src/domain/entities/Analytics";
import type { Order } from "@/src/domain/entities/Order";
import type { OrderRefund } from "@/src/domain/entities/OrderRefund";
import { prisma } from "@/src/infrastructure/prisma/client";

import { TEST_USERS } from "../fixtures/users";

import { getRequest, jsonRequest, readJson, routeParams } from "./helpers/http";
import { signInAs } from "./helpers/session";

const BOOK = "seed-book-uncle-napoleon";
const CAKE = "seed-carrot-cake";

const sum = (rows: readonly { value?: number; revenue?: number }[]): number =>
  rows.reduce((total, row) => total + (row.value ?? row.revenue ?? 0), 0);

async function sales(): Promise<SalesReport> {
  signInAs("admin");
  const response = await salesReport(getRequest("/api/admin/reports/sales?range=7d"));
  expect(response.status).toBe(200);
  return readJson<SalesReport>(response);
}

async function payments(): Promise<PaymentReport> {
  signInAs("admin");
  const response = await paymentReport(getRequest("/api/admin/reports/payments?range=7d"));
  expect(response.status).toBe(200);
  return readJson<PaymentReport>(response);
}

/** A counter sale of two espressos (190,000), paid in `parts` and handed over on the spot. */
async function counterSale(parts: { method: string; amount: number }[]): Promise<Order> {
  signInAs("staff");
  const response = await ringUpSale(
    jsonRequest("POST", "/api/admin/orders", {
      items: [{ productId: "seed-espresso", quantity: 2 }],
      serviceType: "takeaway",
      customerPhone: "0912 555 0110",
      customerName: "Nima Rad",
      paymentParts: parts,
      complete: true,
    }),
  );
  expect(response.status).toBe(201);
  return readJson<Order>(response);
}

async function refund(order: Order, lines: { itemId: string; quantity: number }[], method: string): Promise<number> {
  signInAs("admin");
  const response = await refundOrder(
    jsonRequest("POST", `/api/admin/orders/${order.id}/refunds`, {
      lines: lines.map((line) => ({ ...line, restock: false })),
      method,
    }),
    routeParams({ id: order.id }),
  );
  expect(response.status).toBe(201);
  return (await readJson<{ refund: OrderRefund }>(response)).refund.amount;
}

describe("the payments report's split by method", () => {
  it("is net of refunds, so it adds up to what was paid", async () => {
    const split = await counterSale([
      { method: "cash", amount: 40000 },
      { method: "card", amount: 150000 },
    ]);
    await counterSale([{ method: "cash", amount: 190000 }]);
    // One espresso back on the card it was paid with.
    const back = await refund(split, [{ itemId: split.items[0].id, quantity: 1 }], "card");
    expect(back).toBe(95000);

    const report = await payments();
    expect(report.summary.paidValue).toBe(2 * 190000 - 95000);
    expect(sum(report.byMethod)).toBe(report.summary.paidValue);
    expect(report.byMethod).toEqual([
      { method: "cash", orders: 2, value: 230000 },
      { method: "card", orders: 1, value: 55000 },
    ]);
  });

  it("spreads a refund made a way the guest didn't pay over the parts they did", async () => {
    const split = await counterSale([
      { method: "cash", amount: 40000 },
      { method: "card", amount: 150000 },
    ]);
    await refund(split, [{ itemId: split.items[0].id, quantity: 1 }], "transfer");

    const report = await payments();
    expect(sum(report.byMethod)).toBe(report.summary.paidValue);
    expect(report.summary.paidValue).toBe(95000);
    expect(report.byMethod.every((row) => row.value >= 0)).toBe(true);
    expect(report.byMethod.map((row) => row.method).sort()).toEqual(["card", "cash"]);
  });
});

describe("the sales report's split by kind and top items", () => {
  it("count what guests paid after promo, points and refunds, so the kinds add up to revenue", async () => {
    await prisma.promoCode.create({ data: { code: "ODDSAVE", kind: "fixed", value: 10001 } });
    await prisma.loyaltyTransaction.create({ data: { userId: TEST_USERS.customer.id, delta: 77, reason: "adjust" } });

    signInAs("customer");
    const placed = await placeOrder(
      jsonRequest("POST", "/api/orders", {
        items: [
          { productId: "seed-espresso", quantity: 2 },
          { productId: CAKE, quantity: 1 },
          { productId: BOOK, quantity: 1 },
        ],
        serviceType: "takeaway",
        promoCode: "oddsave",
        redeemPoints: true,
      }),
    );
    expect(placed.status).toBe(201);
    const order = await readJson<Order>(placed);
    expect(order).toMatchObject({ subtotal: 730000, promoDiscount: 10001, pointsDiscount: 77000, total: 642999 });

    signInAs("staff");
    for (const status of ["preparing", "completed"]) {
      const response = await changeStatus(
        jsonRequest("PATCH", `/api/admin/orders/${order.id}/status`, { status }),
        routeParams({ id: order.id }),
      );
      expect(response.status).toBe(200);
    }
    const paid = await setPayment(
      jsonRequest("PATCH", `/api/admin/orders/${order.id}/payment`, { paymentStatus: "paid", paymentMethod: "card" }),
      routeParams({ id: order.id }),
    );
    expect(paid.status).toBe(200);

    // A plain sale beside it, and one espresso of the discounted order handed back.
    await counterSale([{ method: "cash", amount: 190000 }]);
    const espresso = order.items.find((item) => item.productId === "seed-espresso");
    if (!espresso) throw new Error("the order has no espresso");
    const back = await refund(order, [{ itemId: espresso.id, quantity: 1 }], "card");

    const report = await sales();
    expect(report.summary.revenue).toBe(642999 + 190000 - back);
    // To the Toman: the order's total is split over its lines exactly.
    expect(sum(report.byKind)).toBe(report.summary.revenue);
    const kind = (name: string) => report.byKind.find((row) => row.kind === name);
    // Each kind brings in less than its list price — the discount is shared by all of them.
    expect(kind("food")?.revenue).toBeLessThan(120000);
    expect(kind("book")?.revenue).toBeLessThan(420000);
    expect(kind("drink")).toMatchObject({ quantity: 3 });

    // Every item fits in the top list here, so it adds up to revenue too; counts stay unit counts.
    expect(sum(report.topItems)).toBe(report.summary.revenue);
    expect(report.topItems.find((item) => item.productId === "seed-espresso")?.quantity).toBe(3);
    expect(report.topItems.find((item) => item.productId === CAKE)).toMatchObject({
      quantity: 1,
      revenue: kind("food")?.revenue,
    });
  });
});
