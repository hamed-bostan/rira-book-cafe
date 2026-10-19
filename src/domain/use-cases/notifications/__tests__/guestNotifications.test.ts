import { describe, expect, it } from "vitest";

import { loanReminder, orderStatusNotification } from "../guestNotifications";

import type { BookLoan } from "../../../entities/BookLoan";
import type { Order, OrderStatus } from "../../../entities/Order";

const NOW = new Date("2026-10-20T10:00:00Z");

function order(status: OrderStatus, overrides: Partial<Order> = {}): Order {
  return {
    id: "o1",
    orderNumber: 42,
    userId: "g1",
    customerName: "Sara",
    customerPhone: "0912",
    status,
    serviceType: "takeaway",
    paymentStatus: "unpaid",
    items: [],
    subtotal: 100_000,
    promoDiscount: 0,
    pointsRedeemed: 0,
    pointsDiscount: 0,
    pointsEarned: 0,
    total: 100_000,
    placedAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

function loan(dueAt: string, overrides: Partial<BookLoan> = {}): BookLoan {
  return {
    id: "l1",
    reference: 3,
    productId: "b1",
    bookTitle: "The Blind Owl",
    userId: "g1",
    borrowerName: "Sara",
    borrowerPhone: "09121234567",
    lentAt: "2026-10-01T10:00:00Z",
    dueAt,
    status: "out",
    lentById: "s1",
    lentByName: "Ali",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("orderStatusNotification", () => {
  it("tells the guest their order is being prepared, keyed so it's sent once", () => {
    expect(orderStatusNotification(order("preparing"))).toMatchObject({
      userId: "g1",
      kind: "orderAccepted",
      params: { orderNumber: 42, serviceType: "takeaway" },
      link: "/orders/o1",
      dedupeKey: "order:o1:preparing",
    });
  });

  it("stays quiet about the guest's own placement", () => {
    expect(orderStatusNotification(order("pending"))).toBeNull();
  });

  it("says what a completed order earned instead of a plain 'done'", () => {
    expect(orderStatusNotification(order("completed", { pointsEarned: 10 }))).toMatchObject({
      kind: "pointsEarned",
      params: { points: 10 },
    });
    expect(orderStatusNotification(order("completed"))?.kind).toBe("orderCompleted");
  });
});

describe("loanReminder", () => {
  it("reminds within two days of the due date, then once overdue", () => {
    expect(loanReminder(loan("2026-10-21T20:29:59Z"), NOW)?.kind).toBe("loanDueSoon");
    expect(loanReminder(loan("2026-10-19T20:29:59Z"), NOW)?.kind).toBe("loanOverdue");
  });

  it("says nothing about a loan far from due, one that's back, or one with no account", () => {
    expect(loanReminder(loan("2026-11-01T20:29:59Z"), NOW)).toBeNull();
    expect(
      loanReminder(loan("2026-10-19T20:29:59Z", { status: "returned", returnedAt: NOW.toISOString() }), NOW),
    ).toBeNull();
    expect(loanReminder(loan("2026-10-19T20:29:59Z", { userId: undefined }), NOW)).toBeNull();
  });
});
