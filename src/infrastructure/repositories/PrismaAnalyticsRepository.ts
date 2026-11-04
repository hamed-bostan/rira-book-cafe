import {
  endsBeforeDayEnd,
  netPaymentParts,
  type DailySales,
  type DateRange,
  type DiscountSummary,
  type GuestReport,
  type HourlySales,
  type KindSales,
  type MethodPayments,
  type PaymentSummary,
  type PromoCodeUsage,
  type RefundTiming,
  type SalesSummary,
  type StreamTotals,
  type TopGuest,
  type TopItem,
  type TopItemSort,
  type UnpaidOrder,
} from "@/src/domain/entities/Analytics";
import { CAFE_TIME_ZONE } from "@/src/domain/entities/CafeTime";
import { SYSTEM_ACCOUNTS } from "@/src/domain/entities/Ledger";
import {
  PAYMENT_METHODS,
  SERVICE_TYPES,
  type PaymentMethod,
  type PaymentPart,
  type ServiceType,
} from "@/src/domain/entities/Order";
import { PRODUCT_KINDS, type ProductKind } from "@/src/domain/entities/Product";
import { DAY_BOOKING_STATUSES } from "@/src/domain/entities/Reservation";
import type { IAnalyticsRepository } from "@/src/domain/repositories/IAnalyticsRepository";
import { prisma } from "@/src/infrastructure/prisma/client";
import { Prisma } from "@/src/infrastructure/prisma/generated/client";

/**
 * An order (aliased `o`) that has been served: completed, or ready — the flow
 * has no step of that name, so it's an order still `preparing` whose every line
 * the bar has ticked off as served, leaving only the close-out. Ready orders are
 * money owed but not yet revenue.
 */
const SERVED_ORDER = Prisma.sql`(
  o.status = 'completed'
  OR (
    o.status = 'preparing'
    AND EXISTS (SELECT 1 FROM order_items line WHERE line.order_id = o.id)
    AND NOT EXISTS (SELECT 1 FROM order_items line WHERE line.order_id = o.id AND line.served_at IS NULL)
  )
)`;

/**
 * Store aggregates computed in PostgreSQL. Timestamps are stored as UTC
 * (`timestamp without time zone`); every day/hour bucket converts to the cafe's
 * clock first, so "Tuesday" and "8 am" mean what they mean at the counter.
 *
 * Aggregates come back as `bigint` from Postgres and are narrowed with `Number()`
 * — Toman totals stay far below 2^53.
 */
