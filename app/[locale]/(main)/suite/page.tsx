import { getTranslations } from "next-intl/server";

import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { requireAuth } from "@/src/lib/require-auth";
import { noIndexMetadata } from "@/src/presentation/seo/noIndexMetadata";
import { storefrontServerApi } from "@/src/presentation/storefront/storefront-server-api";
import { SuiteScreen } from "@/src/presentation/storefront/suite/SuiteScreen";

import type { Metadata } from "next";

export const dynamic = "force-dynamic";

/** Book the suite. Needs an account (staff see the guest's name and phone), so signed-out guests sign in first. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("site");
  return noIndexMetadata(t("suite.heading"));
}

export default async function SuitePage() {
  await requireAuth();
  const [busy, bookings] = await Promise.all([
    storefrontServerApi.suiteAvailability(),
    storefrontServerApi.mySuiteBookings(),
  ]);
  return <SuiteScreen busy={busy} bookings={bookings} today={cafeDayOf(new Date())} />;
}
