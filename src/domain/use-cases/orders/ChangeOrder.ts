import { diffFields, type ActivityActor, type ActivityChange } from "../../entities/ActivityEntry";
import {
  MAX_ORDER_AMOUNT,
  MAX_ORDER_LINES,
  MAX_TABLE_LABEL_LENGTH,
  canChangeOrderLines,
  canChangeOrderService,
  canLowerOrderItem,
  orderSubtotal,
  type Order,
  type OrderItem,
  type ServiceType,
} from "../../entities/Order";
import { ConflictError } from "../../errors/ConflictError";
import { NotFoundError } from "../../errors/NotFoundError";
import { ValidationError } from "../../errors/ValidationError";
import { orderChangedNotification } from "../notifications/guestNotifications";

import { CheckoutPricing, checkoutLines } from "./CheckoutPricing";
import { buildOrderLines, type PlaceOrderInput } from "./PlaceOrder";

import type { ICustomerNotifier } from "../../repositories/INotificationRepository";
import type { IOrderRepository, OrderChange } from "../../repositories/IOrderRepository";
import type { MenuCatalog } from "../products/publicMenu";

/** What staff change on an order already placed. Every part is optional; what's left out stays. */
export type ChangeOrderInput = {
  /** The order's `updatedAt` as staff saw it: the change is refused if the order moved since. */
  version?: string;
  /** A second round: new lines from the menu, each with its own note. */
  add?: PlaceOrderInput["items"];
  /**
   * New quantities for lines already on the order, by line id. Lower only — more of
   * an item is a new line, so the bar sees it as new — and `0` takes the line off.
   */
  lines?: { itemId: string; quantity: number }[];
  serviceType?: ServiceType;
  /** The table, for dine-in; left out keeps the one it has. */
  tableLabel?: string;
};

/**
 * Change an order after it was placed, on behalf of staff: add a round, lower or
 * take off a line, move it to another table or change how it's served.
 *
 * The rules are the order's own (`Order.ts`): lines change only while it's being
 * worked and nothing is paid, the table and service until it's served, and a line
 * that went out to the guest stays. A change that would leave nothing on it is
 * refused — that's a cancellation. The new lines are priced from the menu exactly
 * as placing prices them (`buildOrderLines`), and the order is re-priced by
 * `CheckoutPricing.reprice`, which refuses what its promo code or the points it
 * spent can't price.
 *
 * Like a status change, the repository is handed the order as it was read, so a
 * change someone else made meanwhile fails rather than being overwritten — and a
 * caller that passes the `version` it showed staff fails the same way if anything
 * moved before they pressed save. The guest is told once it's in.
 */
export class ChangeOrder {
  constructor(
    private readonly orderRepo: IOrderRepository,
    private readonly menu: MenuCatalog,
    private readonly pricing: CheckoutPricing = new CheckoutPricing(),
    /** Tells the guest their order was updated. */
    private readonly notifier?: ICustomerNotifier,
  ) {}

