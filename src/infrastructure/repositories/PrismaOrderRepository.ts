import type { ActivityActor } from "@/src/domain/entities/ActivityEntry";
import {
  DEFAULT_ADMIN_ORDER_DIRECTION,
  type AdminOrderFilters,
  type AdminOrderSort,
  type OrderStatusCounts,
} from "@/src/domain/entities/AdminOrderFilters";
import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import {
  ACTIVE_ORDER_STATUSES,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  SERVICE_TYPES,
  SERVING_ORDER_STATUSES,
  canServeItems,
  largestPaymentPart,
  type Order,
  type OrderItem,
  type OrderStatus,
  type PaymentMethod,
  type PaymentStatus,
  type ServiceType,
} from "@/src/domain/entities/Order";
import { pointsToClawBack, type NewOrderRefund, type OrderRefund } from "@/src/domain/entities/OrderRefund";
import type { OrderStatusEvent } from "@/src/domain/entities/OrderStatusEvent";
import { createPage, toSkipTake, type Page, type PageRequest } from "@/src/domain/entities/Pagination";
import { PRODUCT_KINDS, type ProductKind } from "@/src/domain/entities/Product";
import { ConflictError } from "@/src/domain/errors/ConflictError";
import { InsufficientStockError, type StockShortfall } from "@/src/domain/errors/InsufficientStockError";
import { InvalidOrderTransitionError } from "@/src/domain/errors/InvalidOrderTransitionError";
import { NotFoundError } from "@/src/domain/errors/NotFoundError";
import type { AuditHook } from "@/src/domain/repositories/AuditHook";
import type { LedgerHook } from "@/src/domain/repositories/ILedgerRepository";
import type {
  IOrderRepository,
  NewOrder,
  OrderChange,
  OrderRefundResult,
  PaymentChange,
} from "@/src/domain/repositories/IOrderRepository";
import { prisma } from "@/src/infrastructure/prisma/client";
import { type Prisma } from "@/src/infrastructure/prisma/generated/client";
import { inTransaction, type PrismaDb } from "@/src/infrastructure/prisma/transaction";

import { lockPromoCode } from "./promoCodeLock";
import { recordAudit } from "./writeActivityEntry";
import { createGuestProfile } from "./writeGuestProfile";
import { dateToDay, dayToDate, postHook } from "./writeJournal";
import { clawBackPoints, earnPoints, redeemPoints, refundPoints } from "./writeLoyalty";
import { consumeStockForOrder, returnStockForRefund } from "./writeStock";

/** Every read loads the lines with the order, in the order the guest listed them, and how it was paid. */
const WITH_ITEMS = {
  items: { orderBy: { position: "asc" } },
  paymentParts: { orderBy: { position: "asc" } },
} satisfies Prisma.OrderInclude;

type OrderRow = Prisma.OrderGetPayload<{ include: typeof WITH_ITEMS }>;

const WITH_REFUND_LINES = { lines: { orderBy: { position: "asc" } } } satisfies Prisma.OrderRefundInclude;

type RefundRow = Prisma.OrderRefundGetPayload<{ include: typeof WITH_REFUND_LINES }>;

/**
 * Orders backed by PostgreSQL via Prisma. Server-side only, bound through the
 * container — never imported by client code.
 */
export class PrismaOrderRepository implements IOrderRepository {
  constructor(private readonly db: PrismaDb = prisma) {}

  async place(input: NewOrder, placedBy: ActivityActor, audit?: AuditHook<Order>): Promise<Order> {
    return inTransaction(this.db, async (tx) => {
      // Take the units first; a shortfall aborts the transaction, so nothing is placed.
      await moveShelfStock(tx, input.items);

      // The code's limits are re-checked here, under its lock: the use-case priced the
      // order, but two guests racing for the last use must not both get it.
      if (input.promoCodeId) await claimPromoUse(tx, input.promoCodeId, input.userId);

      await createGuestProfile(tx, input.newGuest);
      const created = await tx.order.create({
        data: {
          userId: input.userId,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          serviceType: input.serviceType,
          tableLabel: input.tableLabel ?? null,
          note: input.note ?? null,
          subtotal: input.subtotal,
          promoCodeId: input.promoCodeId ?? null,
          promoCode: input.promoCode ?? null,
          promoDiscount: input.promoDiscount,
          pointsRedeemed: input.pointsRedeemed,
          pointsDiscount: input.pointsDiscount,
          total: input.total,
          items: {
            create: input.items.map((item, position) => ({
              productId: item.productId,
              kind: item.kind,
              name: item.name,
              imageUrl: item.imageUrl,
              unitPrice: item.unitPrice,
              unitCost: item.unitCost ?? null,
              taxExempt: item.taxExempt ?? false,
              quantity: item.quantity,
              note: item.note ?? null,
              position,
            })),
          },
        },
        include: WITH_ITEMS,
      });

      // Points spent come off the guest's balance with the order, or not at all.
      if (created.userId) await redeemPoints(tx, { ...created, userId: created.userId }, input.pointsRedeemed);

      await tx.orderStatusEvent.create({
        data: {
          orderId: created.id,
          fromStatus: null,
          toStatus: created.status,
          actorId: placedBy.id,
          actorName: placedBy.name,
        },
      });

      const order = toOrder(created);
      await recordAudit(tx, order, audit);
      return order;
    });
  }