export class PrismaAnalyticsRepository implements IAnalyticsRepository {
  async salesSummary(range: DateRange, refunds: RefundTiming): Promise<SalesSummary> {
    // A served order written off (nobody paid) is `cancelled`: its sale came back off
    // the books, so it leaves revenue and counts with the other orders that never paid.
    const [orders] = await prisma.$queryRaw<
      {
        orders: bigint;
        gross: bigint | null;
        promo: bigint | null;
        points: bigint | null;
        charged: bigint | null;
        refunded: bigint | null;
        cancelled: bigint;
        cancelled_value: bigint | null;
      }[]
    >`
      SELECT
        COUNT(*) FILTER (WHERE status = 'completed') AS orders,
        SUM(subtotal) FILTER (WHERE status = 'completed') AS gross,
        SUM(promo_discount) FILTER (WHERE status = 'completed') AS promo,
        SUM(points_discount) FILTER (WHERE status = 'completed') AS points,
        SUM(total) FILTER (WHERE status = 'completed') AS charged,
        SUM(refunded_total) FILTER (WHERE status = 'completed') AS refunded,
        COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
        SUM(total) FILTER (WHERE status = 'cancelled') AS cancelled_value
      FROM orders
      WHERE placed_at >= ${range.from} AND placed_at < ${range.to}`;

    let refunded = Number(orders?.refunded ?? 0);
    let itemsSold: number;
    if (refunds === "orderDay") {
      const [items] = await prisma.$queryRaw<{ items: bigint | null }[]>`
        SELECT SUM(oi.quantity - oi.refunded_quantity) AS items
        FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE o.status = 'completed' AND o.placed_at >= ${range.from} AND o.placed_at < ${range.to}`;
      itemsSold = Number(items?.items ?? 0);
    } else {
      const [[items], [back], [units]] = await Promise.all([
        prisma.$queryRaw<{ items: bigint | null }[]>`
          SELECT SUM(oi.quantity) AS items
          FROM order_items oi JOIN orders o ON o.id = oi.order_id
          WHERE o.status = 'completed' AND o.placed_at >= ${range.from} AND o.placed_at < ${range.to}`,
        prisma.$queryRaw<{ amount: bigint | null }[]>`
          SELECT SUM(r.amount) AS amount
          FROM order_refunds r JOIN orders o ON o.id = r.order_id
          WHERE o.status = 'completed' AND ${refundMadeIn(range)}`,
        prisma.$queryRaw<{ units: bigint | null }[]>`
          SELECT SUM(rl.quantity) AS units
          FROM order_refund_lines rl
          JOIN order_refunds r ON r.id = rl.refund_id
          JOIN orders o ON o.id = r.order_id
          WHERE o.status = 'completed' AND ${refundMadeIn(range)}`,
      ]);
      refunded = Number(back?.amount ?? 0);
      itemsSold = Number(items?.items ?? 0) - Number(units?.units ?? 0);
    }

    const count = Number(orders?.orders ?? 0);
    const charged = Number(orders?.charged ?? 0);
    const revenue = charged - refunded;
    return {
      revenue,
      grossSales: Number(orders?.gross ?? 0),
      promoDiscount: Number(orders?.promo ?? 0),
      pointsDiscount: Number(orders?.points ?? 0),
      charged,
      refunds: refunded,
      orders: count,
      itemsSold,
      averageOrderValue: count > 0 ? Math.round(revenue / count) : 0,
      cancelledOrders: Number(orders?.cancelled ?? 0),
      cancelledValue: Number(orders?.cancelled_value ?? 0),
    };
  }

  async dailySales(range: DateRange, refunds: RefundTiming): Promise<DailySales[]> {
    const takings = refunds === "orderDay" ? Prisma.sql`total - refunded_total` : Prisma.sql`total`;
    const rows = await prisma.$queryRaw<
      { day: string; orders: bigint; revenue: bigint | null; unpaid: bigint; unpaid_value: bigint | null }[]
    >`
      SELECT
        to_char(${localTime(Prisma.sql`placed_at`)}, 'YYYY-MM-DD') AS day,
        COUNT(*) AS orders,
        SUM(${takings}) AS revenue,
        COUNT(*) FILTER (WHERE payment_status = 'unpaid') AS unpaid,
        SUM(total - refunded_total) FILTER (WHERE payment_status = 'unpaid') AS unpaid_value
      FROM orders
      WHERE status = 'completed' AND placed_at >= ${range.from} AND placed_at < ${range.to}
      GROUP BY 1
      ORDER BY 1`;
    const days = new Map<string, DailySales>(
      rows.map((row) => [
        row.day,
        {
          day: row.day,
          orders: Number(row.orders),
          revenue: Number(row.revenue ?? 0),
          unpaidOrders: Number(row.unpaid),
          unpaidValue: Number(row.unpaid_value ?? 0),
        },
      ]),
    );
    if (refunds === "refundDay") {
      const back = await prisma.$queryRaw<{ day: string; amount: bigint | null }[]>`
        SELECT to_char(r.date, 'YYYY-MM-DD') AS day, SUM(r.amount) AS amount
        FROM order_refunds r JOIN orders o ON o.id = r.order_id
        WHERE o.status = 'completed' AND ${refundMadeIn(range)}
        GROUP BY 1`;
      for (const row of back) {
        const day = days.get(row.day) ?? { day: row.day, orders: 0, revenue: 0, unpaidOrders: 0, unpaidValue: 0 };
        days.set(row.day, { ...day, revenue: day.revenue - Number(row.amount ?? 0) });
      }
    }
    return [...days.values()].sort((a, b) => a.day.localeCompare(b.day));
  }

