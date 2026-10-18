"use client";

import * as React from "react";

import type { QuoteOrderInput } from "@/src/contracts/order-schema";
import type { OrderQuote } from "@/src/domain/entities/Checkout";
import { ApiError } from "@/src/lib/api/ApiError";

import { storefrontApi } from "../storefront-api";

import { basketToOrderItems, type Basket } from "./basket";

/** Wait this long after the last change before asking the server, so +/− taps don't each fire a request. */
const QUOTE_DEBOUNCE_MS = 300;

type UseOrderQuoteOptions = {
  basket: Basket;
  promoCode?: string;
  redeemPoints: boolean;
  /** Only signed-in guests have points and can use codes. */
  enabled: boolean;
  /** Told when the server refuses the quote — a code that can't be used, points that aren't there. Keep it stable. */
  onRejected?: (error: ApiError) => void;
};

export type OrderQuoteState = {
  quote: OrderQuote | null;
  /** The failure from the last request (a code that can't be used, points that aren't there). */
  error: ApiError | null;
  /** A newer question is out and its answer hasn't come back yet. */
  loading: boolean;
};

type Answer = { key: string; quote: OrderQuote | null; error: ApiError | null };

/**
 * The basket's live price with its discounts, from the server — the same pricing
 * the order will get, so the total shown is the total charged. Re-asked whenever
 * the lines, the code or the points toggle change; a stale answer that arrives
 * after a newer question is dropped.
 */
export function useOrderQuote({
  basket,
  promoCode,
  redeemPoints,
  enabled,
  onRejected,
}: UseOrderQuoteOptions): OrderQuoteState {
  const [answer, setAnswer] = React.useState<Answer | null>(null);
  const requestKey = JSON.stringify({
    items: basketToOrderItems(basket),
    promoCode,
    redeemPoints,
  } satisfies QuoteOrderInput);
  const active = enabled && basket.lines.length > 0;

  React.useEffect(() => {
    if (!active) return;
    let stale = false;
    const timer = window.setTimeout(() => {
      storefrontApi
        .quoteOrder(JSON.parse(requestKey) as QuoteOrderInput)
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
  }, [active, requestKey, onRejected]);

  if (!active) return { quote: null, error: null, loading: false };
  const current = answer?.key === requestKey ? answer : null;
  return { quote: current?.quote ?? null, error: current?.error ?? null, loading: current === null };
}
