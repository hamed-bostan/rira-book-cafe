"use client";

import { useTranslations } from "next-intl";

/** The guest a change was just about, as a row knows them. */
export type ToldGuest = { name: string };

/**
 * The line a toast adds when a change sent the guest a message (a booking
 * confirmed or cancelled): it's in their messages on the site. Every guest has a
 * profile, so it's there whether or not they've signed in yet.
 */
export function useGuestToldLine(): (guest: ToldGuest) => string {
  const t = useTranslations("dashGuestMessages");
  return (guest) => t("toldToast", { name: guest.name });
}