  async hourlySales(range: DateRange, refunds: RefundTiming): Promise<HourlySales[]> {
    const takings = refunds === "orderDay" ? Prisma.sql`total - refunded_total` : Prisma.sql`total`;
    const rows = await prisma.$queryRaw<{ hour: number; orders: bigint; revenue: bigint | null }[]>`
      SELECT
        EXTRACT(HOUR FROM ${localTime(Prisma.sql`placed_at`)})::int AS hour,
        COUNT(*) AS orders,
        SUM(${takings}) AS revenue
      FROM orders
      WHERE status = 'completed' AND placed_at >= ${range.from} AND placed_at < ${range.to}
      GROUP BY 1
      ORDER BY 1`;
    const hours = new Map<number, HourlySales>(
      rows.map((row) => [
        Number(row.hour),
        { hour: Number(row.hour), orders: Number(row.orders), revenue: Number(row.revenue ?? 0) },
      ]),
    );
    if (refunds === "refundDay") {
      // A refund's hour is when it was entered, on the cafe clock.
      const back = await prisma.$queryRaw<{ hour: number; amount: bigint | null }[]>`
        SELECT EXTRACT(HOUR FROM ${localTime(Prisma.sql`r.created_at`)})::int AS hour, SUM(r.amount) AS amount
        FROM order_refunds r JOIN orders o ON o.id = r.order_id
        WHERE o.status = 'completed' AND ${refundMadeIn(range)}
        GROUP BY 1`;
      for (const row of back) {
        const hour = Number(row.hour);
        const slot = hours.get(hour) ?? { hour, orders: 0, revenue: 0 };
        hours.set(hour, { ...slot, revenue: slot.revenue - Number(row.amount ?? 0) });
      }
    }
    return [...hours.values()].sort((a, b) => a.hour - b.hour);
  }

  async salesByKind(range: DateRange, refunds: RefundTiming): Promise<KindSales[]> {
    // After discounts and refunds, so the kinds add up to the headline revenue.
    const rows = await prisma.$queryRaw<{ kind: string; revenue: bigint | null; quantity: bigint | null }[]>`
      WITH ${netLinesCte(range, refunds)}
      SELECT kind, SUM(revenue)::bigint AS revenue, SUM(quantity)::bigint AS quantity
      FROM net_lines
      GROUP BY kind
      ORDER BY revenue DESC`;
    return rows.map((row) => ({
      kind: toKind(row.kind),
      revenue: Number(row.revenue ?? 0),
      quantity: Number(row.quantity ?? 0),
    }));
  }

  async topItems(
    range: DateRange,
    refunds: RefundTiming,
    sort: TopItemSort,
    limit: number,
    locale?: string,
  ): Promise<TopItem[]> {
    // Grouped by product, labelled with the most recent name it sold under — a
    // renamed item, or one sold with different options, stays one row. The category
    // is the item's current one, in the reader's language when it has a
    // translation; a deleted item has none.
    const orderBy =
      sort === "quantity" ? Prisma.sql`quantity DESC, revenue DESC` : Prisma.sql`revenue DESC, quantity DESC`;
    const rows = await prisma.$queryRaw<
      {
        product_id: string;
        name: string;
        kind: string;
        category: string | null;
        quantity: bigint | null;
        revenue: bigint | null;
      }[]
    >`
      WITH ${netLinesCte(range, refunds)},
      ranked AS (
        SELECT
          product_id,
          (array_agg(name ORDER BY placed_at DESC))[1] AS name,
          (array_agg(kind ORDER BY placed_at DESC))[1] AS kind,
          SUM(quantity)::bigint AS quantity,
          SUM(revenue)::bigint AS revenue
        FROM net_lines
        GROUP BY product_id
        ORDER BY ${orderBy}
        LIMIT ${limit}
      )
      SELECT r.product_id, r.name, r.kind, r.quantity, r.revenue, COALESCE(ct.name, c.name) AS category
      FROM ranked r
      LEFT JOIN products p ON p.id = r.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN category_translations ct ON ct.category_id = c.id AND ct.locale = ${locale ?? null}
      ORDER BY ${orderBy}`;
    return rows.map((row) => ({
      productId: row.product_id,
      name: row.name,
      kind: toKind(row.kind),
      categoryName: row.category,
      quantity: Number(row.quantity ?? 0),
      revenue: Number(row.revenue ?? 0),
    }));
  }

