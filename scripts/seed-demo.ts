/**
 * `npm run db:seed:demo`: a month of cafe life on top of the sample data, so every
 * dashboard screen has something to show — orders in every status, till shifts,
 * expenses and stock deliveries, reservations, suite stays, book loans, event
 * sign-ups, reviews and loyalty points.
 *
 * Everything goes through the real use-cases, so the ledger, stock, loyalty
 * balances, notifications and audit trail agree exactly as if staff had done it.
 * To spread it over the past 30 days the process clock is moved back to each
 * moment before acting (Prisma stamps `createdAt`/`placedAt` from the JS clock,
 * and journal entries are dated by the cafe day of "now").
 *
 * Run `npm run db:seed` first. It refuses to run twice: the history is
 * append-only (journal, stock movements), so a second pass would double it.
 * Reset the database (`npx prisma migrate reset`) to start over.
 */
import "dotenv/config";

import type { ActivityActor } from "@/src/domain/entities/ActivityEntry";
import { cafeDayOf, shiftCafeDay, wallTimeToDate } from "@/src/domain/entities/CafeTime";
import type { Order, PaymentMethod } from "@/src/domain/entities/Order";
import { normalizePhone } from "@/src/domain/entities/Phone";
import type { SuiteBookingStatus } from "@/src/domain/entities/SuiteBooking";
import { PostManualEntry } from "@/src/domain/use-cases/accounting/LedgerCommands";
import { JoinBookWaitlist } from "@/src/domain/use-cases/book-loans/BookWaitlist";
import { ChangeBookLoan } from "@/src/domain/use-cases/book-loans/ChangeBookLoan";
import { LendBook } from "@/src/domain/use-cases/book-loans/LendBook";
import {
  CloseCashShift,
  GetCurrentCashShift,
  OpenCashShift,
} from "@/src/domain/use-cases/cash-shifts/CashShiftCommands";
import { CancelRegistrationAsStaff, RegisterForEvent } from "@/src/domain/use-cases/events/EventRegistrations";
import { PayExpense, RecordExpense, SaveSupplier, VoidExpense } from "@/src/domain/use-cases/expenses/ExpenseCommands";
import { ReceiveStock, RecordWaste } from "@/src/domain/use-cases/inventory/InventoryCommands";
import { AddOrderNote } from "@/src/domain/use-cases/orders/AddOrderNote";
import { ChangeOrderStatus } from "@/src/domain/use-cases/orders/ChangeOrderStatus";
import { PlaceOrder } from "@/src/domain/use-cases/orders/PlaceOrder";
import { SetOrderPayment } from "@/src/domain/use-cases/orders/SetOrderPayment";
import { AdjustGuestPoints, CreatePromoCode } from "@/src/domain/use-cases/promotions/PromotionCommands";
import { ChangeReservation } from "@/src/domain/use-cases/reservations/ChangeReservation";
import { RequestReservation } from "@/src/domain/use-cases/reservations/RequestReservation";
import { ModerateReview, SubmitReview } from "@/src/domain/use-cases/reviews/ReviewCommands";
import { ChangeSuiteBooking } from "@/src/domain/use-cases/suite-bookings/ChangeSuiteBooking";
import { RequestSuiteBooking } from "@/src/domain/use-cases/suite-bookings/RequestSuiteBooking";
import * as c from "@/src/infrastructure/container";
import { prisma } from "@/src/infrastructure/prisma/client";

// ── Clock ────────────────────────────────────────────────────────────────────
// `new Date()` and `Date.now()` read a movable clock; dates built from a value
// are untouched. `instanceof Date` still holds for every date in the process.

const RealDate = Date;
const REAL_NOW = RealDate.now();
let clock = REAL_NOW;

class MovableDate extends RealDate {
  constructor(...args: unknown[]) {
    if (args.length === 0) super(clock);
    else super(...(args as [string | number | Date]));
  }
  static now(): number {
    return clock;
  }
  static [Symbol.hasInstance](value: unknown): boolean {
    return value instanceof RealDate;
  }
}
globalThis.Date = MovableDate as unknown as DateConstructor;

// ── Deterministic randomness, so two fresh databases get the same story ─────