  async getById(id: string): Promise<Order | null> {
    const row = await this.db.order.findUnique({ where: { id }, include: WITH_ITEMS });
    return row ? toOrder(row) : null;
  }

  async listForUser(userId: string): Promise<Order[]> {
    const rows = await this.db.order.findMany({
      where: { userId },
      orderBy: { placedAt: "desc" },
      include: WITH_ITEMS,
    });
    return rows.map(toOrder);
  }

  async listPage(filters: AdminOrderFilters, page: PageRequest<AdminOrderSort>): Promise<Page<Order>> {
    const where = adminWhere(filters);
    const { skip, take } = toSkipTake(page);
    const direction = page.direction ?? DEFAULT_ADMIN_ORDER_DIRECTION;
    const orderBy: Prisma.OrderOrderByWithRelationInput =
      page.sort === "total" ? { total: direction } : { placedAt: direction };

    // One transaction so the rows and the count come from the same snapshot.
    const [rows, total] = await inTransaction(this.db, (tx) =>
      Promise.all([tx.order.findMany({ where, orderBy, skip, take, include: WITH_ITEMS }), tx.order.count({ where })]),
    );
    return createPage(rows.map(toOrder), total, page);
  }

  async countByStatus(): Promise<OrderStatusCounts> {
    const groups = await this.db.order.groupBy({ by: ["status"], _count: { _all: true } });
    const counts = Object.fromEntries(ORDER_STATUSES.map((status) => [status, 0])) as Record<OrderStatus, number>;
    for (const group of groups) {
      const status = toStatus(group.status);
      counts[status] += group._count._all;
    }
    const active = ACTIVE_ORDER_STATUSES.reduce((sum, status) => sum + counts[status], 0);
    return { ...counts, active };
  }

  async transition(
    id: string,
    from: OrderStatus,
    to: OrderStatus,
    actor: ActivityActor,
    audit?: AuditHook<Order>,
    ledger?: LedgerHook<Order>,
  ): Promise<Order> {
    return inTransaction(this.db, async (tx) => {
      // Guarded on `from`: if someone else moved the order since it was read, no
      // row matches and this change is refused rather than overwriting theirs.
      const result = await tx.order.updateMany({ where: { id, status: from }, data: { status: to } });
      // A paid order that's cancelled has its money handed back.
      if (result.count > 0 && to === "cancelled") {
        await tx.order.updateMany({ where: { id, paymentStatus: "paid" }, data: { paymentStatus: "refunded" } });
      }
      if (result.count === 0) {
        const current = await tx.order.findUnique({ where: { id }, select: { status: true } });
        if (!current) throw new NotFoundError("order", id);
        throw new InvalidOrderTransitionError(toStatus(current.status), to);
      }

      // A completed order uses up its recipes' stock, at average cost; the lines
      // then carry that cost, which the cost-of-sales posting below books.
      if (to === "completed") await consumeStockForOrder(tx, id, cafeDayOf(new Date()), actor);
      // Completing means everything reached the guest: lines nobody ticked off are served now.
      if (to === "completed") {
        await tx.orderItem.updateMany({ where: { orderId: id, servedAt: null }, data: { servedAt: new Date() } });
      }

      const row = await tx.order.findUniqueOrThrow({ where: { id }, include: WITH_ITEMS });

      // The loyalty club: a completed order earns points on what was paid; a cancelled
      // one gives back the points it spent.
      if (to === "completed" && row.userId) {
        row.pointsEarned = (await earnPoints(tx, { ...row, userId: row.userId })) || row.pointsEarned;
      }
      if (to === "cancelled" && row.userId) await refundPoints(tx, { ...row, userId: row.userId });

      // A cancelled order's units go back on the shelf, in the same transaction —
      // counted items only: a made-to-order item took nothing, so gets nothing back.
      if (to === "cancelled") {
        for (const line of mergeLines(row.items)) {
          await tx.product.updateMany({
            where: { id: line.productId, madeToOrder: false },
            data: { stockQuantity: { increment: line.quantity } },
          });
        }
      }

      await tx.orderStatusEvent.create({
        data: { orderId: id, fromStatus: from, toStatus: to, actorId: actor.id, actorName: actor.name },
      });

      const order = toOrder(row);
      await recordAudit(tx, order, audit);
      await postHook(tx, order, ledger);
      return order;
    });
  }

