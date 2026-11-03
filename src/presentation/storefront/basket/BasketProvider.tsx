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

type BasketActions = {
  add: (line: BasketLine) => void;
  setQuantity: (index: number, quantity: number) => void;
  remove: (index: number) => void;
  clear: () => void;
};

type BasketStore = BasketActions & {
  subscribe: (onChange: () => void) => () => void;
  /** The basket, read from storage on first use; the same object until it changes. */
  getSnapshot: () => Basket;
};

/**
 * The basket kept in this browser's storage. Storage can be unavailable (private
 * mode, blocked site data); every access is guarded and the basket simply lives in
 * memory then.
 */
function createBasketStore(): BasketStore {
  let basket: Basket | null = null;
  const listeners = new Set<() => void>();

  function getSnapshot(): Basket {
    if (basket === null) {
      let stored: string | null = null;
      try {
        stored = window.localStorage.getItem(STORAGE_KEY);
      } catch {
        stored = null;
      }
      basket = parseStoredBasket(stored);
    }
    return basket;
  }

  function update(change: (current: Basket) => Basket): void {
    const next = change(getSnapshot());
    if (next === basket) return;
    basket = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable — the in-memory basket still works for this visit.
    }
    for (const listener of listeners) listener();
  }

  return {
    subscribe: (onChange) => {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
    getSnapshot,
    add: (line) => update((current) => addToBasket(current, line)),
    setQuantity: (index, quantity) => update((current) => setLineQuantity(current, index, quantity)),
    remove: (index) => update((current) => removeLine(current, index)),
    clear: () => update(() => EMPTY_BASKET),
  };
}

/** The server has no storage to read, and hydration must draw what the server drew. */
function getServerSnapshot(): null {
  return null;
}

const BasketContext = React.createContext<BasketStore | null>(null);

/**
 * Holds the basket for the public site and keeps it in this browser's storage, so
 * it survives a reload or a detour through sign-in.
 *
 * The context carries the store, which never changes; the basket itself reaches
 * the components that show it through `useSyncExternalStore`. Every page sits
 * under this provider, so its value must not change while a page is still
 * streaming in: React would give up on hydrating the server's copy and draw one
 * of its own (`e2e/streamed-hydration.spec.ts`).
 */
export function BasketProvider({ children }: { children: React.ReactNode }) {
  const [store] = React.useState(createBasketStore);
  return <BasketContext.Provider value={store}>{children}</BasketContext.Provider>;
}

function useBasketStore(): BasketStore {
  const store = React.useContext(BasketContext);
  if (!store) throw new Error("useBasket and useBasketActions must be used inside <BasketProvider>.");
  return store;
}

/** The basket, for components that show it; they re-render when it changes. */
export function useBasket(): {
  basket: Basket;
  /** False in the server render and while hydrating, before storage can be read, so the badge doesn't flash "0". */
  ready: boolean;
} {
  const store = useBasketStore();
  const stored = React.useSyncExternalStore<Basket | null>(store.subscribe, store.getSnapshot, getServerSnapshot);
  return { basket: stored ?? EMPTY_BASKET, ready: stored !== null };
}

/** Changes to the basket, for components that only change it; these never re-render them. */
export function useBasketActions(): BasketActions {
  return useBasketStore();
}