let seed = 1404;
function random(): number {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const chance = (p: number): boolean => random() < p;
const between = (min: number, max: number): number => min + Math.floor(random() * (max - min + 1));
const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)];
function pickWeighted<T>(list: readonly (readonly [T, number])[]): T {
  let roll = random() * list.reduce((sum, [, weight]) => sum + weight, 0);
  for (const [value, weight] of list) {
    roll -= weight;
    if (roll < 0) return value;
  }
  return list[list.length - 1][0];
}

// ── Cast ─────────────────────────────────────────────────────────────────────

type Guest = { id: string; name: string; phone: string };

const GUEST_ROWS: readonly [string, string][] = [
  ["Sara Ahmadi", "09121110001"],
  ["Reza Karimi", "09121110002"],
  ["Maryam Hosseini", "09121110003"],
  ["Ali Moradi", "09121110004"],
  ["Niloofar Jafari", "09121110005"],
  ["Hamid Rahimi", "09121110006"],
  ["Parisa Ghasemi", "09121110007"],
  ["Kian Sadeghi", "09121110008"],
  ["Shirin Mohammadi", "09121110009"],
  ["Babak Nouri", "09121110010"],
  ["Leila Kazemi", "09121110011"],
  ["Arash Rostami", "09121110012"],
  ["Mina Bagheri", "09121110013"],
  ["Omid Taheri", "09121110014"],
];
const GUESTS: Guest[] = GUEST_ROWS.map(([name, phone]) => ({ id: normalizePhone(phone), name, phone }));
/** Regulars order far more often than the rest — the "top guests" list needs a shape. */
const GUEST_WEIGHTS = GUESTS.map((guest, i) => [guest, i < 4 ? 5 : i < 9 ? 2 : 1] as const);

const STAFF_PHONE = "09121110100";
const STAFF: ActivityActor = { id: normalizePhone(STAFF_PHONE), name: "Yasaman (barista)" };

const MENU: readonly (readonly [string, number])[] = [
  ["seed-espresso", 10],
  ["seed-cappuccino", 14],
  ["seed-saffron-latte", 9],
  ["seed-persian-tea", 8],
  ["seed-iced-spanish-latte", 9],
  ["seed-mint-lemonade", 5],
  ["seed-saffron-cake", 6],
  ["seed-carrot-cake", 5],
  ["seed-omelette", 4],
  ["seed-breakfast-plate", 4],
  ["seed-book-blind-owl", 1],
  ["seed-book-uncle-napoleon", 1],
];
const ORDER_NOTES = ["Less sugar, please", "Oat milk if you have it", "Extra hot", "No ice", "For here, by the window"];
const STAFF_NOTES = [
  "Guest asked for the bill split in two",
  "Regular — likes the corner table",
  "Paid partly in cash",
];

// ── Use-cases, wired as the route handlers wire them ─────────────────────────

const postManualEntry = new PostManualEntry(c.ledgerRepository);
const placeOrder = new PlaceOrder(c.orderRepository, c.productRepository, c.checkoutPricing);
const changeOrderStatus = new ChangeOrderStatus(c.orderRepository, c.customerNotifier);
const setOrderPayment = new SetOrderPayment(c.orderRepository);
const addOrderNote = new AddOrderNote(c.orderNoteRepository, c.orderRepository);
const openShift = new OpenCashShift(c.cashShiftRepository);
const closeShift = new CloseCashShift(c.cashShiftRepository);
const currentShift = new GetCurrentCashShift(c.cashShiftRepository);
const recordExpense = new RecordExpense(c.expenseRepository, c.ledgerRepository);
const payExpense = new PayExpense(c.expenseRepository);
const voidExpense = new VoidExpense(c.expenseRepository);
const saveSupplier = new SaveSupplier(c.expenseRepository);
const receiveStock = new ReceiveStock(c.inventoryRepository);
const recordWaste = new RecordWaste(c.inventoryRepository);
const createPromo = new CreatePromoCode(c.promotionRepository);
const adjustPoints = new AdjustGuestPoints(c.loyaltyRepository, c.userRepository);
const requestReservation = new RequestReservation(c.reservationRepository);
const changeReservation = new ChangeReservation(c.reservationRepository, c.customerNotifier);
const requestSuite = new RequestSuiteBooking(c.suiteBookingRepository);
const changeSuite = new ChangeSuiteBooking(c.suiteBookingRepository, c.customerNotifier);
const lendBook = new LendBook(c.bookLoanRepository, c.userRepository, c.bookWaitlistRepository, c.customerNotifier);
const changeLoan = new ChangeBookLoan(c.bookLoanRepository, c.bookWaitlistRepository, c.customerNotifier);
const joinWaitlist = new JoinBookWaitlist(c.bookWaitlistRepository, c.bookLoanRepository);
const registerForEvent = new RegisterForEvent(c.eventRepository);
const cancelRegistration = new CancelRegistrationAsStaff(c.eventRepository);
const submitReview = new SubmitReview(c.reviewRepository, c.productRepository);
const moderateReview = new ModerateReview(c.reviewRepository, c.customerNotifier);

