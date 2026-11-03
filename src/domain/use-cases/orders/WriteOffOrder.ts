import { singleChange, type ActivityActor } from "../../entities/ActivityEntry";
import { canWriteOffOrder, MAX_WRITE_OFF_REASON_LENGTH, type Order } from "../../entities/Order";
import { ConflictError } from "../../errors/ConflictError";
import { NotFoundError } from "../../errors/NotFoundError";
import { ValidationError } from "../../errors/ValidationError";

import { writeOffPostings } from "./orderLedger";

import type { ILedgerRepository } from "../../repositories/ILedgerRepository";
import type { IOrderRepository } from "../../repositories/IOrderRepository";

/**
 * Write off a served order nobody paid for — a guest who walked out. A money
 * decision rather than a floor one: the order is cancelled and its sale comes off
 * the books, so the route takes `accounting.write`.
 *
 * Its own use-case rather than a step in the workflow table: `completed` stays
 * terminal for every other move, and this one is only open to an unpaid order.
 * Nothing goes back on the shelf (the goods were consumed) and the guest isn't
 * told. The revenue and VAT come back out against the receivable the sale left —
 * worked from the sale as it was booked — and the cost of sales stays.
 */
export class WriteOffOrder {
  constructor(
    private readonly orderRepo: IOrderRepository,
    private readonly ledger: Pick<ILedgerRepository, "entriesFor">,
  ) {}

  async execute(
    orderId: string,
    input: { reason?: string },
    actor: ActivityActor,
    now: Date = new Date(),
  ): Promise<Order> {
    const order = await this.orderRepo.getById(orderId);
    if (!order) throw new NotFoundError("order", orderId);
    if (!canWriteOffOrder(order)) {
      throw new ConflictError("INVALID_TRANSITION", "Only a served order nobody paid for can be written off.");
    }
    const reason = input.reason?.trim() || undefined;
    if (reason && reason.length > MAX_WRITE_OFF_REASON_LENGTH) {
      throw new ValidationError("reason", "That reason is too long.");
    }

    const sale = (await this.ledger.entriesFor(orderId)).find(
      (entry) => entry.source === "orderSale" && !entry.reversedById,
    );

    return this.orderRepo.writeOff(
      orderId,
      actor,
      (saved) => ({
        actorId: actor.id,
        actorName: actor.name,
        action: "order.writtenOff",
        entityType: "order",
        entityId: saved.id,
        entityLabel: `#${saved.orderNumber}`,
        changes: [
          ...singleChange("status", order.status, saved.status),
          ...(reason ? singleChange("reason", null, reason) : []),
        ],
      }),
      writeOffPostings(sale, reason, actor, now),
    );
  }
}