  async discountSummary(range: DateRange): Promise<DiscountSummary> {
    const [row] = await prisma.$queryRaw<
      {
        promo_orders: bigint;
        promo: bigint | null;
        points_orders: bigint;
        points: bigint | null;
        redeemed: bigint | null;
        earned: bigint | null;
      }[]
    >`
      SELECT
        COUNT(*) FILTER (WHERE promo_code IS NOT NULL) AS promo_orders,
        SUM(promo_discount) AS promo,
        COUNT(*) FILTER (WHERE points_redeemed > 0) AS points_orders,
        SUM(points_discount) AS points,
        SUM(points_redeemed) AS redeemed,
        SUM(points_earned) AS earned
      FROM orders
      WHERE status = 'completed' AND placed_at >= ${range.from} AND placed_at < ${range.to}`;
    return {
      promoOrders: Number(row?.promo_orders ?? 0),
      promoDiscount: Number(row?.promo ?? 0),
      pointsOrders: Number(row?.points_orders ?? 0),
      pointsDiscount: Number(row?.points ?? 0),
      pointsRedeemed: Number(row?.redeemed ?? 0),
      pointsEarned: Number(row?.earned ?? 0),
    };
  }

  async promoCodeUsage(range: DateRange, limit: number): Promise<PromoCodeUsage[]> {
    // One row per code (by id, so a code is one row whatever case it was typed in);
    // labelled with the text on its latest order.
    const rows = await prisma.$queryRaw<
      { code: string; uses: bigint; discount: bigint | null; revenue: bigint | null }[]
    >`
      SELECT
        (array_agg(promo_code ORDER BY placed_at DESC))[1] AS code,
        COUNT(*) AS uses,
        SUM(promo_discount) AS discount,
        SUM(total - refunded_total) AS revenue
      FROM orders
      WHERE status = 'completed' AND promo_code IS NOT NULL
        AND placed_at >= ${range.from} AND placed_at < ${range.to}
      GROUP BY COALESCE(promo_code_id, promo_code)
      ORDER BY 3 DESC, 2 DESC, 1
      LIMIT ${limit}`;
    return rows.map((row) => ({
      code: row.code,
      uses: Number(row.uses),
      discount: Number(row.discount ?? 0),
      revenue: Number(row.revenue ?? 0),
    }));
  }