// ── Timeline ─────────────────────────────────────────────────────────────────

const DAYS = 30;
const TODAY = cafeDayOf(new RealDate(REAL_NOW));
const day = (offset: number): string => shiftCafeDay(TODAY, offset);
const at = (offset: number, time: string): Date => wallTimeToDate(`${day(offset)}T${time}`);
const plusMinutes = (date: Date, minutes: number): Date => new RealDate(date.getTime() + minutes * 60_000);
const hhmm = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

type Step = { at: Date; label: string; run: () => Promise<unknown> };
const steps: Step[] = [];
const schedule = (when: Date, label: string, run: () => Promise<unknown>): void => {
  steps.push({ at: when, label, run });
};

const tally = { orders: 0, failed: 0 };

// ── Orders ───────────────────────────────────────────────────────────────────

type Placed = { order?: Order; guest: Guest };

function basket(): { productId: string; quantity: number }[] {
  const lines = new Map<string, number>();
  const count = pickWeighted([
    [1, 4],
    [2, 4],
    [3, 2],
  ] as const);
  for (let i = 0; i < count; i++) {
    const productId = pickWeighted(MENU);
    lines.set(productId, (lines.get(productId) ?? 0) + (chance(0.2) ? 2 : 1));
  }
  return [...lines].map(([productId, quantity]) => ({ productId, quantity }));
}

async function place(ref: Placed, promoCode: string | undefined, redeemPoints: boolean): Promise<void> {
  const dineIn = chance(0.65);
  const request = {
    items: basket(),
    serviceType: dineIn ? ("dineIn" as const) : ("takeaway" as const),
    tableLabel: dineIn ? String(between(1, 10)) : undefined,
    note: chance(0.12) ? pick(ORDER_NOTES) : undefined,
  };
  try {
    ref.order = await placeOrder.execute({ ...request, promoCode, redeemPoints }, ref.guest);
  } catch {
    // A code below its minimum, too few points, or a book that sold out: place it plainly.
    ref.order = await placeOrder.execute(
      { ...request, items: [{ productId: "seed-cappuccino", quantity: 1 }] },
      ref.guest,
    );
  }
  tally.orders++;
}

const paymentMethod = (): PaymentMethod =>
  pickWeighted([
    ["card", 45],
    ["cash", 35],
    ["transfer", 20],
  ] as const);

function planOrder(placedAt: Date, ending: "done" | "pending" | "preparing" | "preparingPaid"): void {
  const ref: Placed = { guest: pickWeighted(GUEST_WEIGHTS) };
  const promo = chance(0.08) ? "WELCOME10" : chance(0.05) ? "BOOKCLUB" : undefined;
  schedule(placedAt, "place order", () => place(ref, promo, chance(0.1)));
  const later = (minutes: number, label: string, run: (order: Order) => Promise<unknown>): void =>
    schedule(plusMinutes(placedAt, minutes), label, async () => (ref.order ? run(ref.order) : undefined));

  if (ending === "pending") return;
  if (ending === "done" && chance(0.06)) {
    later(between(2, 6), "cancel order", (o) => changeOrderStatus.execute(o.id, "cancelled", STAFF));
    return;
  }
  later(between(2, 5), "start order", (o) => changeOrderStatus.execute(o.id, "preparing", STAFF));
  if (ending === "preparing") return;
  // A few guests settle up long after; a couple never do (the receivables list).
  const unpaid = ending === "done" && chance(0.03);
  if (!unpaid) {
    later(between(6, 18), "take payment", (o) => setOrderPayment.execute(o.id, "paid", paymentMethod(), STAFF));
  }
  if (ending === "preparingPaid") return;
  later(between(19, 26), "complete order", (o) => changeOrderStatus.execute(o.id, "completed", STAFF));
  if (chance(0.07)) later(between(27, 40), "order note", (o) => addOrderNote.execute(o.id, pick(STAFF_NOTES), STAFF));

  if (chance(0.12)) {
    const rating = pickWeighted([
      [5, 6],
      [4, 4],
      [3, 2],
      [2, 1],
    ] as const);
    const comment = rating >= 4 ? pick(["Lovely, as always.", "Perfect with a book.", ""]) : "A bit too sweet for me.";
    let reviewId: string | undefined;
    later(180, "submit review", async (o) => {
      reviewId = (
        await submitReview.execute(o.items[0].productId, { rating, comment: comment || undefined }, ref.guest)
      ).id;
    });
    // Staff work through reviews the next morning; the newest stay pending.
    const verdict = rating <= 2 && chance(0.5) ? "rejected" : "approved";
    const reviewedAt = plusMinutes(placedAt, 24 * 60 + 60);
    schedule(reviewedAt, "moderate review", async () =>
      reviewId ? moderateReview.execute(reviewId, verdict, STAFF, new Date()) : undefined,
    );
  }
}

