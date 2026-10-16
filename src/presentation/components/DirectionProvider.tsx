"use client";

import { Direction } from "radix-ui";

import type { Direction as TextDirection } from "@/src/i18n/direction";

import type { ReactNode } from "react";

/**
 * Client boundary around Radix's `Direction.Provider`. Radix primitives read their
 * reading direction from this context (not the DOM `dir`), so mounting it at the app
 * root gives every primitive RTL under `fa` without a per-component `dir`.
 *
 * It lives in its own client module because `radix-ui`'s Direction calls `createContext`
 * at evaluation, which can't run in a Server Component — so the server root layout mounts
 * this wrapper instead of importing `radix-ui` directly. Server children pass through
 * untouched (rendered on the server, handed in as `children`).
 */
export function DirectionProvider({ dir, children }: { dir: TextDirection; children: ReactNode }) {
  return <Direction.Provider dir={dir}>{children}</Direction.Provider>;
}
