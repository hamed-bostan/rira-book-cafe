import { ApiError } from "./ApiError";

import type { useTranslations } from "next-intl";

/**
 * Client-side localization of REST failures. The API speaks machine codes —
 * `error.code` in the envelope, plus the HTTP status — with its English `message`
 * kept as a debugging fallback; the UI owns the user-facing copy in the `apiErrors`
 * message namespace. Components pass their `apiErrors`-bound `t` and a
 * context-specific fallback, used when the failure carries nothing recognizable
 * (unexpected server prose is never shown half-translated).
 */

/** A translator bound to the `apiErrors` namespace (`useTranslations("apiErrors")`). */
export type ApiErrorsTranslator = ReturnType<typeof useTranslations<"apiErrors">>;

type ApiErrorKey =
  | "badRequest"
  | "validation"
  | "unauthorized"
  | "notFound"
  | "conflict"
  | "insufficientStock"
  | "invalidTransition"
  | "tableTaken"
  | "tableHeld"
  | "suiteTaken"
  | "alreadyOnLoan"
  | "eventFull"
  | "eventClosed"
  | "alreadyRegistered"
  | "inUse"
  | "revokeSelf"
  | "revokeOwner"
  | "revokeBreakGlass"
  | "alreadyPosted"
  | "alreadyReversed"
  | "notReversible"
  | "periodClosed"
  | "accountInactive"
  | "unbalanced"
  | "stockUsed"
  | "yearNotEnded"
  | "statementOverlap"
  | "statementReconciled"
  | "alreadyMatched"
  | "matchUnbalanced"
  | "notReconciled"
  | "previousNotReconciled"
  | "notPayable"
  | "paymentInProgress"
  | "notPurchased"
  | "promoInvalid"
  | "promoExpired"
  | "promoUsedUp"
  | "promoMinSubtotal"
  | "notEnoughPoints"
  | "loyaltyDisabled"
  | "alreadyWaiting"
  | "bookOnShelf"
  | "allCopiesOut"
  | "shiftAlreadyOpen"
  | "noOpenShift"
  | "gatewayUnavailable"
  | "timeout"
  | "network"
  | "server";

/** Envelope `code` (and Axios transport code) → `apiErrors` message key. */
const CODE_KEYS: Readonly<Record<string, ApiErrorKey>> = {
  BAD_REQUEST: "badRequest",
  VALIDATION: "validation",
  UNAUTHORIZED: "unauthorized",
  NOT_FOUND: "notFound",
  UNIQUE_CONSTRAINT: "conflict",
  INSUFFICIENT_STOCK: "insufficientStock",
  INVALID_TRANSITION: "invalidTransition",
  TABLE_TAKEN: "tableTaken",
  TABLE_HELD: "tableHeld",
  SUITE_TAKEN: "suiteTaken",
  ALREADY_ON_LOAN: "alreadyOnLoan",
  EVENT_FULL: "eventFull",
  EVENT_CLOSED: "eventClosed",
  ALREADY_REGISTERED: "alreadyRegistered",
  IN_USE: "inUse",
  REVOKE_SELF: "revokeSelf",
  REVOKE_OWNER: "revokeOwner",
  REVOKE_BREAK_GLASS: "revokeBreakGlass",
  // The books refusing a posting.
  ALREADY_POSTED: "alreadyPosted",
  ALREADY_REVERSED: "alreadyReversed",
  NOT_REVERSIBLE: "notReversible",
  PERIOD_CLOSED: "periodClosed",
  ACCOUNT_INACTIVE: "accountInactive",
  UNBALANCED: "unbalanced",
  STOCK_USED: "stockUsed",
  YEAR_NOT_ENDED: "yearNotEnded",
  // Bank reconciliation.
  STATEMENT_OVERLAP: "statementOverlap",
  STATEMENT_RECONCILED: "statementReconciled",
  ALREADY_MATCHED: "alreadyMatched",
  MATCH_UNBALANCED: "matchUnbalanced",
  NOT_RECONCILED: "notReconciled",
  PREVIOUS_NOT_RECONCILED: "previousNotReconciled",
  // Online payments.
  NOT_PAYABLE: "notPayable",
  PAYMENT_IN_PROGRESS: "paymentInProgress",
  GATEWAY_UNAVAILABLE: "gatewayUnavailable",
  NOT_PURCHASED: "notPurchased",
  PROMO_INVALID: "promoInvalid",
  PROMO_EXPIRED: "promoExpired",
  PROMO_USED_UP: "promoUsedUp",
  PROMO_MIN_SUBTOTAL: "promoMinSubtotal",
  NOT_ENOUGH_POINTS: "notEnoughPoints",
  LOYALTY_DISABLED: "loyaltyDisabled",
  ALREADY_WAITING: "alreadyWaiting",
  BOOK_ON_SHELF: "bookOnShelf",
  ALL_COPIES_OUT: "allCopiesOut",
  SHIFT_ALREADY_OPEN: "shiftAlreadyOpen",
  NO_OPEN_SHIFT: "noOpenShift",
  INTERNAL: "server",
  EBADRESPONSE: "server",
  // Transport failures normalized by the Axios interceptor / server client.
  ECONNABORTED: "timeout",
  ETIMEDOUT: "timeout",
  ERR_NETWORK: "network",
};

/** Status → message key when the envelope carried no recognized code. */
function statusKey(status: number | null): ApiErrorKey | undefined {
  if (status === null) return "network"; // the request never produced a response
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 404) return "notFound";
  if (status === 409) return "conflict";
  if (status >= 500) return "server";
  return undefined;
}

/** The localized user-facing message for a failed API call. */
export function localizeApiError(error: unknown, t: ApiErrorsTranslator, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  const key = (error.code ? CODE_KEYS[error.code] : undefined) ?? statusKey(error.status);
  return key ? t(key) : fallback;
}