function planOrders(): void {
  for (let offset = -DAYS + 1; offset <= 0; offset++) {
    const weekday = wallTimeToDate(`${day(offset)}T12:00`).getUTCDay();
    const busy = weekday === 4 || weekday === 5; // Thursday and Friday
    let count = between(5, 9) + (busy ? between(3, 5) : 0);
    // Fill the day between opening (08:30) and the last order (21:45), then sort.
    let minutes = Array.from({ length: count }, () => between(8 * 60 + 30, 21 * 60 + 45)).sort((a, b) => a - b);
    if (offset === 0) {
      // Today stops a little before now, and its last orders are still in the queue.
      minutes = minutes.filter((m) => at(0, hhmm(m)).getTime() < REAL_NOW - 40 * 60_000);
      count = minutes.length;
    }
    minutes.forEach((m, i) => {
      const left = count - i;
      const ending =
        offset !== 0 || left > 4 ? "done" : left === 1 ? "pending" : left === 2 ? "preparing" : "preparingPaid";
      planOrder(at(offset, hhmm(m)), ending);
    });
  }
}

// ── Till shifts ──────────────────────────────────────────────────────────────

function planShifts(): void {
  for (let offset = -DAYS + 1; offset <= 0; offset++) {
    let shiftId: string | undefined;
    schedule(at(offset, "08:00"), "open shift", async () => {
      shiftId = (await openShift.execute({ openingFloat: 2_000_000 }, STAFF)).id;
    });
    if (offset === 0) continue; // today's shift is still open
    schedule(at(offset, "22:45"), "close shift", async () => {
      if (!shiftId) return;
      const report = await currentShift.execute(new Date());
      const expected = report?.expectedCash ?? 2_000_000;
      const drift = pickWeighted([
        [0, 7],
        [-20_000, 1],
        [10_000, 1],
        [-50_000, 1],
      ] as const);
      await closeShift.execute(shiftId, { countedCash: Math.max(0, expected + drift) }, STAFF, new Date());
    });
  }
}

// ── Money out: suppliers, deliveries, expenses ───────────────────────────────

type SupplierIds = { beans: string; dairy: string; bakery: string; landlord: string; utility: string };
const suppliers: Partial<SupplierIds> = {};

/** A delivery's line, costed at the item's list price. */
async function deliveryLine(ingredientId: string, quantity: number) {
  const item = await prisma.ingredient.findUniqueOrThrow({ where: { id: ingredientId } });
  return { ingredientId, quantity, cost: Math.round((item.purchasePrice / item.purchaseQuantity) * quantity) };
}

