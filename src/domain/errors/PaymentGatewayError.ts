/**
 * The payment gateway couldn't be reached, or refused to open a payment. Nothing
 * was charged. The presentation layer answers 502: the request was fine, the
 * upstream wasn't.
 */
export class PaymentGatewayError extends Error {
  constructor(
    message: string,
    /** The gateway's own error code, when it gave one. */
    public readonly gatewayCode?: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "PaymentGatewayError";
  }
}
