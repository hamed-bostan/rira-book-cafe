import { describe, expect, it } from "vitest";

import { POST as refundOrder } from "@/app/api/admin/orders/[id]/refunds/route";
import { POST as ringUpSale } from "@/app/api/admin/orders/route";
import { GET as paymentReport } from "@/app/api/admin/reports/payments/route";
import type { PaymentReport } from "@/src/domain/entities/Analytics";
import type { Order } from "@/src/domain/entities/Order";
import type { OrderRefund } from "@/src/domain/entities/OrderRefund";

import { getRequest, jsonRequest, readJson, routeParams } from "./helpers/http";
import { signInAs } from "./helpers/session";

const sum = (rows: readonly { value?: number; revenue?: number }[]): number =>
  rows.reduce((total, row) => total + (row.value ?? row.revenue ?? 0), 0);

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
