import {
  type DailySales,
  type DateRange,
  type GuestReport,
  type HourlySales,
  type KindSales,
  type MethodPayments,
  type PaymentSummary,
  type SalesSummary,
  type TopGuest,
  type TopItem,
  type TopItemSort,
  type UnpaidOrder,
} from "@/src/domain/entities/Analytics";
import { CAFE_TIME_ZONE } from "@/src/domain/entities/CafeTime";
import {
  ACTIVE_ORDER_STATUSES,
  PAYMENT_METHODS,
  SERVICE_TYPES,
  type PaymentMethod,
  type ServiceType,
} from "@/src/domain/entities/Order";
import { PRODUCT_KINDS, type ProductKind } from "@/src/domain/entities/Product";
import type { IAnalyticsRepository } from "@/src/domain/repositories/IAnalyticsRepository";
import { prisma } from "@/src/infrastructure/prisma/client";
import { Prisma } from "@/src/infrastructure/prisma/generated/client";

/**
 * Store aggregates computed in PostgreSQL. Timestamps are stored as UTC
 * (`timestamp without time zone`); every day/hour bucket converts to the cafe's
 * clock first, so "Tuesday" and "8 am" mean what they mean at the counter.
 *
 * Aggregates come back as `bigint` from Postgres and are narrowed with `Number()`
 * — Toman totals stay far below 2^53.
 */
export class PrismaAnalyticsRepository implements IAnalyticsRepository {
  async salesSummary(range: DateRange): Promise<SalesSummary> {
    const [orders] = await prisma.$queryRaw<
      { orders: bigint; revenue: bigint | null; cancelled: bigint; cancelled_value: bigint | null }[]
    >`
      SELECT
        COUNT(*) FILTER (WHERE status = 'completed') AS orders,
        SUM(total) FILTER (WHERE status = 'completed') AS revenue,
        COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
        SUM(total) FILTER (WHERE status = 'cancelled') AS cancelled_value
      FROM orders
      WHERE placed_at >= ${range.from} AND placed_at < ${range.to}`;
    const [items] = await prisma.$queryRaw<{ items: bigint | null }[]>`
      SELECT SUM(oi.quantity) AS items
      FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.status = 'completed' AND o.placed_at >= ${range.from} AND o.placed_at < ${range.to}`;

    const count = Number(orders?.orders ?? 0);
    const revenue = Number(orders?.revenue ?? 0);
    return {
      revenue,
      orders: count,
      itemsSold: Number(items?.items ?? 0),
      averageOrderValue: count > 0 ? Math.round(revenue / count) : 0,
      cancelledOrders: Number(orders?.cancelled ?? 0),
      cancelledValue: Number(orders?.cancelled_value ?? 0),
    };
  }

  async dailySales(range: DateRange): Promise<DailySales[]> {
    const rows = await prisma.$queryRaw<{ day: string; orders: bigint; revenue: bigint | null }[]>`
      SELECT
        to_char(${localTime(Prisma.sql`placed_at`)}, 'YYYY-MM-DD') AS day,
        COUNT(*) AS orders,
        SUM(total) AS revenue
      FROM orders
      WHERE status = 'completed' AND placed_at >= ${range.from} AND placed_at < ${range.to}
      GROUP BY 1
      ORDER BY 1`;
    return rows.map((row) => ({ day: row.day, orders: Number(row.orders), revenue: Number(row.revenue ?? 0) }));
  }

  async hourlySales(range: DateRange): Promise<HourlySales[]> {
    const rows = await prisma.$queryRaw<{ hour: number; orders: bigint; revenue: bigint | null }[]>`
      SELECT
        EXTRACT(HOUR FROM ${localTime(Prisma.sql`placed_at`)})::int AS hour,
        COUNT(*) AS orders,
        SUM(total) AS revenue
      FROM orders
      WHERE status = 'completed' AND placed_at >= ${range.from} AND placed_at < ${range.to}
      GROUP BY 1
      ORDER BY 1`;
    return rows.map((row) => ({
      hour: Number(row.hour),
      orders: Number(row.orders),
      revenue: Number(row.revenue ?? 0),
    }));
  }

  async salesByKind(range: DateRange): Promise<KindSales[]> {
    const rows = await prisma.$queryRaw<{ kind: string; revenue: bigint | null; quantity: bigint | null }[]>`
      SELECT oi.kind, SUM(oi.unit_price * oi.quantity) AS revenue, SUM(oi.quantity) AS quantity
      FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.status = 'completed' AND o.placed_at >= ${range.from} AND o.placed_at < ${range.to}
      GROUP BY oi.kind
      ORDER BY revenue DESC`;
    return rows.map((row) => ({
      kind: toKind(row.kind),
      revenue: Number(row.revenue ?? 0),
      quantity: Number(row.quantity ?? 0),
    }));
  }

