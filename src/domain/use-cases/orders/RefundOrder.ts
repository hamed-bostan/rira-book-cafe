import { singleChange, type ActivityActor } from "../../entities/ActivityEntry";
import { cafeDayOf } from "../../entities/CafeTime";
import { SYSTEM_ACCOUNTS } from "../../entities/Ledger";
import { canRefundOrder, type PaymentMethod } from "../../entities/Order";
import {
  MAX_REFUND_REASON_LENGTH,
  priceRefundLines,
  type OrderRefund,
  type RefundLineRequest,
} from "../../entities/OrderRefund";
import { ConflictError } from "../../errors/ConflictError";
import { NotFoundError } from "../../errors/NotFoundError";
import { ValidationError } from "../../errors/ValidationError";

import { refundPostings } from "./orderLedger";

import type { ILedgerRepository } from "../../repositories/ILedgerRepository";
import type { IOrderRepository, OrderRefundResult } from "../../repositories/IOrderRepository";

export type RefundOrderInput = {
  lines: readonly RefundLineRequest[];
  /** The way the money goes back: it decides which account it leaves. */
  method: PaymentMethod;
  reason?: string;
};

/**
 * Hand money back on a completed, paid order — part of it or all of it. Staff pick
 * the units; each is priced at its share of what the guest actually paid, with the
 * VAT the sale actually booked, so the books come back to the Toman. Units a guest
 * brought back in saleable condition go back on the shelf, and their cost comes out
 * of cost of sales; units that can't (a drink) leave their cost where it is.
 *
 * Cancelling is still the way to call off an order that hasn't been served.
 */
export class RefundOrder {
  constructor(
    private readonly orderRepo: IOrderRepository,
    private readonly ledger: Pick<ILedgerRepository, "entriesFor">,
  ) {}

  async execute(
    orderId: string,
    input: RefundOrderInput,
    actor: ActivityActor,
    now: Date = new Date(),
  ): Promise<OrderRefundResult> {
    const order = await this.orderRepo.getById(orderId);
    if (!order) throw new NotFoundError("order", orderId);
    if (!canRefundOrder(order)) {
      throw new ConflictError("INVALID_TRANSITION", "Only a completed, paid order can be refunded.");
    }
    const reason = input.reason?.trim() || undefined;
    if (reason && reason.length > MAX_REFUND_REASON_LENGTH) {
      throw new ValidationError("reason", "That reason is too long.");
    }

    // An order from before the books began has no sale to take back.
    const sale = (await this.ledger.entriesFor(orderId)).find((entry) => entry.source === "orderSale");
    if (!sale) throw new ConflictError("NOT_REFUNDABLE", "This order's sale isn't on the books.");
    const saleVat = sale.lines
      .filter((line) => line.accountCode === SYSTEM_ACCOUNTS.vatPayable)
      .reduce((sum, line) => sum + line.credit, 0);

    const priced = priceRefundLines(order, saleVat, input.lines);
    if (priced.problem !== undefined) throw new ValidationError("lines", priced.problem);
    const amount = priced.lines.reduce((sum, line) => sum + line.amount, 0);
    const vatAmount = priced.lines.reduce((sum, line) => sum + line.vatAmount, 0);
    if (amount <= 0) throw new ValidationError("lines", "refundNothing");

    const refund: Omit<OrderRefund, "id" | "number" | "createdAt"> = {
      orderId,
      date: cafeDayOf(now),
      method: input.method,
      amount,
      vatAmount,
      reason,
      lines: priced.lines,
      createdById: actor.id,
      createdByName: actor.name,
    };

    return this.orderRepo.refund(
      {
        ...refund,
        expectedRefunded: Object.fromEntries(
          priced.lines.map((line) => [
            line.orderItemId,
            order.items.find((item) => item.id === line.orderItemId)?.refundedQuantity ?? 0,
          ]),
        ),
      },
      actor,
      (result) => ({
        actorId: actor.id,
        actorName: actor.name,
        action: "order.refunded",
        entityType: "order",
        entityId: result.order.id,
        entityLabel: `#${result.order.orderNumber}`,
        changes: singleChange("refundedTotal", order.refundedTotal, result.order.refundedTotal),
      }),
      refundPostings(actor),
    );
  }
}