function planPurchasing(owner: ActivityActor): void {
  // The owner funds the bank account before the month starts; suppliers are paid from it.
  schedule(at(-DAYS, "08:00"), "owner's capital", () =>
    postManualEntry.execute(
      {
        date: day(-DAYS),
        description: "Owner's capital for the month",
        lines: [
          { accountCode: "1120", debit: 300_000_000, credit: 0 },
          { accountCode: "3100", debit: 0, credit: 300_000_000 },
        ],
      },
      owner,
    ),
  );
  schedule(at(-DAYS, "09:00"), "suppliers", async () => {
    suppliers.beans = (await saveSupplier.create({ name: "Lamiz Roastery", phone: "02188776655" })).id;
    suppliers.dairy = (await saveSupplier.create({ name: "Pegah Dairy", phone: "02144332211" })).id;
    suppliers.bakery = (await saveSupplier.create({ name: "Nan-e Sahar Bakery", note: "Delivers before 8am" })).id;
    suppliers.landlord = (await saveSupplier.create({ name: "Mr. Sharifi (landlord)" })).id;
    suppliers.utility = (await saveSupplier.create({ name: "Tehran Power & Gas" })).id;
  });

  // Weekly deliveries keep the bar stocked; the last bean order is still owed.
  for (const offset of [-28, -21, -14, -7]) {
    schedule(at(offset, "09:15"), "coffee delivery", async () =>
      receiveStock.execute(
        {
          date: day(offset),
          supplierId: suppliers.beans,
          description: "Weekly beans and syrups",
          lines: [
            await deliveryLine("seed-ing-beans", 2000),
            await deliveryLine("seed-ing-condensed", 800),
            await deliveryLine("seed-ing-saffron", 4),
            await deliveryLine("seed-ing-cup", 100),
          ],
          vatAmount: 0,
          paidFrom: offset === -7 ? undefined : "bank",
        },
        owner,
        new Date(),
      ),
    );
    schedule(at(offset, "09:30"), "dairy delivery", async () =>
      receiveStock.execute(
        {
          date: day(offset),
          supplierId: suppliers.dairy,
          description: "Milk, eggs and cheese",
          lines: [
            await deliveryLine("seed-ing-milk", 12_000),
            await deliveryLine("seed-ing-eggs", 60),
            await deliveryLine("seed-ing-cheese", 1000),
          ],
          vatAmount: 0,
          paidFrom: "bank",
        },
        owner,
        new Date(),
      ),
    );
    schedule(at(offset, "09:45"), "bakery delivery", async () =>
      receiveStock.execute(
        {
          date: day(offset),
          supplierId: suppliers.bakery,
          description: "Cakes and bread",
          lines: [
            await deliveryLine("seed-ing-saffron-cake", 20),
            await deliveryLine("seed-ing-carrot-cake", 15),
            await deliveryLine("seed-ing-bread", 30),
            await deliveryLine("seed-ing-tea", 500),
            await deliveryLine("seed-ing-sugar", 3000),
            await deliveryLine("seed-ing-lemon", 1500),
          ],
          vatAmount: 0,
          paidFrom: "bank",
        },
        owner,
        new Date(),
      ),
    );
  }
  schedule(at(-10, "21:30"), "waste", () =>
    recordWaste.execute(
      { date: day(-10), ingredientId: "seed-ing-milk", quantity: 1000, note: "Left out overnight" },
      owner,
    ),
  );
  schedule(at(-3, "21:30"), "waste", () =>
    recordWaste.execute(
      { date: day(-3), ingredientId: "seed-ing-carrot-cake", quantity: 2, note: "Past its best" },
      owner,
    ),
  );

  const expense = (
    offset: number,
    input: { accountCode: string; description: string; amount: number; vatAmount?: number },
    supplier: keyof SupplierIds | undefined,
    paidFrom: "cash" | "bank" | undefined,
  ): Promise<{ id: string }> =>
    recordExpense.execute(
      {
        date: day(offset),
        supplierId: supplier ? suppliers[supplier] : undefined,
        vatAmount: input.vatAmount ?? 0,
        paidFrom,
        ...input,
      },
      owner,
      new Date(),
    );

  schedule(at(-27, "10:00"), "rent", () =>
    expense(-27, { accountCode: "6100", description: "Rent — this month", amount: 45_000_000 }, "landlord", "bank"),
  );
  schedule(at(-15, "17:00"), "salaries", () =>
    expense(-15, { accountCode: "6200", description: "Staff salaries", amount: 60_000_000 }, undefined, "bank"),
  );
  let utilityBill: string | undefined;
  schedule(at(-12, "11:00"), "utilities", async () => {
    utilityBill = (
      await expense(
        -12,
        { accountCode: "6300", description: "Electricity and gas", amount: 3_200_000, vatAmount: 290_000 },
        "utility",
        undefined,
      )
    ).id;
  });
  schedule(at(-5, "11:00"), "pay utilities", async () =>
    utilityBill ? payExpense.execute(utilityBill, "bank", day(-5), owner, new Date()) : undefined,
  );
  schedule(at(-9, "12:00"), "supplies", () =>
    expense(
      -9,
      { accountCode: "6400", description: "Napkins, straws and cleaning", amount: 900_000 },
      undefined,
      "cash",
    ),
  );
  schedule(at(-6, "13:00"), "marketing", () =>
    expense(-6, { accountCode: "6600", description: "Instagram promotion", amount: 5_000_000 }, undefined, undefined),
  );
  let repair: string | undefined;
  schedule(at(-4, "15:00"), "repair", async () => {
    repair = (
      await expense(-4, { accountCode: "6500", description: "Grinder service", amount: 2_400_000 }, undefined, "cash")
    ).id;
  });
  schedule(at(-3, "10:00"), "void repair", async () =>
    repair ? voidExpense.execute(repair, "Entered twice", owner, new Date()) : undefined,
  );
  schedule(at(-1, "18:00"), "fees", () =>
    expense(-1, { accountCode: "6700", description: "Card terminal fees", amount: 350_000 }, undefined, "bank"),
  );
}

