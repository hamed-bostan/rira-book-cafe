import type { PaymentAttempt, PaymentFailureReason } from "../entities/PaymentAttempt";

export type NewPaymentAttempt = Pick<PaymentAttempt, "orderId" | "provider" | "authority" | "amount">;

/** How a claimed attempt ended. */
export type PaymentAttemptResult =
  | { status: "paid" | "unapplied"; refId: string; cardPan?: string }
  | { status: "failed"; failureReason: PaymentFailureReason; gatewayCode?: string };

export type IPaymentAttemptRepository = {
  /**
   * Record a new attempt for an order, atomically making it the order's only live
   * one: earlier `pending` attempts become `failed`/`superseded` (their callbacks
   * can no longer verify, so the gateway returns any money sent through them).
   * Refused with `ConflictError("PAYMENT_IN_PROGRESS")` while another attempt for
   * the order is being verified.
   */
  open(input: NewPaymentAttempt): Promise<PaymentAttempt>;
  getByAuthority(authority: string): Promise<PaymentAttempt | null>;
  /**
   * Take the attempt for verification: `pending` → `verifying`, or re-take one stuck
   * in `verifying` since before `staleBefore` (a request that died mid-check).
   * Guarded, so of two concurrent callbacks exactly one gets the attempt; the other
   * gets `null`.
   */
  claim(id: string, staleBefore: Date): Promise<PaymentAttempt | null>;
  /**
   * Hand a claimed attempt back (`verifying` → `pending`) after a failure, so a
   * retried callback can take it again. `captured` keeps the gateway's confirmation
   * when the failure came after it (the money is taken; only booking is left).
   */
  release(id: string, captured?: { refId: string; cardPan?: string }): Promise<void>;
  /** Settle a claimed attempt (`verifying` → its result). */
  finish(id: string, result: PaymentAttemptResult): Promise<PaymentAttempt>;
};