  /**
   * Each stream from the table it lives in, VAT as it was booked:
   * - cafe: completed orders placed in the range; the VAT their sale entries booked
   *   (an order completed before the books began booked none), less refunds and the
   *   VAT on them;
   * - suite, events, other: payments received in the range (a void one never was),
   *   less what was handed back from them;
   * - deposits: the amount kept, on the day the books recorded keeping it — neither
   *   a booking nor a loan stores that day itself. A lost book's deposit paid back
   *   when the book turned up is that stream's refund.
   *
   * Refunds follow `refunds`: against the day of what they refund, or the day they
   * were made. With refunds on their own day the streams are what the profit and
   * loss statement books (VAT-inclusive), for orders completed on the day placed.
   */
  async revenueStreams(range: DateRange, refunds: RefundTiming): Promise<StreamTotals[]> {
    const byOrderDay = refunds === "orderDay";
    const orderRefundsIn = byOrderDay
      ? Prisma.sql`o.placed_at >= ${range.from} AND o.placed_at < ${range.to}`
      : refundMadeIn(range);
    const incomeRefundsIn = byOrderDay
      ? dayIn(Prisma.sql`i.date`, Prisma.sql`i.created_at`, range)
      : dayIn(Prisma.sql`f.date`, Prisma.sql`f.created_at`, range);
    const repaidIn = byOrderDay
      ? dayIn(Prisma.sql`kept.date`, Prisma.sql`kept.created_at`, range)
      : dayIn(Prisma.sql`repaid.date`, Prisma.sql`repaid.created_at`, range);

    type Totals = { received: bigint | null; vat: bigint | null };
    type Back = { amount: bigint | null; vat: bigint | null };
    type Grouped = { stream: string | null; amount: bigint | null; vat: bigint | null };

    const [[cafe], [cafeBack], incomes, incomeBack, [tables], [books], [booksBack]] = await Promise.all([
      prisma.$queryRaw<Totals[]>`
        WITH sold AS (
          SELECT id, total FROM orders
          WHERE status = 'completed' AND placed_at >= ${range.from} AND placed_at < ${range.to}
        )
        SELECT
          (SELECT SUM(total) FROM sold) AS received,
          (
            SELECT SUM(jl.credit - jl.debit)
            FROM journal_entries je JOIN journal_lines jl ON jl.entry_id = je.id
            WHERE je.source = 'orderSale' AND je.reversed_by_id IS NULL
              AND jl.account_code = ${SYSTEM_ACCOUNTS.vatPayable}
              AND je.source_id IN (SELECT id FROM sold)
          ) AS vat`,
      prisma.$queryRaw<Back[]>`
        SELECT SUM(r.amount) AS amount, SUM(r.vat_amount) AS vat
        FROM order_refunds r JOIN orders o ON o.id = r.order_id
        WHERE o.status = 'completed' AND ${orderRefundsIn}`,
      prisma.$queryRaw<Grouped[]>`
        SELECT i.source_type AS stream, SUM(i.amount) AS amount, SUM(i.vat_amount) AS vat
        FROM incomes i
        WHERE i.status = 'received' AND ${dayIn(Prisma.sql`i.date`, Prisma.sql`i.created_at`, range)}
        GROUP BY 1`,
      prisma.$queryRaw<Grouped[]>`
        SELECT i.source_type AS stream, SUM(f.amount) AS amount, SUM(f.vat_amount) AS vat
        FROM income_refunds f JOIN incomes i ON i.id = f.income_id
        WHERE i.status = 'received' AND ${incomeRefundsIn}
        GROUP BY 1`,
      prisma.$queryRaw<Totals[]>`
        SELECT SUM(r.deposit_amount) AS received, 0::bigint AS vat
        FROM reservations r
        JOIN journal_entries kept ON kept.unique_key = 'reservation:' || r.id || ':depositKept'
        WHERE r.deposit_state = 'kept' AND ${dayIn(Prisma.sql`kept.date`, Prisma.sql`kept.created_at`, range)}`,
      prisma.$queryRaw<Totals[]>`
        SELECT SUM(l.deposit_amount) AS received, 0::bigint AS vat
        FROM book_loans l
        JOIN journal_entries kept ON kept.unique_key = 'loan:' || l.id || ':depositKept'
        WHERE ${dayIn(Prisma.sql`kept.date`, Prisma.sql`kept.created_at`, range)}`,
      prisma.$queryRaw<Back[]>`
        SELECT SUM(l.deposit_amount) AS amount, 0::bigint AS vat
        FROM book_loans l
        JOIN journal_entries kept ON kept.unique_key = 'loan:' || l.id || ':depositKept'
        JOIN journal_entries repaid ON repaid.unique_key = 'loan:' || l.id || ':depositRepaid'
        WHERE ${repaidIn}`,
    ]);

    const incomeStream = (sourceType: string | null): StreamTotals["stream"] =>
      sourceType === "suiteBooking" ? "suite" : sourceType === "eventRegistration" ? "events" : "otherIncome";
    const totals = new Map<StreamTotals["stream"], StreamTotals>();
    const add = (stream: StreamTotals["stream"], part: Partial<Omit<StreamTotals, "stream">>): void => {
      const row = totals.get(stream) ?? { stream, received: 0, refunded: 0, vat: 0, vatRefunded: 0 };
      totals.set(stream, {
        stream,
        received: row.received + (part.received ?? 0),
        refunded: row.refunded + (part.refunded ?? 0),
        vat: row.vat + (part.vat ?? 0),
        vatRefunded: row.vatRefunded + (part.vatRefunded ?? 0),
      });
    };

    add("cafe", {
      received: Number(cafe?.received ?? 0),
      vat: Number(cafe?.vat ?? 0),
      refunded: Number(cafeBack?.amount ?? 0),
      vatRefunded: Number(cafeBack?.vat ?? 0),
    });
    for (const row of incomes) {
      add(incomeStream(row.stream), { received: Number(row.amount ?? 0), vat: Number(row.vat ?? 0) });
    }
    for (const row of incomeBack) {
      add(incomeStream(row.stream), { refunded: Number(row.amount ?? 0), vatRefunded: Number(row.vat ?? 0) });
    }
    add("tableDeposits", { received: Number(tables?.received ?? 0) });
    add("bookDeposits", { received: Number(books?.received ?? 0), refunded: Number(booksBack?.amount ?? 0) });
    return [...totals.values()];
  }

