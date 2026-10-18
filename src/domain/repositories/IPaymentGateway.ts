/**
 * An online payment gateway (Zarinpal today). Amounts cross this port in whole
 * Toman, like everything else in the domain; an adapter converts to whatever unit
 * its gateway speaks.
 */

export type GatewayPaymentRequest = {
  /** Whole Toman. */
  amount: number;
  /** Where the gateway sends the guest back; it appends its own query (authority, status). */
  callbackUrl: string;
  /** Shown to the guest on the gateway's page, e.g. "Order #42". */
  description: string;
  /** The guest's mobile, so the gateway can offer their saved cards. */
  mobile?: string;
};

export type GatewayPaymentSession = {
  /** The gateway's id for this try. */
  authority: string;
  /** The gateway page to send the guest to. */
  redirectUrl: string;
};

/**
 * The gateway's answer to "did this payment go through, for this amount?".
 * `alreadyVerified` is a repeat confirmation of a payment verified earlier (a
 * retried callback) — still a success; the money was captured once.
 */
export type GatewayVerification =
  { ok: true; refId: string; cardPan?: string; alreadyVerified: boolean } | { ok: false; code: string };

export type IPaymentGateway = {
  /** Stored on each attempt, e.g. "zarinpal". */
  readonly provider: string;
  /** Open a payment. Throws `PaymentGatewayError` when the gateway can't be reached or refuses. */
  request(input: GatewayPaymentRequest): Promise<GatewayPaymentSession>;
  /**
   * Confirm (and capture) a payment server-to-server, for exactly `amount`. A
   * definite refusal resolves `{ ok: false }`; not reaching the gateway throws
   * `PaymentGatewayError`, since then nothing is known and the check must be retried.
   */
  verify(input: { authority: string; amount: number }): Promise<GatewayVerification>;
};
