import { describe, expect, it, vi } from "vitest";

import { ConflictError } from "../../../errors/ConflictError";
import { NotFoundError } from "../../../errors/NotFoundError";
import { PaymentGatewayError } from "../../../errors/PaymentGatewayError";
import { StartOnlinePayment, VerifyOnlinePayment } from "../OnlinePayment";

import type { Order } from "../../../entities/Order";
import type { PaymentAttempt } from "../../../entities/PaymentAttempt";
import type { IOrderRepository, PaymentChange } from "../../../repositories/IOrderRepository";
import type {
  IPaymentAttemptRepository,
  NewPaymentAttempt,
  PaymentAttemptResult,
} from "../../../repositories/IPaymentAttemptRepository";
import type { GatewayVerification, IPaymentGateway } from "../../../repositories/IPaymentGateway";

const NOW = new Date("2026-10-16T10:00:00Z");

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: "o1",
    orderNumber: 42,
    userId: "guest",
    customerName: "Sara",
    customerPhone: "09120000000",
    status: "accepted",
    serviceType: "takeaway",
    paymentStatus: "unpaid",
    items: [{ id: "i1", productId: "p1", kind: "drink", name: "Latte", imageUrl: "", unitPrice: 150_000, quantity: 2 }],
    subtotal: 300_000,
    promoDiscount: 0,
    pointsRedeemed: 0,
    pointsDiscount: 0,
    pointsEarned: 0,
    total: 300_000,
    placedAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

/** An in-memory attempt store with the same guards as the Prisma one. */
function attemptStore(initial: PaymentAttempt[] = []) {
  const rows = new Map(initial.map((attempt) => [attempt.id, { ...attempt }]));
  let next = rows.size + 1;
  const repo: IPaymentAttemptRepository = {
    async open(input: NewPaymentAttempt) {
      const attempt: PaymentAttempt = {
        ...input,
        id: `a${next++}`,
        status: "pending",
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
      };
      rows.set(attempt.id, attempt);
      return attempt;
    },
    async getByAuthority(authority) {
      return [...rows.values()].find((row) => row.authority === authority) ?? null;
    },
    claim: vi.fn(async (id: string) => {
      const row = rows.get(id);
      if (row?.status !== "pending") return null;
      row.status = "verifying";
      return { ...row };
    }),
    release: vi.fn(async (id: string, captured?: { refId: string; cardPan?: string }) => {
      const row = rows.get(id);
      if (row?.status === "verifying") Object.assign(row, { status: "pending" }, captured ?? {});
    }),
    finish: vi.fn(async (id: string, result: PaymentAttemptResult) => {
      const row = rows.get(id)!;
      if (row.status === "verifying") Object.assign(row, result);
      return { ...row };
    }),
  };
  return { repo, rows };
}

function pendingAttempt(overrides: Partial<PaymentAttempt> = {}): PaymentAttempt {
  return {
    id: "a1",
    orderId: "o1",
    provider: "zarinpal",
    authority: "A000000000000000000000000000AUTH1",
    amount: 300_000,
    status: "pending",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

/** An order repository that applies payment marks guarded on `from`, like the real one. */
function orderStore(initial: Order) {
  let current = { ...initial };
  const setPaymentStatus = vi.fn(async (_id: string, change: PaymentChange, _audit?: unknown, _ledger?: unknown) => {
    if (current.paymentStatus !== change.from) throw new ConflictError("INVALID_TRANSITION", "lost the race");
    current = { ...current, paymentStatus: change.to, paymentMethod: change.method };
    return current;
  });
  const repo = { getById: vi.fn(async () => current), setPaymentStatus } as unknown as IOrderRepository;
  return {
    repo,
    setPaymentStatus,
    get current() {
      return current;
    },
    set(next: Order) {
      current = next;
    },
  };
}

function gatewayWith(
  verification: GatewayVerification | Error = {
    ok: true,
    refId: "201",
    cardPan: "6037****1234",
    alreadyVerified: false,
  },
) {
  const verify = vi.fn(async () => {
    if (verification instanceof Error) throw verification;
    return verification;
  });
  const request = vi.fn(async () => ({
    authority: "A000000000000000000000000000AUTH1",
    redirectUrl: "https://sandbox.zarinpal.com/pg/StartPay/A1",
  }));
  const gateway: IPaymentGateway = { provider: "zarinpal", request, verify };
  return { gateway, request, verify };
}

const CALLBACK = { orderId: "o1", authority: "A000000000000000000000000000AUTH1", completed: true };

describe("StartOnlinePayment", () => {
  it("opens a payment for the order's total and records the attempt", async () => {
    const orders = orderStore(order());
    const { repo, rows } = attemptStore();
    const { gateway, request } = gatewayWith();

    const result = await new StartOnlinePayment(orders.repo, repo, gateway).execute(
      "o1",
      "guest",
      "https://cafe.test/api/orders/o1/pay/callback",
    );

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 300_000, description: "Order #42", mobile: "09120000000" }),
    );
    expect(result.redirectUrl).toContain("StartPay");
    expect([...rows.values()]).toEqual([
      expect.objectContaining({ orderId: "o1", amount: 300_000, status: "pending", provider: "zarinpal" }),
    ]);
  });

  it("reads someone else's order as not found", async () => {
    const { gateway, request } = gatewayWith();
    await expect(
      new StartOnlinePayment(orderStore(order()).repo, attemptStore().repo, gateway).execute("o1", "intruder", "cb"),
    ).rejects.toThrow(NotFoundError);
    expect(request).not.toHaveBeenCalled();
  });

  it.each([
    ["paid", order({ paymentStatus: "paid", paymentMethod: "cash" })],
    ["cancelled", order({ status: "cancelled" })],
    ["free", order({ total: 0 })],
  ])("refuses a %s order before contacting the gateway", async (_label, target) => {
    const { gateway, request } = gatewayWith();
    await expect(
      new StartOnlinePayment(orderStore(target).repo, attemptStore().repo, gateway).execute("o1", "guest", "cb"),
    ).rejects.toMatchObject({
      code: "NOT_PAYABLE",
    });
    expect(request).not.toHaveBeenCalled();
  });
});