  async setPaymentStatus(
    id: string,
    change: PaymentChange,
    audit?: AuditHook<Order>,
    ledger?: LedgerHook<Order>,
  ): Promise<Order> {
    return inTransaction(this.db, async (tx) => {
      // Guarded on the status staff saw: a double click or a second tab can't book
      // the same payment twice — and on the bill it was taken for, so a payment
      // can't land on lines changed meanwhile. Unmarking clears the method with the status.
      const parts = change.to === "paid" ? (change.parts ?? []) : [];
      const result = await tx.order.updateMany({
        where: { id, paymentStatus: change.from, ...(change.total === undefined ? {} : { total: change.total }) },
        data: {
          paymentStatus: change.to,
          paymentMethod: parts.length > 0 ? largestPaymentPart(parts).method : null,
        },
      });
      if (result.count === 0) {
        const current = await tx.order.findUnique({ where: { id }, select: { paymentStatus: true } });
        if (!current) throw new NotFoundError("order", id);
        if (current.paymentStatus === change.from) {
          throw new ConflictError("INVALID_TRANSITION", "The order's total changed before the payment landed.");
        }
        throw new ConflictError("INVALID_TRANSITION", `The payment is already ${current.paymentStatus}.`);
      }
      await tx.orderPaymentPart.deleteMany({ where: { orderId: id } });
      if (parts.length > 0) {
        await tx.orderPaymentPart.createMany({
          data: parts.map((part, position) => ({ orderId: id, method: part.method, amount: part.amount, position })),
        });
      }
      const order = toOrder(await tx.order.findUniqueOrThrow({ where: { id }, include: WITH_ITEMS }));
      await recordAudit(tx, order, audit);
      await postHook(tx, order, ledger);
      return order;
    });
  }

