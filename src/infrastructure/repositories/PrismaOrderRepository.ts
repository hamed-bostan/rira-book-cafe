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
  type Order,
  type OrderItem,
  type OrderStatus,
  type PaymentMethod,
  type PaymentStatus,
  type ServiceType,
} from "@/src/domain/entities/Order";
import type { OrderStatusEvent } from "@/src/domain/entities/OrderStatusEvent";
import { createPage, toSkipTake, type Page, type PageRequest } from "@/src/domain/entities/Pagination";
import { PRODUCT_KINDS, type ProductKind } from "@/src/domain/entities/Product";
import { ConflictError } from "@/src/domain/errors/ConflictError";
import { InsufficientStockError, type StockShortfall } from "@/src/domain/errors/InsufficientStockError";
import { InvalidOrderTransitionError } from "@/src/domain/errors/InvalidOrderTransitionError";
import { NotFoundError } from "@/src/domain/errors/NotFoundError";
import type { AuditHook } from "@/src/domain/repositories/AuditHook";
import type { LedgerHook } from "@/src/domain/repositories/ILedgerRepository";
import type { IOrderRepository, NewOrder, PaymentChange } from "@/src/domain/repositories/IOrderRepository";
import { prisma } from "@/src/infrastructure/prisma/client";
import { type Prisma } from "@/src/infrastructure/prisma/generated/client";
import { inTransaction, type PrismaDb } from "@/src/infrastructure/prisma/transaction";

import { recordAudit } from "./writeActivityEntry";
import { postHook } from "./writeJournal";
import { earnPoints, redeemPoints, refundPoints } from "./writeLoyalty";
import { consumeStockForOrder } from "./writeStock";

/** Every read loads the lines with the order, in the order the guest listed them. */
const WITH_ITEMS = { items: { orderBy: { position: "asc" } } } satisfies Prisma.OrderInclude;

type OrderRow = Prisma.OrderGetPayload<{ include: typeof WITH_ITEMS }>;

/**
 * Orders backed by PostgreSQL via Prisma. Server-side only, bound through the
 * container — never imported by client code.
 */
export class PrismaOrderRepository implements IOrderRepository {
  constructor(private readonly db: PrismaDb = prisma) {}

  async place(input: NewOrder, placedBy: ActivityActor): Promise<Order> {
    return inTransaction(this.db, async (tx) => {
      // Take the units first, each with a guarded decrement: the guard and the
      // write are one statement, so two orders can't both take the last slice.
      // Lines are merged per item and sorted by id so concurrent orders lock rows
      // in the same order and can't deadlock each other. Made-to-order items aren't
      // counted, so they're neither checked nor taken — the guard leaves them out,
      // and the flag is re-read here, in the transaction, to tell one from a shortfall.
      const shortfalls: StockShortfall[] = [];
      for (const line of mergeLines(input.items)) {
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
      // Throwing aborts the transaction, so decrements already applied roll back.
      if (shortfalls.length > 0) throw new InsufficientStockError(shortfalls);

      // The code's limits are re-checked here, under its lock: the use-case priced the
      // order, but two guests racing for the last use must not both get it.
      if (input.promoCodeId) await claimPromoUse(tx, input.promoCodeId, input.userId);

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
      await redeemPoints(tx, created, input.pointsRedeemed);

      await tx.orderStatusEvent.create({
        data: {
          orderId: created.id,
          fromStatus: null,
          toStatus: created.status,
          actorId: placedBy.id,
          actorName: placedBy.name,
        },
      });

      return toOrder(created);
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
      if (to === "completed") row.pointsEarned = (await earnPoints(tx, row)) || row.pointsEarned;
      if (to === "cancelled") await refundPoints(tx, row);

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
      // the same payment twice. Unmarking clears the method with the status.
      const result = await tx.order.updateMany({
        where: { id, paymentStatus: change.from },
        data: { paymentStatus: change.to, paymentMethod: change.to === "paid" ? (change.method ?? null) : null },
      });
      if (result.count === 0) {
        const current = await tx.order.findUnique({ where: { id }, select: { paymentStatus: true } });
        if (!current) throw new NotFoundError("order", id);
        throw new ConflictError("INVALID_TRANSITION", `The payment is already ${current.paymentStatus}.`);
      }
      const order = toOrder(await tx.order.findUniqueOrThrow({ where: { id }, include: WITH_ITEMS }));
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

  async listStatusEvents(orderId: string): Promise<OrderStatusEvent[]> {
    const rows = await this.db.orderStatusEvent.findMany({ where: { orderId }, orderBy: { createdAt: "asc" } });
    return rows.map((row) => ({
      id: row.id,
      orderId: row.orderId,
      from: row.fromStatus == null ? null : toStatus(row.fromStatus),
      to: toStatus(row.toStatus),
      actorId: row.actorId,
      actorName: row.actorName,
      at: row.createdAt.toISOString(),
    }));
  }
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
 * per code, so the count can't race.
 */
async function claimPromoUse(tx: Prisma.TransactionClient, promoCodeId: string, userId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`promo:${promoCodeId}`}))`;
  const promo = await tx.promoCode.findUnique({
    where: { id: promoCodeId },
    select: { isActive: true, usageLimit: true, perGuestLimit: true },
  });
  if (!promo?.isActive) throw new ConflictError("PROMO_INVALID", "That promo code is no longer active.");
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
  if (filters.paymentStatus) and.push({ paymentStatus: filters.paymentStatus });

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

function toOrder(row: OrderRow): Order {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    userId: row.userId,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    status: toStatus(row.status),
    serviceType: toServiceType(row.serviceType),
    tableLabel: row.tableLabel ?? undefined,
    note: row.note ?? undefined,
    paymentStatus: toPaymentStatus(row.paymentStatus),
    paymentMethod: toPaymentMethod(row.paymentMethod),
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
      note: item.note ?? undefined,
      servedAt: item.servedAt?.toISOString(),
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
  };
}
