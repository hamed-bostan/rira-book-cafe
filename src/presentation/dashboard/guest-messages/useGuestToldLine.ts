"use client";

import { useTranslations } from "next-intl";

/** The guest a change was just about, as a row knows them. */
export type ToldGuest = { name: string; phone: string; userId?: string };

/**
 * The line a toast adds when a change sent the guest a message (a booking
 * confirmed or cancelled): it's on the site, and for a booking made for them by
 * phone or at the counter, that they'll see it when they sign in with that number.
 */
export function useGuestToldLine(): (guest: ToldGuest) => string {
  const t = useTranslations("dashGuestMessages");
  return (guest) =>
    guest.userId
      ? t("toldToast", { name: guest.name })
      : t("toldOnSignInToast", { name: guest.name, phone: guest.phone });
}