  async execute(
    orderId: string,
    input: ChangeOrderInput,
    actor: ActivityActor,
    now: Date = new Date(),
  ): Promise<Order> {
    const order = await this.orderRepo.getById(orderId);
    if (!order) throw new NotFoundError("order", orderId);
    if (input.version !== undefined && input.version !== order.updatedAt) {
      throw new ConflictError("INVALID_TRANSITION", "This order was changed by someone else just now.");
    }

    const serviceType = input.serviceType ?? order.serviceType;
    const tableLabel = serviceType === "dineIn" ? input.tableLabel?.trim() || order.tableLabel : undefined;
    const serviceChanged = serviceType !== order.serviceType || tableLabel !== order.tableLabel;
    const linesAsked =
      (input.add?.length ?? 0) > 0 ||
      (input.lines ?? []).some(
        (line) => order.items.find((item) => item.id === line.itemId)?.quantity !== line.quantity,
      );
    // Setting what it already has changes nothing.
    if (!serviceChanged && !linesAsked) return order;

    if (!canChangeOrderService(order)) {
      throw new ConflictError("ORDER_CLOSED", `A ${order.status} order can't be changed.`);
    }
    if (linesAsked && !canChangeOrderLines(order)) {
      throw new ConflictError(
        "ORDER_LINES_LOCKED",
        "Only an unpaid order that's still being made can change its items.",
      );
    }
    if (serviceType === "dineIn" && !tableLabel) {
      throw new ValidationError("tableLabel", "tableRequired");
    }
    if (tableLabel && tableLabel.length > MAX_TABLE_LABEL_LENGTH) {
      throw new ValidationError("tableLabel", "That table label is too long.");
    }

    const lower = loweredLines(order, input.lines ?? []);
    const add = input.add?.length ? await buildOrderLines(this.menu, input.add) : [];
    const change: OrderChange = {
      orderId,
      expected: { updatedAt: order.updatedAt, status: order.status, paymentStatus: order.paymentStatus },
      lower,
      add,
      serviceType,
      tableLabel,
    };

    // Moving between dine-in and takeaway moves the service charge with it — while
    // the bill is still open. Once it's paid, the charge stays as it was settled.
    const chargeMoves = serviceType !== order.serviceType && order.serviceChargeBps > 0 && canChangeOrderLines(order);
    if (lower.length > 0 || add.length > 0 || chargeMoves) {
      const kept = order.items.flatMap((item) => {
        const quantity = lower.find((line) => line.itemId === item.id)?.to ?? item.quantity;
        return quantity > 0 ? [{ productId: item.productId, unitPrice: item.unitPrice, quantity }] : [];
      });
      if (kept.length + add.length === 0) {
        throw new ConflictError("ORDER_EMPTY", "That would leave nothing on the order; cancel it instead.");
      }
      if (kept.length + add.length > MAX_ORDER_LINES) throw new ValidationError("add", "itemsTooMany");
      const subtotal = orderSubtotal(kept) + orderSubtotal(add);
      if (subtotal > MAX_ORDER_AMOUNT) throw new ValidationError("add", "quantityMax");
      const priced = await this.pricing.reprice(order, subtotal, now, checkoutLines([...kept, ...add]), serviceType);
      change.amounts = {
        subtotal: priced.subtotal,
        promoDiscount: priced.promoDiscount,
        pointsDiscount: priced.pointsDiscount,
        serviceCharge: priced.serviceCharge,
        total: priced.total,
      };
    }

    const saved = await this.orderRepo.change(change, actor, (after) => ({
      actorId: actor.id,
      actorName: actor.name,
      action: "order.changed",
      entityType: "order",
      entityId: after.id,
      entityLabel: `#${after.orderNumber}`,
      changes: orderChangeDiff(order, after),
    }));

    const notification = orderChangedNotification(saved);
    if (notification && this.notifier) await this.notifier.notify(notification);
    return saved;
  }
}

/**
 * The lines staff asked to lower or take off, checked against the order: each one
 * on it, once, lowered rather than raised, and not yet served. Lines asked at the
 * quantity they already have are left out.
 */
function loweredLines(order: Order, lines: readonly { itemId: string; quantity: number }[]): OrderChange["lower"] {
  if (new Set(lines.map((line) => line.itemId)).size !== lines.length) {
    throw new ValidationError("lines", "lineDuplicate");
  }
  return lines.flatMap((line) => {
    const item = order.items.find((candidate) => candidate.id === line.itemId);
    if (!item) throw new NotFoundError("orderItem", line.itemId);
    if (!Number.isInteger(line.quantity) || line.quantity < 0) throw new ValidationError("lines", "quantityWhole");
    if (line.quantity === item.quantity) return [];
    if (line.quantity > item.quantity) throw new ValidationError("lines", "lineRaise");
    if (!canLowerOrderItem(item)) {
      throw new ConflictError("ITEM_SERVED", `${item.name} was already served, so it stays on the order.`);
    }
    return [{ itemId: item.id, from: item.quantity, to: line.quantity }];
  });
}

/** "2× Latte" — how a line reads in the activity log. */
function lineText(item: Pick<OrderItem, "quantity" | "name" | "note">, withNote = false): string {
  return `${item.quantity}× ${item.name}${withNote && item.note ? ` (${item.note})` : ""}`;
}

/**
 * What a change did to the order, for the activity log: the lines added, lowered
 * and taken off, then the service, the table and the total where they moved.
 */
export function orderChangeDiff(before: Order, after: Order): ActivityChange[] {
  const afterById = new Map(after.items.map((item) => [item.id, item]));
  const beforeIds = new Set(before.items.map((item) => item.id));
  const added = after.items.filter((item) => !beforeIds.has(item.id));
  const removed = before.items.filter((item) => !afterById.has(item.id));
  const lowered = before.items.flatMap((item) => {
    const now = afterById.get(item.id);
    return now && now.quantity !== item.quantity ? [{ was: item, now }] : [];
  });

  const changes: ActivityChange[] = [];
  if (added.length > 0) {
    changes.push({ field: "linesAdded", before: null, after: added.map((item) => lineText(item, true)).join(", ") });
  }
  if (lowered.length > 0) {
    changes.push({
      field: "quantities",
      before: lowered.map(({ was }) => lineText(was)).join(", "),
      after: lowered.map(({ now }) => lineText(now)).join(", "),
    });
  }
  if (removed.length > 0) {
    changes.push({ field: "linesRemoved", before: removed.map((item) => lineText(item)).join(", "), after: null });
  }
  return [
    ...changes,
    ...diffFields(
      { serviceType: before.serviceType, tableLabel: before.tableLabel, total: before.total },
      { serviceType: after.serviceType, tableLabel: after.tableLabel, total: after.total },
    ),
  ];
}
