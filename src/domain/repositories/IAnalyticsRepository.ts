import type {
  DailySales,
  DateRange,
  DiscountSummary,
  GuestReport,
  HourlySales,
  KindSales,
  MethodPayments,
  PaymentSummary,
  PromoCodeUsage,
  RefundTiming,
  SalesSummary,
  StreamTotals,
  TopGuest,
  TopItem,
  TopItemSort,
  UnpaidOrder,
} from "../entities/Analytics";

/**
 * Read-only aggregates over orders, reservations and events, computed in the
 * database. Not a data source of its own — it reads the same rows the other
 * repositories write, so the numbers can't drift from them. Every method takes a
 * cafe-day range (`[from, to)`); series come back sparse and the use-case fills gaps.
 *
 * Methods that net refunds take a `RefundTiming`: `orderDay` takes a refund off
 * the order it was made on (counted when that order was placed), `refundDay` counts
 * it on the day it was made, whenever the order was.
 */
export type IAnalyticsRepository = {
  salesSummary(range: DateRange, refunds: RefundTiming): Promise<SalesSummary>;
  /** Completed sales per cafe day, each with the part still unpaid. */
  dailySales(range: DateRange, refunds: RefundTiming): Promise<DailySales[]>;
  hourlySales(range: DateRange, refunds: RefundTiming): Promise<HourlySales[]>;
  salesByKind(range: DateRange, refunds: RefundTiming): Promise<KindSales[]>;
  /**
   * Best sellers, one row per product whatever it was sold as, each with its
   * category named in `locale` (the default language when omitted).
   */
  topItems(
    range: DateRange,
    refunds: RefundTiming,
    sort: TopItemSort,
    limit: number,
    locale?: string,
  ): Promise<TopItem[]>;

  /** Promo codes and loyalty points on the range's completed orders. */
  discountSummary(range: DateRange): Promise<DiscountSummary>;
  /** Each promo code used on the range's completed orders, most discount first. */
  promoCodeUsage(range: DateRange, limit: number): Promise<PromoCodeUsage[]>;
  /** Every revenue stream's money in the range, VAT and refunds included. Streams with nothing may be left out. */
  revenueStreams(range: DateRange, refunds: RefundTiming): Promise<StreamTotals[]>;

  /**
   * Revenue and the paid part of it (completed orders), and what's unpaid across
   * the orders served in the range: completed, or ready — a `preparing` order with
   * every line served, so only the close-out is left.
   */
  paymentSummary(range: DateRange, refunds: RefundTiming): Promise<PaymentSummary>;
  /** The paid, completed orders placed in the range, totalled per payment method. */
  paidByMethod(range: DateRange, refunds: RefundTiming): Promise<MethodPayments[]>;
  /** Ready or completed orders placed in the range and still unpaid, oldest first. */
  unpaidOrders(range: DateRange, limit: number): Promise<UnpaidOrder[]>;

  /** Guest counts for the range: total, new (first completed order ever), returning, repeat. */
  guestCounts(range: DateRange): Promise<Pick<GuestReport, "guests" | "newGuests" | "returningGuests" | "repeatRate">>;
  topGuests(range: DateRange, limit: number): Promise<TopGuest[]>;
  reservationStats(range: DateRange): Promise<GuestReport["reservations"]>;

  /** The day's bookings (`DAY_BOOKING_STATUSES`), guests across them, and how many still await confirmation. */
  reservationsOn(range: DateRange): Promise<{ bookings: number; covers: number; awaitingConfirmation: number }>;
  /** Published events on at some point in `[from, to)`: not over by `from`, and starting before `to`. */
  publishedEventsDuring(from: Date, to: Date): Promise<number>;
};