  async paymentSummary(range: DateRange, refunds: RefundTiming): Promise<PaymentSummary> {
    // Revenue and its paid part are completed orders, as on the sales report;
    // what's unpaid also counts ready orders, which are served but not yet revenue.
    const takings = refunds === "orderDay" ? Prisma.sql`o.total - o.refunded_total` : Prisma.sql`o.total`;
    const [row] = await prisma.$queryRaw<
      {
        revenue: bigint | null;
        paid: bigint;
        paid_value: bigint | null;
        unpaid: bigint;
        unpaid_value: bigint | null;
      }[]
    >`
      SELECT
        SUM(${takings}) FILTER (WHERE o.status = 'completed') AS revenue,
        COUNT(*) FILTER (WHERE o.status = 'completed' AND o.payment_status = 'paid') AS paid,
        SUM(${takings}) FILTER (WHERE o.status = 'completed' AND o.payment_status = 'paid') AS paid_value,
        COUNT(*) FILTER (WHERE o.payment_status = 'unpaid') AS unpaid,
        SUM(o.total) FILTER (WHERE o.payment_status = 'unpaid') AS unpaid_value
      FROM orders o
      WHERE ${SERVED_ORDER} AND o.placed_at >= ${range.from} AND o.placed_at < ${range.to}`;

    let revenue = Number(row?.revenue ?? 0);
    let paidValue = Number(row?.paid_value ?? 0);
    if (refunds === "refundDay") {
      const [back] = await prisma.$queryRaw<{ amount: bigint | null; paid: bigint | null }[]>`
        SELECT SUM(r.amount) AS amount, SUM(r.amount) FILTER (WHERE o.payment_status = 'paid') AS paid
        FROM order_refunds r JOIN orders o ON o.id = r.order_id
        WHERE o.status = 'completed' AND ${refundMadeIn(range)}`;
      revenue -= Number(back?.amount ?? 0);
      paidValue -= Number(back?.paid ?? 0);
    }
    return {
      revenue,
      paidOrders: Number(row?.paid ?? 0),
      paidValue,
      unpaidOrders: Number(row?.unpaid ?? 0),
      unpaidValue: Number(row?.unpaid_value ?? 0),
    };
  }

