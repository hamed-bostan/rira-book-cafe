/**
 * PII scrubbing for everything that leaves the process for the error tracker
 * (Sentry or a self-hosted GlitchTip — same event format).
 *
 * A user's id *is* their normalized phone number here (see `domain/entities/Phone`),
 * so phone numbers turn up in URLs, log messages and error text, not just in a
 * `phone` field. Scrubbing therefore works on two levels: whole values are dropped
 * under sensitive keys (cookies, auth headers, tokens, OTP codes), and every
 * remaining string has phone-shaped digit runs masked.
 *
 * Framework-free and runtime-agnostic (Node, edge and browser all import it).
 */

export const REDACTED = "[redacted]";
export const PHONE_MASK = "[phone]";

/** Request headers that carry credentials or the client's network identity. */
const SENSITIVE_HEADERS = new Set([
  "cookie",
  "set-cookie",
  "authorization",
  "proxy-authorization",
  "x-api-key",
  "x-forwarded-for",
  "x-real-ip",
]);

/** Object keys whose values are dropped whole, wherever they appear. */
const SENSITIVE_KEY = /pass(word)?|secret|token|otp|cookie|authorization|api[-_]?key|phone|mobile/i;

// Digits in either script: the fa locale lets guests type Persian (۰-۹) or
// Arabic-Indic (٠-٩) numerals, and normalization happens after some logging.
const D = "[0-9۰-۹٠-٩]";
/** One specific digit in any of the three scripts. */
const digit = (n: number): string => `[${n}${String.fromCharCode(0x06f0 + n)}${String.fromCharCode(0x0660 + n)}]`;
// Iranian mobiles — 09xx…, 9xx… after +98 / 0098 / 98 — with optional separators,
// plus any other `+`-prefixed international number. Bounded by non-digits so
// longer ids (timestamps, order numbers) are left alone.
const IR_PREFIX = `(?:(?:\\+|${digit(0)}{2})?${digit(9)}${digit(8)}[\\s-]?|${digit(0)})`;
const PHONE_PATTERN = new RegExp(
  `(?<!${D})${IR_PREFIX}${digit(9)}${D}{2}[\\s-]?${D}{3}[\\s-]?${D}{4}(?!${D})|\\+${D}{8,15}(?!${D})`,
  "g",
);

/** Deep-walk guard: Sentry events are shallow, anything deeper is not worth scanning. */
const MAX_DEPTH = 12;

/** Mask phone-shaped digit runs inside free text. */
export function scrubPhoneNumbers(text: string): string {
  return text.replace(PHONE_PATTERN, PHONE_MASK);
}

/** Recursively mask phones in strings and drop values under sensitive keys. */
export function scrubValue(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return scrubPhoneNumbers(value);
  if (value === null || typeof value !== "object" || depth >= MAX_DEPTH) return value;
  if (Array.isArray(value)) return value.map((item) => scrubValue(item, depth + 1));

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    result[key] = SENSITIVE_KEY.test(key) ? REDACTED : scrubValue(entry, depth + 1);
  }
  return result;
}

/** The slice of a Sentry event this module touches (keeps it SDK-version-agnostic). */
type ScrubbableEvent = {
  request?: { headers?: Record<string, string>; cookies?: unknown };
  user?: unknown;
  tags?: Record<string, unknown>;
};

/**
 * `beforeSend` / `beforeSendTransaction` hook: strips credentials and the user's
 * identity, masks phone numbers everywhere, and lifts the proxy's `x-request-id`
 * into a tag so an event can be matched to its nginx/app log lines.
 */
export function scrubEvent<T extends ScrubbableEvent>(event: T): T {
  const headers = event.request?.headers;
  const requestId = headers?.["x-request-id"];

  if (event.request) {
    delete event.request.cookies;
    if (headers) {
      event.request.headers = Object.fromEntries(
        Object.entries(headers).filter(([name]) => !SENSITIVE_HEADERS.has(name.toLowerCase())),
      );
    }
  }
  // The id is a phone number and the IP is personal data; neither is needed to debug.
  delete event.user;

  const scrubbed = scrubValue(event) as T;
  if (requestId) scrubbed.tags = { ...scrubbed.tags, request_id: requestId };
  return scrubbed;
}