// ── Promotions and loyalty ───────────────────────────────────────────────────

function planPromotions(): void {
  schedule(at(-DAYS, "08:30"), "promo codes", async () => {
    await createPromo.execute(
      {
        code: "WELCOME10",
        description: "10% off for new guests",
        kind: "percent",
        value: 10,
        maxDiscount: 50_000,
        minSubtotal: 0,
        perGuestLimit: 3,
        isActive: true,
      },
      STAFF,
    );
    await createPromo.execute(
      {
        code: "BOOKCLUB",
        description: "Book club members",
        kind: "fixed",
        value: 30_000,
        minSubtotal: 250_000,
        isActive: true,
      },
      STAFF,
    );
    await createPromo.execute(
      {
        code: "SUMMER15",
        description: "Last season's offer",
        kind: "percent",
        value: 15,
        minSubtotal: 0,
        endsAt: at(-DAYS + 5, "23:00").toISOString(),
        isActive: false,
      },
      STAFF,
    );
  });
  schedule(at(-2, "16:00"), "points gift", () =>
    adjustPoints.execute({ phone: GUESTS[0].phone, delta: 50, note: "Birthday gift" }, STAFF),
  );
}

// ── Reservations and the suite ───────────────────────────────────────────────

function planReservations(): void {
  type Plan = {
    day: number;
    time: string;
    party: number;
    flow: "completed" | "noShow" | "cancelled" | "confirmed" | "requested";
  };
  const plans: Plan[] = [
    { day: -20, time: "19:00", party: 4, flow: "completed" },
    { day: -14, time: "13:00", party: 2, flow: "completed" },
    { day: -9, time: "20:00", party: 3, flow: "noShow" },
    { day: -6, time: "18:30", party: 6, flow: "cancelled" },
    { day: -3, time: "19:30", party: 2, flow: "completed" },
    { day: -1, time: "17:00", party: 5, flow: "completed" },
    { day: 0, time: "20:00", party: 4, flow: "confirmed" },
    { day: 1, time: "18:30", party: 2, flow: "requested" },
    { day: 2, time: "19:00", party: 4, flow: "confirmed" },
    { day: 5, time: "13:00", party: 8, flow: "requested" },
  ];
  plans.forEach((plan, i) => {
    const guest = GUESTS[(i * 3) % GUESTS.length];
    const startsAt = at(plan.day, plan.time);
    const table = String((i % 8) + 1);
    let id: string | undefined;
    const step = (when: Date, label: string, run: (id: string) => Promise<unknown>): void =>
      schedule(when, label, async () => (id ? run(id) : undefined));

    schedule(at(plan.day - 2, "12:00"), "request table", async () => {
      id = (await requestReservation.execute({ startsAt, partySize: plan.party }, guest, new Date())).id;
    });
    if (plan.flow === "requested") return;
    if (plan.flow === "cancelled") {
      step(at(plan.day - 1, "10:00"), "cancel table", (r) =>
        changeReservation.execute(r, { status: "cancelled" }, STAFF),
      );
      return;
    }
    step(at(plan.day - 1, "10:00"), "confirm table", (r) =>
      changeReservation.execute(r, { status: "confirmed", tableLabel: table }, STAFF),
    );
    if (plan.flow === "noShow") {
      step(plusMinutes(startsAt, 45), "no-show", (r) => changeReservation.execute(r, { status: "noShow" }, STAFF));
    } else if (plan.flow === "completed") {
      step(startsAt, "seat table", (r) => changeReservation.execute(r, { status: "seated" }, STAFF));
      step(plusMinutes(startsAt, 90), "free table", (r) =>
        changeReservation.execute(r, { status: "completed" }, STAFF),
      );
    }
  });
}

