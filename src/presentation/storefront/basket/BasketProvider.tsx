"use client";

import * as React from "react";

import {
  EMPTY_BASKET,
  addToBasket,
  parseStoredBasket,
  removeLine,
  setLineQuantity,
  type Basket,
  type BasketLine,
} from "./basket";

/** Bump when the stored shape changes so an old basket is dropped rather than misread. */
const STORAGE_KEY = "rira.basket.v1";

type BasketContextValue = {
  basket: Basket;
  /** False until the stored basket has been read, so the badge doesn't flash "0". */
  ready: boolean;
  add: (line: BasketLine) => void;
  setQuantity: (index: number, quantity: number) => void;
  remove: (index: number) => void;
  clear: () => void;
};

const BasketContext = React.createContext<BasketContextValue | null>(null);

/**
 * Holds the basket for the public site and keeps it in this browser's storage, so
 * it survives a reload or a detour through sign-in. Storage can be unavailable
 * (private mode, blocked site data); every access is guarded and the basket simply
 * lives in memory then.
 */
export function BasketProvider({ children }: { children: React.ReactNode }) {
  const [basket, setBasket] = React.useState<Basket>(EMPTY_BASKET);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      stored = null;
    }
    // Reading storage is the external system this effect syncs from.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBasket(parseStoredBasket(stored));
    setReady(true);
  }, []);

  React.useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(basket));
    } catch {
      // Storage unavailable — the in-memory basket still works for this visit.
    }
  }, [basket, ready]);

  const value = React.useMemo<BasketContextValue>(
    () => ({
      basket,
      ready,
      add: (line) => setBasket((current) => addToBasket(current, line)),
      setQuantity: (index, quantity) => setBasket((current) => setLineQuantity(current, index, quantity)),
      remove: (index) => setBasket((current) => removeLine(current, index)),
      clear: () => setBasket(EMPTY_BASKET),
    }),
    [basket, ready],
  );

  return <BasketContext.Provider value={value}>{children}</BasketContext.Provider>;
}

export function useBasket(): BasketContextValue {
  const context = React.useContext(BasketContext);
  if (!context) throw new Error("useBasket must be used inside <BasketProvider>.");
  return context;
}