  async refund(
    input: NewOrderRefund,
    actor: ActivityActor,
    audit?: AuditHook<OrderRefundResult>,
    ledger?: LedgerHook<OrderRefundResult>,
  ): Promise<OrderRefundResult> {
    return inTransaction(this.db, async (tx) => {
      // Lock the order: two refunds of one line can't both pass the checks below.
      await tx.$queryRaw`SELECT "id" FROM "orders" WHERE "id" = ${input.orderId} FOR UPDATE`;
      const before = await tx.order.findUnique({ where: { id: input.orderId }, include: WITH_ITEMS });
      if (!before) throw new NotFoundError("order", input.orderId);
      if (before.status !== "completed" || before.paymentStatus !== "paid") {
        throw new ConflictError("INVALID_TRANSITION", "Only a completed, paid order can be refunded.");
      }
      for (const line of input.lines) {
        const item = before.items.find((candidate) => candidate.id === line.orderItemId);
        if (item?.refundedQuantity !== input.expectedRefunded[line.orderItemId]) {
          throw new ConflictError("INVALID_TRANSITION", "This order was refunded by someone else just now.");
        }
      }

      const row = await tx.orderRefund.create({
        data: {
          orderId: input.orderId,
          date: dayToDate(input.date),
          method: input.method,
          amount: input.amount,
          vatAmount: input.vatAmount,
          reason: input.reason ?? null,
          createdById: input.createdById,
          createdByName: input.createdByName,
          lines: {
            create: input.lines.map((line, position) => ({
              orderItemId: line.orderItemId,
              name: line.name,
              kind: line.kind,
              quantity: line.quantity,
              amount: line.amount,
              vatAmount: line.vatAmount,
              restocked: line.restocked,
              position,
            })),
          },
        },
        include: WITH_REFUND_LINES,
      });

      for (const line of input.lines) {
        await tx.orderItem.update({
          where: { id: line.orderItemId },
          data: { refundedQuantity: { increment: line.quantity } },
        });
      }
      const refundedTotal = before.refundedTotal + input.amount;
      const fully = refundedTotal >= before.total;
      await tx.order.update({
        where: { id: input.orderId },
        data: { refundedTotal, ...(fully ? { paymentStatus: "refunded" } : {}) },
      });

      // Back on the shelf: counted items only, like a cancellation.
      const restocked = input.lines.flatMap((line) => {
        const item = before.items.find((candidate) => candidate.id === line.orderItemId);
        return line.restocked && item ? [{ item, quantity: line.quantity }] : [];
      });
      // Stock items first, then the shelf: the order every stock write locks rows in
      // (a delivery locks a book's stock item, then moves its sale stock).
      const restockedValue = await returnStockForRefund(
        tx,
        restocked
          .filter(({ item }) => item.stockTracked)
          .map(({ item, quantity }) => ({ productId: item.productId, quantity, unitCost: item.unitCost ?? 0 })),
        input.date,
        input.orderId,
        actor,
      );
      for (const { item, quantity } of restocked) {
        await tx.product.updateMany({
          where: { id: item.productId, madeToOrder: false },
          data: { stockQuantity: { increment: quantity } },
        });
      }

      if (before.userId) {
        const guest = { ...before, userId: before.userId };
        await clawBackPoints(tx, guest, `refund:${row.id}`, pointsToClawBack(before, input.amount));
        if (fully) await refundPoints(tx, guest);
      }

      const order = toOrder(await tx.order.findUniqueOrThrow({ where: { id: input.orderId }, include: WITH_ITEMS }));
      const result: OrderRefundResult = { refund: toRefund(row), order, restockedValue };
      await recordAudit(tx, result, audit);
      await postHook(tx, result, ledger);
      return result;
    });
  }

  async listRefunds(orderId: string): Promise<OrderRefund[]> {
    const rows = await this.db.orderRefund.findMany({
      where: { orderId },
      orderBy: { number: "asc" },
      include: WITH_REFUND_LINES,
    });
    return rows.map(toRefund);
  }

  async writeOff(
    id: string,
    actor: ActivityActor,
    audit?: AuditHook<Order>,
    ledger?: LedgerHook<Order>,
  ): Promise<Order> {
    return inTransaction(this.db, async (tx) => {
      // Guarded on what made it writable: a payment that lands first wins, and this
      // is refused rather than cancelling an order that's now paid.
      const result = await tx.order.updateMany({
        where: { id, status: "completed", paymentStatus: "unpaid" },
        data: { status: "cancelled" },
      });
      if (result.count === 0) {
        const current = await tx.order.findUnique({ where: { id }, select: { id: true } });
        if (!current) throw new NotFoundError("order", id);
        throw new ConflictError("INVALID_TRANSITION", "Only a served order nobody paid for can be written off.");
      }

      const row = await tx.order.findUniqueOrThrow({ where: { id }, include: WITH_ITEMS });
      // Nothing goes back on the shelf: the goods were consumed. The points the
      // order earned go, as far as the guest still has them; those it spent stay spent.
      if (row.userId) await clawBackPoints(tx, { ...row, userId: row.userId }, "writeOff", row.pointsEarned);

      await tx.orderStatusEvent.create({
        data: { orderId: id, fromStatus: "completed", toStatus: "cancelled", actorId: actor.id, actorName: actor.name },
      });

      const order = toOrder(row);
      await recordAudit(tx, order, audit);
      await postHook(tx, order, ledger);
      return order;
    });
  }

  async setItemServed(orderId: string, itemId: string, served: boolean): Promise<Order> {
    return inTransaction(this.db, async (tx) => {
      // Guarded on the order's status in the same statement: a line can't be marked
      // after another tab completed or cancelled the order.
      await tx.orderItem.updateMany({
        where: {
          id: itemId,
          orderId,
          servedAt: served ? null : { not: null },
          order: { status: { in: [...SERVING_ORDER_STATUSES] } },
        },
        data: { servedAt: served ? new Date() : null },
      });
      const row = await tx.order.findUnique({ where: { id: orderId }, include: WITH_ITEMS });
      if (!row) throw new NotFoundError("order", orderId);
      if (!row.items.some((item) => item.id === itemId)) throw new NotFoundError("orderItem", itemId);
      const order = toOrder(row);
      if (!canServeItems(order.status)) {
        throw new ConflictError("INVALID_TRANSITION", `A ${order.status} order's items can't be marked served.`);
      }
      return order;
    });
  }

