"use client";

import * as React from "react";

import type { CounterQuoteInput } from "@/src/contracts/order-schema";
import type { OrderQuote } from "@/src/domain/entities/Checkout";
import { ApiError } from "@/src/lib/api/ApiError";

import { ordersApi } from "./order-api";

/** Wait this long after the last change before asking again, so a burst of taps is one request. */
const QUOTE_DEBOUNCE_MS = 250;

export type CounterQuoteState = {
  quote: OrderQuote | null;
  /** The refusal from the last request (a code that can't be used, points that aren't there). */
  error: ApiError | null;
  /** A newer question is out and its answer hasn't come back yet. */
  loading: boolean;
};

type Answer = { key: string; quote: OrderQuote | null; error: ApiError | null };

/**
 * The counter sale's live price — discounts and service charge included — from the
 * server, through the same pricing the sale gets, so the total staff take payment
 * for is the total charged. Re-asked whenever the lines, the service, the guest, the
 * code or the points switch change; a stale answer that lands after a newer question
 * is dropped. `onRejected` hears each refusal once (keep it stable).
 */
export function useCounterQuote(
  request: CounterQuoteInput | null,
  onRejected?: (error: ApiError) => void,
): CounterQuoteState {
  const [answer, setAnswer] = React.useState<Answer | null>(null);
  const requestKey = request ? JSON.stringify(request) : null;

  React.useEffect(() => {
    if (!requestKey) return;
    let stale = false;
    const timer = window.setTimeout(() => {
      ordersApi
        .quoteCounterSale(JSON.parse(requestKey) as CounterQuoteInput)
        .then((quote) => {
          if (!stale) setAnswer({ key: requestKey, quote, error: null });
        })
        .catch((error: unknown) => {
          if (stale) return;
          const apiError = error instanceof ApiError ? error : null;
          setAnswer({ key: requestKey, quote: null, error: apiError });
          if (apiError) onRejected?.(apiError);
        });
    }, QUOTE_DEBOUNCE_MS);
    return () => {
      stale = true;
      window.clearTimeout(timer);
    };
  }, [requestKey, onRejected]);

  if (!requestKey) return { quote: null, error: null, loading: false };
  const current = answer?.key === requestKey ? answer : null;
  return { quote: current?.quote ?? null, error: current?.error ?? null, loading: current === null };
}