  async paidByMethod(range: DateRange, refunds: RefundTiming): Promise<MethodPayments[]> {
    const byMethod = new Map<PaymentMethod, MethodPayments>();
    const add = (method: PaymentMethod, orders: number, value: number): void => {
      const row = byMethod.get(method) ?? { method, orders: 0, value: 0 };
      byMethod.set(method, { method, orders: row.orders + orders, value: row.value + value });
    };
    const sorted = (): MethodPayments[] => [...byMethod.values()].sort((a, b) => b.value - a.value);

    if (refunds === "refundDay") {
      // Every part as paid, and each refund off the way it went back, on its own day.
      const [paid, back] = await Promise.all([
        prisma.$queryRaw<{ method: string; orders: bigint; value: bigint | null }[]>`
          SELECT p.method, COUNT(DISTINCT p.order_id) AS orders, SUM(p.amount) AS value
          FROM order_payment_parts p JOIN orders o ON o.id = p.order_id
          WHERE o.status = 'completed' AND o.payment_status = 'paid'
            AND o.placed_at >= ${range.from} AND o.placed_at < ${range.to}
          GROUP BY p.method`,
        prisma.$queryRaw<{ method: string; value: bigint | null }[]>`
          SELECT r.method, SUM(r.amount) AS value
          FROM order_refunds r JOIN orders o ON o.id = r.order_id
          WHERE o.status = 'completed' AND o.payment_status = 'paid' AND ${refundMadeIn(range)}
          GROUP BY r.method`,
      ]);
      for (const row of paid) {
        if (isPaymentMethod(row.method)) add(row.method, Number(row.orders), Number(row.value ?? 0));
      }
      for (const row of back) {
        if (isPaymentMethod(row.method)) add(row.method, 0, -Number(row.value ?? 0));
      }
      return sorted();
    }

    // Net of refunds, so the split adds up to `paidValue`. Orders nobody refunded —
    // nearly all — are summed in SQL; the few partly refunded ones (a full refund
    // leaves `paid`) are netted part by part in the domain (`netPaymentParts`).
    const [whole, refunded] = await Promise.all([
      prisma.$queryRaw<{ method: string; orders: bigint; value: bigint | null }[]>`
        SELECT p.method, COUNT(DISTINCT p.order_id) AS orders, SUM(p.amount) AS value
        FROM order_payment_parts p JOIN orders o ON o.id = p.order_id
        WHERE o.status = 'completed' AND o.payment_status = 'paid' AND o.refunded_total = 0
          AND o.placed_at >= ${range.from} AND o.placed_at < ${range.to}
        GROUP BY p.method`,
      prisma.order.findMany({
        where: {
          status: "completed",
          paymentStatus: "paid",
          refundedTotal: { gt: 0 },
          placedAt: { gte: range.from, lt: range.to },
        },
        select: {
          paymentParts: { select: { method: true, amount: true }, orderBy: { position: "asc" } },
          refunds: { select: { method: true, amount: true }, orderBy: { number: "asc" } },
        },
      }),
    ]);

    for (const row of whole) {
      if (isPaymentMethod(row.method)) add(row.method, Number(row.orders), Number(row.value ?? 0));
    }
    for (const order of refunded) {
      const net = netPaymentParts(toPaymentParts(order.paymentParts), toPaymentParts(order.refunds));
      // One order counts once under each method it was paid with, as in the SQL above.
      for (const method of new Set(net.map((part) => part.method))) {
        const value = net.filter((part) => part.method === method).reduce((sum, part) => sum + part.amount, 0);
        add(method, 1, value);
      }
    }
    return sorted();
  }

