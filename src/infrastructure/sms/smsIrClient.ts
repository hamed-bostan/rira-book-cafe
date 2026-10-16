/**
 * Shared SMS.ir "verify"/pattern-send client.
 *
 * SMS.ir delivers pre-approved templates: you pass a `templateId` and the named
 * `#PARAM#` values, and it fills and sends the message. Both the OTP login
 * (`SmsIrAuthRepository`) and the transactional order notifier
 * (`SmsIrNotificationChannel`) send this way, so the request shape, phone
 * normalisation, and success check live here once instead of in each caller.
 */

const DEFAULT_BASE_URL = "https://api.sms.ir";
const REQUEST_TIMEOUT_MS = 10_000;
// SMS.ir returns `status: 1` on a successful send.
const SMS_IR_OK = 1;

/** A single `#NAME#` parameter substituted into the approved template. */
export type SmsIrPatternParam = {
  name: string;
  value: string;
};

export type SmsIrClientConfig = {
  /** Panel API key, sent as the `x-api-key` header. */
  apiKey: string;
  /** Override the API host (defaults to the public SMS.ir endpoint). */
  baseUrl?: string;
};

/** The slice of the SMS.ir response we act on. */
type SmsIrSendResponse = {
  status: number;
  message?: string;
};

/** Normalise a base URL: apply the default and strip a trailing slash. */
export function resolveSmsIrBaseUrl(baseUrl?: string): string {
  return (baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
}

/**
 * Re-exported from the domain so SMS callers and the rest of the app normalise
 * identically — the local SMS.ir format (`09xxxxxxxxx`) happens to be exactly the
 * canonical form a user's id is derived from. See `domain/entities/Phone`.
 */
export { normalizePhone } from "@/src/domain/entities/Phone";

/**
 * Send one approved template to `mobile`, substituting `params`. Resolves `true`
 * only when SMS.ir accepted the send; logs and resolves `false` on any transport
 * or API failure, so callers can treat delivery as best-effort. `mobile` is
 * expected already normalised (see {@link normalizePhone}).
 */
export async function sendPatternSms(
  config: SmsIrClientConfig,
  mobile: string,
  templateId: number,
  params: readonly SmsIrPatternParam[],
): Promise<boolean> {
  const baseUrl = resolveSmsIrBaseUrl(config.baseUrl);

  try {
    const response = await fetch(`${baseUrl}/v1/send/verify`, {
      method: "POST",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
      },
      body: JSON.stringify({
        mobile,
        templateId,
        parameters: params.map(({ name, value }) => ({ name, value })),
      }),
    });

    if (!response.ok) {
      console.error(`[sms.ir] send failed: HTTP ${response.status}`);
      return false;
    }

    const data = (await response.json()) as SmsIrSendResponse;
    if (data.status !== SMS_IR_OK) {
      console.error(`[sms.ir] send rejected: ${data.message ?? "unknown error"}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[sms.ir] send failed:", error instanceof Error ? error.message : error);
    return false;
  }
}
