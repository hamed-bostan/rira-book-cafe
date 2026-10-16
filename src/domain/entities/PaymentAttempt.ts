/**
 * One try at paying an order online. The guest is sent to the gateway with an
 * `authority` (the gateway's id for the try); when they come back, the attempt is
 * verified with the gateway server-to-server and, only then, the order is marked
 * paid. Amounts are whole Toman, like the order they pay for.
 *
 * The life of an attempt:
 *  - `pending` — the guest was sent to the gateway; nothing is known yet.
 *  - `verifying` — a callback claimed it and is talking to the gateway. The claim is
 *    what makes verification happen once even when the callback is hit twice.
 *  - `paid` — verified, and the order was marked paid (method `online`).
 *  - `failed` — not verified: the guest cancelled, the gateway declined, or the
 *    order could no longer take the money. An unverified payment is returned to
 *    the guest by the gateway on its own, so nothing was captured.
 *  - `unapplied` — the gateway captured the money but the order had meanwhile been
 *    paid another way. Staff refund the guest; the order's books are untouched.
 */
export const PAYMENT_ATTEMPT_STATUSES = ["pending", "verifying", "paid", "failed", "unapplied"] as const;
export type PaymentAttemptStatus = (typeof PAYMENT_ATTEMPT_STATUSES)[number];

/** Why an attempt failed. */
export const PAYMENT_FAILURE_REASONS = [
  /** The guest backed out at the gateway (`Status=NOK`). */
  "cancelled",
  /** The guest started a newer attempt; this one can no longer be verified. */
  "superseded",
  /** What the attempt asked for no longer matches the order's total. */
  "amountMismatch",
  /** The order was cancelled or already paid by the time the guest came back. */
  "orderNotPayable",
  /** The gateway refused to verify the payment. */
  "declined",
] as const;
export type PaymentFailureReason = (typeof PAYMENT_FAILURE_REASONS)[number];

export type PaymentAttempt = {
  id: string;
  orderId: string;
  /** Which gateway, e.g. "zarinpal". */
  provider: string;
  /** The gateway's id for this try. Unique: a callback names exactly one attempt. */
  authority: string;
  /** Whole Toman asked of the gateway — the order's total when the attempt began. */
  amount: number;
  status: PaymentAttemptStatus;
  failureReason?: PaymentFailureReason;
  /** The gateway's own result code for a refused verification, for support. */
  gatewayCode?: string;
  /** The gateway's reference for a captured payment (Zarinpal `ref_id`) — what the guest's bank shows. */
  refId?: string;
  /** The masked card the guest paid with, when the gateway reports it. */
  cardPan?: string;
  /** ISO 8601 (UTC). */
  createdAt: string;
  updatedAt: string;
};

/** Whether a callback can still change the attempt. */
export function isOpenAttempt(status: PaymentAttemptStatus): boolean {
  return status === "pending" || status === "verifying";
}

/**
 * What the guest is told when they land back on their order:
 *  - `paid` — done;
 *  - `failed` — nothing was taken (an unverified payment goes back by itself);
 *  - `processing` — another request is verifying it right now;
 *  - `review` — the money was taken but the order was already paid; staff will refund.
 */
export const PAYMENT_OUTCOMES = ["paid", "failed", "processing", "review"] as const;
export type PaymentOutcome = (typeof PAYMENT_OUTCOMES)[number];

export function outcomeOf(attempt: Pick<PaymentAttempt, "status">): PaymentOutcome {
  switch (attempt.status) {
    case "paid":
      return "paid";
    case "unapplied":
      return "review";
    case "failed":
      return "failed";
    default:
      return "processing";
  }
}