  async unpaidOrders(range: DateRange, limit: number): Promise<UnpaidOrder[]> {
    const rows = await prisma.order.findMany({
      where: {
        paymentStatus: "unpaid",
        placedAt: { gte: range.from, lt: range.to },
        // Completed, or ready: still preparing, but every line is out (see `SERVED_ORDER`).
        OR: [{ status: "completed" }, { status: "preparing", items: { some: {}, none: { servedAt: null } } }],
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
        WHERE status = 'completed' AND user_id IS NOT NULL
          AND placed_at >= ${range.from} AND placed_at < ${range.to}
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
        SUM(total - refunded_total) AS revenue
      FROM orders
      WHERE status = 'completed' AND user_id IS NOT NULL
        AND placed_at >= ${range.from} AND placed_at < ${range.to}
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

  async reservationsOn(range: DateRange): Promise<{ bookings: number; covers: number; awaitingConfirmation: number }> {
    const groups = await prisma.reservation.groupBy({
      by: ["status"],
      where: {
        startsAt: { gte: range.from, lt: range.to },
        status: { in: [...DAY_BOOKING_STATUSES] },
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

  async publishedEventsDuring(from: Date, to: Date): Promise<number> {
    return prisma.event.count({ where: { isPublished: true, endsAt: { gt: from }, startsAt: { lt: to } } });
  }
}

/** A stored UTC timestamp column as cafe wall time. */
function localTime(column: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`((${column} AT TIME ZONE 'UTC') AT TIME ZONE ${CAFE_TIME_ZONE}::text)`;
}

/**
 * A row dated by a cafe day (`date`, a `DATE` column) inside the range. A range
 * compared "at this time" stops part-way through its last day, so on that day only
 * rows entered (`createdAt`) before that moment count.
 */
function dayIn(date: Prisma.Sql, createdAt: Prisma.Sql, range: DateRange): Prisma.Sql {
  const days = Prisma.sql`${date} >= ${range.fromDay}::date AND ${date} <= ${range.toDay}::date`;
  return endsBeforeDayEnd(range)
    ? Prisma.sql`(${days} AND (${date} < ${range.toDay}::date OR ${createdAt} < ${range.to}))`
    : Prisma.sql`(${days})`;
}

/** An order refund (aliased `r`) made in the range — dated, as the books date it, by its day. */
function refundMadeIn(range: DateRange): Prisma.Sql {
  return dayIn(Prisma.sql`r.date`, Prisma.sql`r.created_at`, range);
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

/** Stored `{ method, amount }` rows (payment parts, refunds) whose method is a known one. */
function toPaymentParts(rows: readonly { method: string; amount: number }[]): PaymentPart[] {
  return rows.flatMap((row) => (isPaymentMethod(row.method) ? [{ method: row.method, amount: row.amount }] : []));
}

/**
 * `net_lines`: every line of the range's completed orders with what it actually
 * brought in — `quantity` net of refunded units, `revenue` net of discounts and
 * refunds — so lines grouped any way add up to the sales report's revenue to the
 * Toman.
 *
 * A line's share of the order's `total` (the subtotal with the promo and the
 * points already off) is the domain's `allocate(total, unit_price × quantity)` —
 * the split `priceRefundLines` prices refunds with — done in SQL: each line gets
 * the floor of its exact share, and the Toman the floors leave over go one each
 * to the largest fractions (ties to the earlier line). Since the shares add up to
 * the total exactly, and a line's refunds were priced out of that same share, the
 * line's revenue is its share less the refund lines recorded against it.
 *
 * Counting refunds on the day they were made (`refundDay`), the range's lines keep
 * their whole share and units, and every refund line made in the range — whatever
 * day its order was — comes in as a negative row for its product.
 *
 * Products are cast to `bigint` first: `total × weight` overflows `int`.
 */
function netLinesCte(range: DateRange, refunds: RefundTiming): Prisma.Sql {
  const byOrderDay = refunds === "orderDay";
  const quantity = byOrderDay ? Prisma.sql`oi.quantity - oi.refunded_quantity` : Prisma.sql`oi.quantity`;
  const refundedShare = byOrderDay
    ? Prisma.sql`- COALESCE((SELECT SUM(rl.amount) FROM order_refund_lines rl WHERE rl.order_item_id = a.id), 0)`
    : Prisma.empty;
  const refundRows = byOrderDay
    ? Prisma.empty
    : Prisma.sql`
      UNION ALL
      SELECT oi.order_id, oi.product_id, oi.kind, oi.name, o.placed_at, -rl.quantity, (-rl.amount)::bigint
      FROM order_refund_lines rl
      JOIN order_refunds r ON r.id = rl.refund_id
      JOIN order_items oi ON oi.id = rl.order_item_id
      JOIN orders o ON o.id = oi.order_id
      WHERE o.status = 'completed' AND ${refundMadeIn(range)}`;

  return Prisma.sql`
    weighted AS (
      SELECT
        oi.id, oi.order_id, oi.product_id, oi.kind, oi.name, oi.position, o.placed_at,
        ${quantity} AS quantity,
        o.total::bigint AS order_total,
        oi.unit_price::bigint * oi.quantity AS weight,
        (SUM(oi.unit_price::bigint * oi.quantity) OVER (PARTITION BY oi.order_id))::bigint AS order_weight
      FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.status = 'completed' AND o.placed_at >= ${range.from} AND o.placed_at < ${range.to}
    ),
    floored AS (
      SELECT
        w.*,
        CASE WHEN w.order_weight > 0 THEN w.order_total * w.weight / w.order_weight ELSE 0 END AS base,
        CASE WHEN w.order_weight > 0 THEN w.order_total * w.weight % w.order_weight ELSE 0 END AS fraction
      FROM weighted w
    ),
    allocated AS (
      SELECT
        f.*,
        f.base + CASE
          WHEN f.order_weight > 0
            AND ROW_NUMBER() OVER (PARTITION BY f.order_id ORDER BY f.fraction DESC, f.position, f.id)
              <= f.order_total - SUM(f.base) OVER (PARTITION BY f.order_id)
          THEN 1 ELSE 0 END AS share
      FROM floored f
    ),
    net_lines AS (
      SELECT
        a.order_id, a.product_id, a.kind, a.name, a.placed_at, a.quantity,
        (a.share ${refundedShare})::bigint AS revenue
      FROM allocated a
      ${refundRows}
    )`;
}