  async topItems(range: DateRange, sort: TopItemSort, limit: number): Promise<TopItem[]> {
    // Grouped by product, labelled with the most recent name it sold under — a
    // renamed item stays one row.
    const orderBy =
      sort === "quantity" ? Prisma.sql`quantity DESC, revenue DESC` : Prisma.sql`revenue DESC, quantity DESC`;
    const rows = await prisma.$queryRaw<
      { product_id: string; name: string; kind: string; quantity: bigint | null; revenue: bigint | null }[]
    >`
      SELECT
        oi.product_id,
        (array_agg(oi.name ORDER BY o.placed_at DESC))[1] AS name,
        (array_agg(oi.kind ORDER BY o.placed_at DESC))[1] AS kind,
        SUM(oi.quantity) AS quantity,
        SUM(oi.unit_price * oi.quantity) AS revenue
      FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.status = 'completed' AND o.placed_at >= ${range.from} AND o.placed_at < ${range.to}
      GROUP BY oi.product_id
      ORDER BY ${orderBy}
      LIMIT ${limit}`;
    return rows.map((row) => ({
      productId: row.product_id,
      name: row.name,
      kind: toKind(row.kind),
      quantity: Number(row.quantity ?? 0),
      revenue: Number(row.revenue ?? 0),
    }));
  }

  async paymentSummary(range: DateRange): Promise<PaymentSummary> {
    const [row] = await prisma.$queryRaw<
      { paid: bigint; paid_value: bigint | null; unpaid: bigint; unpaid_value: bigint | null }[]
    >`
      SELECT
        COUNT(*) FILTER (WHERE payment_status = 'paid') AS paid,
        SUM(total) FILTER (WHERE payment_status = 'paid') AS paid_value,
        COUNT(*) FILTER (WHERE payment_status = 'unpaid') AS unpaid,
        SUM(total) FILTER (WHERE payment_status = 'unpaid') AS unpaid_value
      FROM orders
      WHERE status = 'completed' AND placed_at >= ${range.from} AND placed_at < ${range.to}`;
    return {
      paidOrders: Number(row?.paid ?? 0),
      paidValue: Number(row?.paid_value ?? 0),
      unpaidOrders: Number(row?.unpaid ?? 0),
      unpaidValue: Number(row?.unpaid_value ?? 0),
    };
  }

  async paidByMethod(range: DateRange): Promise<MethodPayments[]> {
    const rows = await prisma.$queryRaw<{ method: string; orders: bigint; value: bigint | null }[]>`
      SELECT payment_method AS method, COUNT(*) AS orders, SUM(total) AS value
      FROM orders
      WHERE status = 'completed' AND payment_status = 'paid' AND payment_method IS NOT NULL
        AND placed_at >= ${range.from} AND placed_at < ${range.to}
      GROUP BY payment_method
      ORDER BY value DESC`;
    return rows.flatMap((row) =>
      isPaymentMethod(row.method)
        ? [{ method: row.method, orders: Number(row.orders), value: Number(row.value ?? 0) }]
        : [],
    );
  }

  async unpaidOrders(range: DateRange, limit: number): Promise<UnpaidOrder[]> {
    const rows = await prisma.order.findMany({
      where: {
        paymentStatus: "unpaid",
        status: "completed",
        placedAt: { gte: range.from, lt: range.to },
      },
      orderBy: { placedAt: "asc" },
      take: limit,
      select: { id: true, orderNumber: true, serviceType: true, tableLabel: true, total: true, placedAt: true },
    });
    return rows.map((row) => ({
      id: row.id,
      orderNumber: row.orderNumber,
      serviceType: toServiceType(row.serviceType),
      ...(row.tableLabel ? { tableLabel: row.tableLabel } : {}),
      total: row.total,
      placedAt: row.placedAt.toISOString(),
    }));
  }

