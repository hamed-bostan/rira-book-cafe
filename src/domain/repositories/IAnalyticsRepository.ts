import type {
  DailySales,
  DateRange,
  GuestReport,
  HourlySales,
  KindSales,
  MethodPayments,
  PaymentSummary,
  SalesSummary,
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
 */
export type IAnalyticsRepository = {
  salesSummary(range: DateRange): Promise<SalesSummary>;
  dailySales(range: DateRange): Promise<DailySales[]>;
  hourlySales(range: DateRange): Promise<HourlySales[]>;
  salesByKind(range: DateRange): Promise<KindSales[]>;
  topItems(range: DateRange, sort: TopItemSort, limit: number): Promise<TopItem[]>;

  /** Paid vs unpaid across the completed orders placed in the range. */
  paymentSummary(range: DateRange): Promise<PaymentSummary>;
  /** The paid, completed orders placed in the range, totalled per payment method. */
  paidByMethod(range: DateRange): Promise<MethodPayments[]>;
  /** Completed orders placed in the range and still unpaid, oldest first. */
  unpaidOrders(range: DateRange, limit: number): Promise<UnpaidOrder[]>;

  /** Guest counts for the range: total, new (first completed order ever), returning, repeat. */
  guestCounts(range: DateRange): Promise<Pick<GuestReport, "guests" | "newGuests" | "returningGuests" | "repeatRate">>;
  topGuests(range: DateRange, limit: number): Promise<TopGuest[]>;
  reservationStats(range: DateRange): Promise<GuestReport["reservations"]>;

  /** Orders currently in the queue (pending … ready), regardless of range. */
  activeOrderCount(): Promise<number>;
  /** Today's bookings, guests across them, and how many still await confirmation. */
  reservationsOn(range: DateRange): Promise<{ bookings: number; covers: number; awaitingConfirmation: number }>;
  /** Published events starting in `[from, to)`. */
  publishedEventsBetween(from: Date, to: Date): Promise<number>;
};
