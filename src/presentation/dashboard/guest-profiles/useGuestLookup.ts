"use client";

import * as React from "react";

import type { GuestProfileMatch } from "@/src/domain/entities/GuestProfile";
import { isPlausiblePhone, normalizePhone } from "@/src/domain/entities/Phone";

import { guestProfilesApi } from "./guest-profile-api";

/** What's known about the phone being typed: being looked up, someone's, nobody's yet, or unknown. */
export type GuestLookup =
  { state: "checking" } | { state: "found"; match: GuestProfileMatch } | { state: "new" } | { state: "failed" };

/** How long typing must pause before the number is looked up. */
const LOOKUP_DEBOUNCE_MS = 300;

/**
 * Look the typed phone up once it could be someone's: `null` until then, then
 * `checking` while typing pauses and the server answers, then whose profile it is.
 *
 * Keyed by the normalized number, so `0912…` and `+98 912…` are one lookup, a
 * number typed again answers at once, and an answer for a number since changed is
 * never shown for the new one (it's also cancelled).
 */
export function useGuestLookup(phone: string): GuestLookup | null {
  const id = isPlausiblePhone(phone) ? normalizePhone(phone) : null;
  const [answer, setAnswer] = React.useState<{ id: string; lookup: GuestLookup } | null>(null);

  React.useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      guestProfilesApi.getByPhone(id, controller.signal).then(
        (match) => setAnswer({ id, lookup: match ? { state: "found", match } : { state: "new" } }),
        () => {
          if (!controller.signal.aborted) setAnswer({ id, lookup: { state: "failed" } });
        },
      );
    }, LOOKUP_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [id]);

  if (!id) return null;
  return answer?.id === id ? answer.lookup : { state: "checking" };
}