function planSuite(): void {
  type Stay = { requested: number; checkIn: number; nights: number; guests: number; flow: SuiteBookingStatus[] };
  const stays: Stay[] = [
    { requested: -25, checkIn: -18, nights: 3, guests: 2, flow: ["confirmed", "checkedIn", "checkedOut"] },
    { requested: -10, checkIn: -1, nights: 3, guests: 2, flow: ["confirmed", "checkedIn"] },
    { requested: -4, checkIn: 6, nights: 3, guests: 3, flow: ["confirmed"] },
    { requested: -1, checkIn: 14, nights: 2, guests: 1, flow: [] },
    { requested: -8, checkIn: 20, nights: 2, guests: 2, flow: ["cancelled"] },
  ];
  stays.forEach((stay, i) => {
    const guest = GUESTS[(i * 5 + 1) % GUESTS.length];
    let id: string | undefined;
    schedule(at(stay.requested, "11:00"), "request suite", async () => {
      id = (
        await requestSuite.execute(
          { checkIn: day(stay.checkIn), checkOut: day(stay.checkIn + stay.nights), guests: stay.guests },
          guest,
          new Date(),
        )
      ).id;
    });
    const when: Record<SuiteBookingStatus, Date | undefined> = {
      requested: undefined,
      noShow: undefined,
      confirmed: at(stay.requested + 1, "10:00"),
      cancelled: at(stay.requested + 1, "10:00"),
      checkedIn: at(stay.checkIn, "14:00"),
      checkedOut: at(stay.checkIn + stay.nights, "12:00"),
    };
    for (const status of stay.flow) {
      const moment = when[status];
      if (moment)
        schedule(moment, `suite ${status}`, async () => (id ? changeSuite.execute(id, status, STAFF) : undefined));
    }
  });
}

// ── The lending shelf ────────────────────────────────────────────────────────

function planLoans(): void {
  type Loan = {
    book: string;
    guest: Guest | { name: string; phone: string };
    lent: number;
    due?: number;
    end?: [number, "returned" | "lost"];
  };
  const loans: Loan[] = [
    { book: "seed-book-savushun", guest: GUESTS[2], lent: -24, end: [-12, "returned"] },
    { book: "seed-book-blind-owl", guest: GUESTS[4], lent: -20, due: -6 }, // overdue
    {
      book: "seed-book-blind-owl",
      guest: { name: "Walk-in guest", phone: "09351234567" },
      lent: -15,
      due: -2,
      end: [-1, "lost"],
    },
    { book: "seed-book-blind-owl", guest: GUESTS[1], lent: -13, end: [-4, "returned"] },
    { book: "seed-book-savushun", guest: GUESTS[6], lent: -5 },
    { book: "seed-book-savushun", guest: GUESTS[8], lent: -4, due: 3 },
  ];
  for (const loan of loans) {
    let id: string | undefined;
    schedule(at(loan.lent, "16:00"), "lend book", async () => {
      id = (
        await lendBook.execute(
          {
            productId: loan.book,
            borrowerName: loan.guest.name,
            borrowerPhone: loan.guest.phone,
            dueOn: loan.due === undefined ? undefined : day(loan.due),
          },
          STAFF,
          new Date(),
        )
      ).id;
    });
    const end = loan.end;
    if (end) {
      schedule(at(end[0], "17:00"), `book ${end[1]}`, async () =>
        id ? changeLoan.execute(id, end[1], STAFF, new Date()) : undefined,
      );
    }
  }
  // Both copies of Savushun are out, so guests queue for it.
  schedule(at(-3, "12:00"), "join waitlist", () => joinWaitlist.execute("seed-book-savushun", GUESTS[3]));
  schedule(at(-2, "12:00"), "join waitlist", () => joinWaitlist.execute("seed-book-savushun", GUESTS[10]));
}