  async change(change: OrderChange, actor: ActivityActor, audit?: AuditHook<Order>): Promise<Order> {
    return inTransaction(this.db, async (tx) => {
      // Lock the order: a payment, a status move or another change racing this one
      // waits, then is judged against the order as this leaves it.
      await tx.$queryRaw`SELECT "id" FROM "orders" WHERE "id" = ${change.orderId} FOR UPDATE`;
      const before = await tx.order.findUnique({ where: { id: change.orderId }, include: WITH_ITEMS });
      if (!before) throw new NotFoundError("order", change.orderId);
      // Every write to the order moves `updated_at`: if it moved since the use-case
      // read it, someone else changed it, and this change was worked out from a stale copy.
      if (
        before.updatedAt.toISOString() !== change.expected.updatedAt ||
        before.status !== change.expected.status ||
        before.paymentStatus !== change.expected.paymentStatus
      ) {
        throw new ConflictError("INVALID_TRANSITION", "This order was changed by someone else just now.");
      }

      // Lines lowered or taken off, guarded on the quantity read and on not being
      // served: a tick from the bar (which doesn't touch the order row) that landed
      // meanwhile wins, and the line stays.
      const returned: { productId: string; name: string; quantity: number }[] = [];
      for (const line of change.lower) {
        const where = { id: line.itemId, orderId: change.orderId, quantity: line.from, servedAt: null };
        const result =
          line.to === 0
            ? await tx.orderItem.deleteMany({ where })
            : await tx.orderItem.updateMany({ where, data: { quantity: line.to } });
        const item = before.items.find((candidate) => candidate.id === line.itemId);
        if (result.count === 0 || !item) {
          if (item?.servedAt || (await tx.orderItem.findUnique({ where: { id: line.itemId } }))?.servedAt) {
            throw new ConflictError("ITEM_SERVED", "That line went out to the guest just now.");
          }
          throw new ConflictError("INVALID_TRANSITION", "This order was changed by someone else just now.");
        }
        returned.push({ productId: item.productId, name: item.name, quantity: line.to - line.from });
      }

      // The shelf follows the lines: units taken off go back, a new round takes its own.
      await moveShelfStock(tx, [...returned, ...change.add]);

      const now = new Date();
      const next = before.items.reduce((most, item) => Math.max(most, item.position + 1), 0);
      if (change.add.length > 0) {
        await tx.orderItem.createMany({
          data: change.add.map((item, index) => ({
            orderId: change.orderId,
            productId: item.productId,
            kind: item.kind,
            name: item.name,
            imageUrl: item.imageUrl,
            unitPrice: item.unitPrice,
            unitCost: item.unitCost ?? null,
            taxExempt: item.taxExempt ?? false,
            quantity: item.quantity,
            note: item.note ?? null,
            position: next + index,
            addedAt: now,
          })),
        });
      }

      await tx.order.update({
        where: { id: change.orderId },
        data: {
          serviceType: change.serviceType,
          tableLabel: change.tableLabel ?? null,
          changedAt: now,
          ...(change.amounts
            ? {
                subtotal: change.amounts.subtotal,
                promoDiscount: change.amounts.promoDiscount,
                pointsDiscount: change.amounts.pointsDiscount,
                total: change.amounts.total,
              }
            : {}),
        },
      });

      await tx.orderStatusEvent.create({
        data: {
          orderId: change.orderId,
          kind: "changed",
          fromStatus: before.status,
          toStatus: before.status,
          actorId: actor.id,
          actorName: actor.name,
        },
      });

      const order = toOrder(await tx.order.findUniqueOrThrow({ where: { id: change.orderId }, include: WITH_ITEMS }));
      await recordAudit(tx, order, audit);
      return order;
    });
  }

