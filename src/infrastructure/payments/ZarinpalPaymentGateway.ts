import { PaymentGatewayError } from "@/src/domain/errors/PaymentGatewayError";
import type {
  GatewayPaymentRequest,
  GatewayPaymentSession,
  GatewayVerification,
  IPaymentGateway,
} from "@/src/domain/repositories/IPaymentGateway";

const PRODUCTION_BASE_URL = "https://payment.zarinpal.com";
const SANDBOX_BASE_URL = "https://sandbox.zarinpal.com";
/** The sandbox accepts any well-formed merchant id. */
const SANDBOX_MERCHANT_ID = "00000000-0000-0000-0000-000000000000";
const REQUEST_TIMEOUT_MS = 15_000;
/** Zarinpal speaks Rial; the domain speaks Toman. */
const RIAL_PER_TOMAN = 10;
/** 100: success. 101 (verify only): already verified earlier — still a success. */
const OK = 100;
const ALREADY_VERIFIED = 101;

export type ZarinpalConfig = {
  /** The merchant id (a UUID) from the Zarinpal panel; without one the sandbox is used. */
  merchantId?: string;
  /** Force the sandbox even with a merchant id (staging). */
  sandbox?: boolean;
};

/**
 * Zarinpal REST API v4 — the request/verify pair:
 *  1. `payment/request.json` opens a payment and returns an `authority`; the guest
 *     is sent to `StartPay/{authority}`;
 *  2. Zarinpal sends the guest back to the callback with `?Authority=…&Status=OK|NOK`;
 *  3. `payment/verify.json` confirms the payment server-to-server for the same
 *     amount. Only verification captures the money: an unverified payment is
 *     returned to the payer by Zarinpal on its own.
 *
 * Replies carry `data` (with `code`) on success and `errors` (with `code`) on a
 * refusal, whatever the HTTP status, so both are read from the body.
 */
export class ZarinpalPaymentGateway implements IPaymentGateway {
  readonly provider = "zarinpal";
  private readonly baseUrl: string;
  private readonly merchantId: string;

  constructor(config: ZarinpalConfig) {
    const sandbox = config.sandbox || !config.merchantId;
    this.baseUrl = sandbox ? SANDBOX_BASE_URL : PRODUCTION_BASE_URL;
    this.merchantId = config.merchantId || SANDBOX_MERCHANT_ID;
  }

  /** Whether payments go to the sandbox (no money moves). */
  get isSandbox(): boolean {
    return this.baseUrl === SANDBOX_BASE_URL;
  }

  async request(input: GatewayPaymentRequest): Promise<GatewayPaymentSession> {
    const reply = await this.post("/pg/v4/payment/request.json", {
      merchant_id: this.merchantId,
      amount: toRial(input.amount),
      callback_url: input.callbackUrl,
      description: input.description,
      ...(input.mobile ? { metadata: { mobile: input.mobile } } : {}),
    });
    const authority = typeof reply.data?.authority === "string" ? reply.data.authority : undefined;
    if (reply.data?.code !== OK || !authority) {
      const code = reply.errorCode ?? String(reply.data?.code ?? "unknown");
      throw new PaymentGatewayError(`Zarinpal refused to open the payment (code ${code}).`, code);
    }
    return { authority, redirectUrl: `${this.baseUrl}/pg/StartPay/${encodeURIComponent(authority)}` };
  }

  async verify(input: { authority: string; amount: number }): Promise<GatewayVerification> {
    const reply = await this.post("/pg/v4/payment/verify.json", {
      merchant_id: this.merchantId,
      amount: toRial(input.amount),
      authority: input.authority,
    });
    const code = reply.data?.code;
    const refId = reply.data?.ref_id;
    if ((code === OK || code === ALREADY_VERIFIED) && (typeof refId === "number" || typeof refId === "string")) {
      return {
        ok: true,
        refId: String(refId),
        cardPan: typeof reply.data?.card_pan === "string" ? reply.data.card_pan : undefined,
        alreadyVerified: code === ALREADY_VERIFIED,
      };
    }
    if (reply.errorCode) return { ok: false, code: reply.errorCode };
    if (typeof code === "number") return { ok: false, code: String(code) };
    throw new PaymentGatewayError("Zarinpal's verify reply had neither a result nor an error.");
  }

  /** POST JSON and read the envelope; a transport failure or an unreadable reply throws. */
  private async post(path: string, body: Record<string, unknown>): Promise<ZarinpalReply> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: "no-store",
      });
    } catch (error) {
      throw new PaymentGatewayError("Couldn't reach Zarinpal.", undefined, { cause: error });
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch (error) {
      throw new PaymentGatewayError(`Zarinpal answered ${response.status} without JSON.`, undefined, { cause: error });
    }
    return readReply(json);
  }
}

type ZarinpalData = {
  code?: number;
  authority?: unknown;
  ref_id?: unknown;
  card_pan?: unknown;
};

type ZarinpalReply = { data?: ZarinpalData; errorCode?: string };

/** `data` is an object on success and `[]` on failure; `errors` the reverse. */
function readReply(json: unknown): ZarinpalReply {
  if (!json || typeof json !== "object") return {};
  const { data, errors } = json as { data?: unknown; errors?: unknown };
  const reply: ZarinpalReply = {};
  if (data && typeof data === "object" && !Array.isArray(data)) reply.data = data;
  if (errors && typeof errors === "object" && !Array.isArray(errors)) {
    const code = (errors as { code?: unknown }).code;
    if (typeof code === "number" || typeof code === "string") reply.errorCode = String(code);
  }
  return reply;
}

function toRial(toman: number): number {
  return toman * RIAL_PER_TOMAN;
}
