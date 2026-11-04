import { getTranslations } from "next-intl/server";

import { auth } from "@/auth";
import { isOpenAt, nextOpening } from "@/src/domain/entities/CafeSettings";
import { noIndexMetadata } from "@/src/presentation/seo/noIndexMetadata";
import { cafeSettingsServerApi } from "@/src/presentation/settings/cafe-settings-server-api";
import { BasketScreen } from "@/src/presentation/storefront/basket/BasketScreen";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("site");
  return noIndexMetadata(t("basket.heading"));
}

/**
 * The basket lives in the browser; the page only needs to know whether the guest
 * can order yet, and whether the cafe is closed right now by its opening hours.
 * Closed is a notice, not a block: an order placed then waits in the queue until
 * staff open (nothing about an order depends on the hours, and staff may be in
 * early) — so unset or unreadable hours simply show no notice.
 */
export default async function BasketPage() {
  const [session, cafe] = await Promise.all([auth(), cafeSettingsServerApi.getOrEmpty()]);
  const now = new Date();
  const closedNow = isOpenAt(cafe.hours, now) === false ? { reopens: nextOpening(cafe.hours, now) } : null;
  return <BasketScreen signedIn={Boolean(session?.user)} closedNow={closedNow} />;
}