  async listStatusEvents(orderId: string): Promise<OrderStatusEvent[]> {
    const rows = await this.db.orderStatusEvent.findMany({ where: { orderId }, orderBy: { createdAt: "asc" } });
    return rows.map((row) => ({
      id: row.id,
      orderId: row.orderId,
      kind: row.kind === "changed" ? "changed" : "status",
      from: row.fromStatus == null ? null : toStatus(row.fromStatus),
      to: toStatus(row.toStatus),
      actorId: row.actorId,
      actorName: row.actorName,
      at: row.createdAt.toISOString(),
    }));
  }
}

/**
 * Take counted items' units off the shelf (a positive `quantity`) or put them back
 * (a negative one), netted per item. Taking is a guarded decrement: the guard and
 * the write are one statement, so two orders can't both take the last slice. Lines
 * are merged per item and sorted by id so concurrent orders lock rows in the same
 * order and can't deadlock each other. Made-to-order items aren't counted, so
 * they're neither checked nor moved — the guard leaves them out, and the flag is
 * re-read here, in the transaction, to tell one from a shortfall. A shortfall throws
 * `InsufficientStockError` naming every short line, which aborts the caller's
 * transaction, so units already moved roll back.
 */
async function moveShelfStock(
  tx: Prisma.TransactionClient,
  lines: readonly { productId: string; name: string; quantity: number }[],
): Promise<void> {
  const shortfalls: StockShortfall[] = [];
  for (const line of mergeLines(lines)) {
    if (line.quantity < 0) {
      await tx.product.updateMany({
        where: { id: line.productId, madeToOrder: false },
        data: { stockQuantity: { increment: -line.quantity } },
      });
      continue;
    }
    if (line.quantity === 0) continue;
    const result = await tx.product.updateMany({
      where: { id: line.productId, madeToOrder: false, stockQuantity: { gte: line.quantity } },
      data: { stockQuantity: { decrement: line.quantity } },
    });
    if (result.count === 0) {
      const current = await tx.product.findUnique({
        where: { id: line.productId },
        select: { stockQuantity: true, madeToOrder: true },
      });
      if (current?.madeToOrder) continue;
      shortfalls.push({
        productId: line.productId,
        name: line.name,
        available: current?.stockQuantity ?? 0,
        requested: line.quantity,
      });
    }
  }
  if (shortfalls.length > 0) throw new InsufficientStockError(shortfalls);
}

/** Collapse lines to one per item, sorted by id — one lock per row, always in the same order. */
function mergeLines<T extends { productId: string; name: string; quantity: number }>(
  lines: readonly T[],
): { productId: string; name: string; quantity: number }[] {
  const byProduct = new Map<string, { productId: string; name: string; quantity: number }>();
  for (const line of lines) {
    const existing = byProduct.get(line.productId);
    if (existing) existing.quantity += line.quantity;
    else byProduct.set(line.productId, { productId: line.productId, name: line.name, quantity: line.quantity });
  }
  return [...byProduct.values()].sort((a, b) => a.productId.localeCompare(b.productId));
}

/**
 * Take one use of a promo code for this guest, refusing it when the code's overall
 * or per-guest limit is already reached by live (not cancelled) orders. Serialized
 * per code, so the count can't race — nor with staff archiving or deleting the code.
 */
async function claimPromoUse(tx: Prisma.TransactionClient, promoCodeId: string, userId: string): Promise<void> {
  await lockPromoCode(tx, promoCodeId);
  const promo = await tx.promoCode.findUnique({
    where: { id: promoCodeId },
    select: { isActive: true, archivedAt: true, usageLimit: true, perGuestLimit: true },
  });
  if (!promo?.isActive || promo.archivedAt) {
    throw new ConflictError("PROMO_INVALID", "That promo code is no longer active.");
  }
  const live = { promoCodeId, status: { not: "cancelled" } } satisfies Prisma.OrderWhereInput;
  if (promo.usageLimit !== null && (await tx.order.count({ where: live })) >= promo.usageLimit) {
    throw new ConflictError("PROMO_USED_UP", "That promo code has been used up.");
  }
  if (promo.perGuestLimit !== null && (await tx.order.count({ where: { ...live, userId } })) >= promo.perGuestLimit) {
    throw new ConflictError("PROMO_USED_UP", "You've already used that promo code.");
  }
}