// ── Events ───────────────────────────────────────────────────────────────────

function planEventSignUps(): void {
  const signUps: [string, Guest, number, number][] = [
    ["seed-event-book-club", GUESTS[0], 1, -6],
    ["seed-event-book-club", GUESTS[2], 2, -5],
    ["seed-event-book-club", GUESTS[5], 1, -4],
    ["seed-event-book-club", GUESTS[7], 3, -3],
    ["seed-event-book-club", GUESTS[9], 1, -1],
    ["seed-event-reading", GUESTS[1], 2, -4],
    ["seed-event-reading", GUESTS[3], 1, -2],
    ["seed-event-reading", GUESTS[11], 4, -1],
  ];
  signUps.forEach(([eventId, guest, seats, offset], i) => {
    let id: string | undefined;
    schedule(at(offset, "20:00"), "event sign-up", async () => {
      id = (await registerForEvent.execute(eventId, seats, guest, new Date())).id;
    });
    if (i === 3) {
      schedule(at(offset + 1, "11:00"), "cancel sign-up", async () =>
        id ? cancelRegistration.execute(eventId, id, STAFF) : undefined,
      );
    }
  });
}

// ── Run ──────────────────────────────────────────────────────────────────────

async function prepare(): Promise<ActivityActor> {
  if (!(await prisma.product.findUnique({ where: { id: "seed-espresso" } }))) {
    throw new Error("The sample menu isn't there — run `npm run db:seed` first.");
  }
  const ids = GUESTS.map((guest) => guest.id);
  if ((await prisma.order.count({ where: { userId: { in: ids } } })) > 0) {
    throw new Error(
      "The demo history is already loaded. Reset the database (`npx prisma migrate reset`) to load it again.",
    );
  }
  if (await c.cashShiftRepository.getOpen()) {
    throw new Error("A till shift is open — close it in the dashboard first; the demo opens its own shifts.");
  }

  clock = at(-DAYS - 1, "09:00").getTime();
  for (const guest of GUESTS) {
    await prisma.user.upsert({
      where: { id: guest.id },
      create: { ...guest, role: "customer" },
      update: {},
    });
  }
  await prisma.user.upsert({
    where: { id: STAFF.id },
    create: { id: STAFF.id, phone: STAFF_PHONE, name: STAFF.name, role: "staff" },
    update: {},
  });
  // Enough on the shelf for a month of orders (books keep their real copy count).
  await prisma.product.updateMany({
    where: { id: { startsWith: "seed-" }, kind: { not: "book" } },
    data: { stockQuantity: 1000 },
  });
  await prisma.product.update({ where: { id: "seed-book-blind-owl" }, data: { stockQuantity: 12 } });
  await prisma.product.update({ where: { id: "seed-book-uncle-napoleon" }, data: { stockQuantity: 8 } });

  const ownerPhone = process.env.SEED_OWNER_PHONE?.trim();
  const owner = ownerPhone ? await prisma.user.findUnique({ where: { id: normalizePhone(ownerPhone) } }) : null;
  return owner ? { id: owner.id, name: owner.name } : STAFF;
}

async function main(): Promise<void> {
  const owner = await prepare();
  planPromotions();
  planPurchasing(owner);
  planShifts();
  planOrders();
  planReservations();
  planSuite();
  planLoans();
  planEventSignUps();

  const due = steps
    .map((step, index) => ({ ...step, index }))
    .filter((step) => step.at.getTime() <= REAL_NOW - 60_000)
    .sort((a, b) => a.at.getTime() - b.at.getTime() || a.index - b.index);

  let lastDay = "";
  for (const step of due) {
    clock = step.at.getTime();
    const stepDay = cafeDayOf(step.at);
    if (stepDay !== lastDay) {
      process.stdout.write(`\r${stepDay}  `);
      lastDay = stepDay;
    }
    try {
      await step.run();
    } catch (error) {
      tally.failed++;
      console.warn(
        `\n  ${step.label} at ${step.at.toISOString()}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  clock = REAL_NOW;

  console.warn(
    `\nDemo history loaded: ${tally.orders} orders over ${DAYS} days, ${due.length} steps` +
      (tally.failed ? ` (${tally.failed} skipped — see above).` : "."),
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