describe("VerifyOnlinePayment", () => {
  it("verifies for the attempt's amount and marks the order paid online, with its ledger posting", async () => {
    const orders = orderStore(order());
    const { repo, rows } = attemptStore([pendingAttempt()]);
    const { gateway, verify } = gatewayWith();

    const outcome = await new VerifyOnlinePayment(orders.repo, repo, gateway).execute(CALLBACK, NOW);

    expect(outcome).toBe("paid");
    expect(verify).toHaveBeenCalledWith({ authority: CALLBACK.authority, amount: 300_000 });
    expect(orders.setPaymentStatus).toHaveBeenCalledWith(
      "o1",
      { from: "unpaid", to: "paid", method: "online" },
      expect.any(Function),
      expect.any(Function),
    );
    // The ledger hook is SetOrderPayment's: Dr 1130 Gateway clearing / Cr 1150 Guest receivables.
    const ledger = orders.setPaymentStatus.mock.calls[0][3] as (
      saved: Order,
    ) => { lines: { accountCode: string; debit: number; credit: number }[] }[];
    const [entry] = ledger({ ...orders.current });
    expect(entry.lines).toEqual([
      { accountCode: "1130", debit: 300_000, credit: 0 },
      { accountCode: "1150", debit: 0, credit: 300_000 },
    ]);
    expect(rows.get("a1")).toMatchObject({ status: "paid", refId: "201", cardPan: "6037****1234" });
  });

  describe("idempotency", () => {
    it("a repeated callback reports the result without verifying or booking again", async () => {
      const orders = orderStore(order());
      const { repo } = attemptStore([pendingAttempt()]);
      const { gateway, verify } = gatewayWith();
      const useCase = new VerifyOnlinePayment(orders.repo, repo, gateway);

      expect(await useCase.execute(CALLBACK, NOW)).toBe("paid");
      expect(await useCase.execute(CALLBACK, NOW)).toBe("paid");
      expect(await useCase.execute(CALLBACK, NOW)).toBe("paid");

      expect(verify).toHaveBeenCalledTimes(1);
      expect(orders.setPaymentStatus).toHaveBeenCalledTimes(1);
    });

    it("two concurrent callbacks verify and book once", async () => {
      const orders = orderStore(order());
      const { repo } = attemptStore([pendingAttempt()]);
      const { gateway, verify } = gatewayWith();
      const useCase = new VerifyOnlinePayment(orders.repo, repo, gateway);

      const outcomes = await Promise.all([useCase.execute(CALLBACK, NOW), useCase.execute(CALLBACK, NOW)]);

      expect(outcomes.sort()).toEqual(["paid", "processing"]);
      expect(verify).toHaveBeenCalledTimes(1);
      expect(orders.setPaymentStatus).toHaveBeenCalledTimes(1);
    });

    it("a failed attempt stays failed — a late OK can't revive it", async () => {
      const orders = orderStore(order());
      const { repo } = attemptStore([pendingAttempt({ status: "failed", failureReason: "superseded" })]);
      const { gateway, verify } = gatewayWith();

      expect(await new VerifyOnlinePayment(orders.repo, repo, gateway).execute(CALLBACK, NOW)).toBe("failed");
      expect(verify).not.toHaveBeenCalled();
      expect(orders.setPaymentStatus).not.toHaveBeenCalled();
    });

    it("a gateway outage hands the attempt back, and the retry completes it", async () => {
      const orders = orderStore(order());
      const { repo, rows } = attemptStore([pendingAttempt()]);
      const down = gatewayWith(new PaymentGatewayError("timeout"));

      await expect(new VerifyOnlinePayment(orders.repo, repo, down.gateway).execute(CALLBACK, NOW)).rejects.toThrow(
        PaymentGatewayError,
      );
      expect(rows.get("a1")?.status).toBe("pending");
      expect(orders.setPaymentStatus).not.toHaveBeenCalled();

      const up = gatewayWith({ ok: true, refId: "201", alreadyVerified: false });
      expect(await new VerifyOnlinePayment(orders.repo, repo, up.gateway).execute(CALLBACK, NOW)).toBe("paid");
      expect(orders.setPaymentStatus).toHaveBeenCalledTimes(1);
    });

    it("a retry after the money was captured books it without asking the gateway again", async () => {
      const orders = orderStore(order());
      const { repo, rows } = attemptStore([pendingAttempt({ refId: "201" })]);
      const { gateway, verify } = gatewayWith();

      expect(
        await new VerifyOnlinePayment(orders.repo, repo, gateway).execute({ ...CALLBACK, completed: false }, NOW),
      ).toBe("paid");
      expect(verify).not.toHaveBeenCalled();
      expect(orders.setPaymentStatus).toHaveBeenCalledTimes(1);
      expect(rows.get("a1")).toMatchObject({ status: "paid", refId: "201" });
    });

    it("a retry after the booking committed only finishes the attempt", async () => {
      const orders = orderStore(order({ paymentStatus: "paid", paymentMethod: "online" }));
      const { repo, rows } = attemptStore([pendingAttempt({ refId: "201" })]);
      const { gateway } = gatewayWith();

      expect(await new VerifyOnlinePayment(orders.repo, repo, gateway).execute(CALLBACK, NOW)).toBe("paid");
      expect(orders.setPaymentStatus).not.toHaveBeenCalled();
      expect(rows.get("a1")?.status).toBe("paid");
    });
  });

  describe("amount checks", () => {
    it("leaves the payment unverified when the order's total no longer matches the attempt", async () => {
      const orders = orderStore(order({ total: 350_000 }));
      const { repo, rows } = attemptStore([pendingAttempt()]);
      const { gateway, verify } = gatewayWith();

      expect(await new VerifyOnlinePayment(orders.repo, repo, gateway).execute(CALLBACK, NOW)).toBe("failed");

      // Not verified, so the gateway returns the money to the guest by itself.
      expect(verify).not.toHaveBeenCalled();
      expect(orders.setPaymentStatus).not.toHaveBeenCalled();
      expect(rows.get("a1")).toMatchObject({ status: "failed", failureReason: "amountMismatch" });
    });

    it("treats the gateway refusing the amount as declined", async () => {
      const orders = orderStore(order());
      const { repo, rows } = attemptStore([pendingAttempt()]);
      const { gateway } = gatewayWith({ ok: false, code: "-50" });

      expect(await new VerifyOnlinePayment(orders.repo, repo, gateway).execute(CALLBACK, NOW)).toBe("failed");
      expect(orders.setPaymentStatus).not.toHaveBeenCalled();
      expect(rows.get("a1")).toMatchObject({ status: "failed", failureReason: "declined", gatewayCode: "-50" });
    });
  });

  it("records a cancel at the gateway without verifying", async () => {
    const orders = orderStore(order());
    const { repo, rows } = attemptStore([pendingAttempt()]);
    const { gateway, verify } = gatewayWith();

    expect(
      await new VerifyOnlinePayment(orders.repo, repo, gateway).execute({ ...CALLBACK, completed: false }, NOW),
    ).toBe("failed");
    expect(verify).not.toHaveBeenCalled();
    expect(rows.get("a1")).toMatchObject({ status: "failed", failureReason: "cancelled" });
  });

  it("doesn't take money for an order paid another way meanwhile", async () => {
    const orders = orderStore(order({ paymentStatus: "paid", paymentMethod: "cash" }));
    const { repo, rows } = attemptStore([pendingAttempt()]);
    const { gateway, verify } = gatewayWith();

    expect(await new VerifyOnlinePayment(orders.repo, repo, gateway).execute(CALLBACK, NOW)).toBe("failed");
    expect(verify).not.toHaveBeenCalled();
    expect(rows.get("a1")).toMatchObject({ status: "failed", failureReason: "orderNotPayable" });
  });

  it("flags a capture that lost the race with a staff mark for refund, without booking it twice", async () => {
    const orders = orderStore(order());
    const { repo, rows } = attemptStore([pendingAttempt()]);
    const { gateway, verify } = gatewayWith();
    // Staff mark it paid in cash while the gateway is verifying.
    verify.mockImplementationOnce(async () => {
      orders.set({ ...orders.current, paymentStatus: "paid", paymentMethod: "cash" });
      return { ok: true, refId: "201", alreadyVerified: false };
    });

    expect(await new VerifyOnlinePayment(orders.repo, repo, gateway).execute(CALLBACK, NOW)).toBe("review");
    expect(orders.setPaymentStatus).not.toHaveBeenCalled();
    expect(orders.current.paymentMethod).toBe("cash");
    expect(rows.get("a1")).toMatchObject({ status: "unapplied", refId: "201" });
  });

  it("refuses an authority issued for another order", async () => {
    const { gateway } = gatewayWith();
    await expect(
      new VerifyOnlinePayment(
        orderStore(order()).repo,
        attemptStore([pendingAttempt({ orderId: "o2" })]).repo,
        gateway,
      ).execute(CALLBACK, NOW),
    ).rejects.toThrow(NotFoundError);
  });
});