/** `WHERE` for the dashboard list. An empty filter matches every order. */
function adminWhere(filters: AdminOrderFilters): Prisma.OrderWhereInput {
  const and: Prisma.OrderWhereInput[] = [];

  if (filters.query) {
    const or: Prisma.OrderWhereInput[] = [
      { tableLabel: { contains: filters.query, mode: "insensitive" } },
      { customerName: { contains: filters.query, mode: "insensitive" } },
      { customerPhone: { contains: filters.query } },
    ];
    // "42" or "#42" finds order 42 exactly.
    const number = Number(filters.query.replace(/^#/, ""));
    if (Number.isInteger(number) && number > 0) or.push({ orderNumber: number });
    and.push({ OR: or });
  }

  if (filters.status === "active") and.push({ status: { in: [...ACTIVE_ORDER_STATUSES] } });
  else if (filters.status) and.push({ status: filters.status });

  if (filters.serviceType) and.push({ serviceType: filters.serviceType });
  // "Unpaid" is what's still owed: a cancelled order owes nothing, whether it was
  // called off before it was served or written off after.
  if (filters.paymentStatus === "unpaid") and.push({ paymentStatus: "unpaid", status: { not: "cancelled" } });
  else if (filters.paymentStatus) and.push({ paymentStatus: filters.paymentStatus });

  return and.length ? { AND: and } : {};
}

/** Narrowing for stored strings; an unknown value falls back rather than failing the whole list. */
function toStatus(value: string): OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value) ? (value as OrderStatus) : "pending";
}

function toServiceType(value: string): ServiceType {
  return (SERVICE_TYPES as readonly string[]).includes(value) ? (value as ServiceType) : "takeaway";
}

function toPaymentStatus(value: string): PaymentStatus {
  return (PAYMENT_STATUSES as readonly string[]).includes(value) ? (value as PaymentStatus) : "unpaid";
}

function toPaymentMethod(value: string | null): PaymentMethod | undefined {
  return value && (PAYMENT_METHODS as readonly string[]).includes(value) ? (value as PaymentMethod) : undefined;
}

function toKind(value: string): ProductKind {
  return (PRODUCT_KINDS as readonly string[]).includes(value) ? (value as ProductKind) : "drink";
}

function toRefund(row: RefundRow): OrderRefund {
  return {
    id: row.id,
    number: row.number,
    orderId: row.orderId,
    date: dateToDay(row.date),
    method: toPaymentMethod(row.method) ?? "cash",
    amount: row.amount,
    vatAmount: row.vatAmount,
    reason: row.reason ?? undefined,
    lines: row.lines.map((line) => ({
      orderItemId: line.orderItemId,
      name: line.name,
      kind: toKind(line.kind),
      quantity: line.quantity,
      amount: line.amount,
      vatAmount: line.vatAmount,
      restocked: line.restocked,
    })),
    createdById: row.createdById,
    createdByName: row.createdByName,
    createdAt: row.createdAt.toISOString(),
  };
}

function toOrder(row: OrderRow): Order {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    userId: row.userId ?? undefined,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    status: toStatus(row.status),
    serviceType: toServiceType(row.serviceType),
    tableLabel: row.tableLabel ?? undefined,
    note: row.note ?? undefined,
    paymentStatus: toPaymentStatus(row.paymentStatus),
    paymentMethod: toPaymentMethod(row.paymentMethod),
    paymentParts: row.paymentParts.flatMap((part) => {
      const method = toPaymentMethod(part.method);
      return method ? [{ method, amount: part.amount }] : [];
    }),
    refundedTotal: row.refundedTotal,
    items: row.items.map((item): OrderItem => ({
      id: item.id,
      productId: item.productId,
      kind: toKind(item.kind),
      name: item.name,
      imageUrl: item.imageUrl,
      unitPrice: item.unitPrice,
      unitCost: item.unitCost ?? undefined,
      taxExempt: item.taxExempt,
      stockTracked: item.stockTracked,
      quantity: item.quantity,
      refundedQuantity: item.refundedQuantity,
      note: item.note ?? undefined,
      servedAt: item.servedAt?.toISOString(),
      addedAt: item.addedAt?.toISOString(),
    })),
    subtotal: row.subtotal,
    promoCode: row.promoCode ?? undefined,
    promoCodeId: row.promoCodeId ?? undefined,
    promoDiscount: row.promoDiscount,
    pointsRedeemed: row.pointsRedeemed,
    pointsDiscount: row.pointsDiscount,
    pointsEarned: row.pointsEarned,
    total: row.total,
    placedAt: row.placedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    changedAt: row.changedAt?.toISOString(),
  };
}