  async guestCounts(
    range: DateRange,
  ): Promise<Pick<GuestReport, "guests" | "newGuests" | "returningGuests" | "repeatRate">> {
    // A guest is "new" when their first completed order ever falls inside the range.
    const [row] = await prisma.$queryRaw<{ guests: bigint; new_guests: bigint; repeaters: bigint }[]>`
      WITH in_range AS (
        SELECT user_id, COUNT(*) AS orders
        FROM orders
        WHERE status = 'completed' AND placed_at >= ${range.from} AND placed_at < ${range.to}
        GROUP BY user_id
      ),
      first_order AS (
        SELECT user_id, MIN(placed_at) AS first_at
        FROM orders
        WHERE status = 'completed' AND user_id IN (SELECT user_id FROM in_range)
        GROUP BY user_id
      )
      SELECT
        COUNT(*) AS guests,
        COUNT(*) FILTER (WHERE f.first_at >= ${range.from}) AS new_guests,
        COUNT(*) FILTER (WHERE r.orders >= 2) AS repeaters
      FROM in_range r JOIN first_order f USING (user_id)`;
    const guests = Number(row?.guests ?? 0);
    const newGuests = Number(row?.new_guests ?? 0);
    return {
      guests,
      newGuests,
      returningGuests: guests - newGuests,
      repeatRate: guests > 0 ? Number(row?.repeaters ?? 0) / guests : 0,
    };
  }

  async topGuests(range: DateRange, limit: number): Promise<TopGuest[]> {
    const rows = await prisma.$queryRaw<
      { user_id: string; name: string; phone: string; orders: bigint; revenue: bigint | null }[]
    >`
      SELECT
        user_id,
        (array_agg(customer_name ORDER BY placed_at DESC))[1] AS name,
        (array_agg(customer_phone ORDER BY placed_at DESC))[1] AS phone,
        COUNT(*) AS orders,
        SUM(total) AS revenue
      FROM orders
      WHERE status = 'completed' AND placed_at >= ${range.from} AND placed_at < ${range.to}
      GROUP BY user_id
      ORDER BY revenue DESC, orders DESC
      LIMIT ${limit}`;
    return rows.map((row) => ({
      userId: row.user_id,
      name: row.name,
      phone: row.phone,
      orders: Number(row.orders),
      revenue: Number(row.revenue ?? 0),
    }));
  }

  async reservationStats(range: DateRange): Promise<GuestReport["reservations"]> {
    const groups = await prisma.reservation.groupBy({
      by: ["status"],
      where: { startsAt: { gte: range.from, lt: range.to } },
      _count: { _all: true },
      _sum: { partySize: true },
    });
    const count = (status: string) => groups.find((g) => g.status === status)?._count._all ?? 0;
    const active = groups.filter((g) => g.status !== "cancelled");
    const noShows = count("noShow");
    const resolved = count("completed") + count("seated") + noShows;
    return {
      total: active.reduce((sum, g) => sum + g._count._all, 0),
      covers: active.filter((g) => g.status !== "noShow").reduce((sum, g) => sum + (g._sum.partySize ?? 0), 0),
      noShows,
      noShowRate: resolved > 0 ? noShows / resolved : 0,
    };
  }

  async activeOrderCount(): Promise<number> {
    return prisma.order.count({ where: { status: { in: [...ACTIVE_ORDER_STATUSES] } } });
  }

  async reservationsOn(range: DateRange): Promise<{ bookings: number; covers: number; awaitingConfirmation: number }> {
    const groups = await prisma.reservation.groupBy({
      by: ["status"],
      where: {
        startsAt: { gte: range.from, lt: range.to },
        status: { in: ["requested", "confirmed", "seated", "completed"] },
      },
      _count: { _all: true },
      _sum: { partySize: true },
    });
    return {
      bookings: groups.reduce((sum, g) => sum + g._count._all, 0),
      covers: groups.reduce((sum, g) => sum + (g._sum.partySize ?? 0), 0),
      awaitingConfirmation: groups.find((g) => g.status === "requested")?._count._all ?? 0,
    };
  }

  async publishedEventsBetween(from: Date, to: Date): Promise<number> {
    return prisma.event.count({ where: { isPublished: true, startsAt: { gte: from, lt: to } } });
  }
}

/** A stored UTC timestamp column as cafe wall time. */
function localTime(column: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`((${column} AT TIME ZONE 'UTC') AT TIME ZONE ${CAFE_TIME_ZONE}::text)`;
}

function toKind(value: string): ProductKind {
  return (PRODUCT_KINDS as readonly string[]).includes(value) ? (value as ProductKind) : "drink";
}

function toServiceType(value: string): ServiceType {
  return (SERVICE_TYPES as readonly string[]).includes(value) ? (value as ServiceType) : "takeaway";
}

function isPaymentMethod(value: string): value is PaymentMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(value);
}
