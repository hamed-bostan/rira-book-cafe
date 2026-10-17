import { getTranslations } from "next-intl/server";

import { requireAuth } from "@/src/lib/require-auth";
import { noIndexMetadata } from "@/src/presentation/seo/noIndexMetadata";
import { RewardsScreen } from "@/src/presentation/storefront/rewards/RewardsScreen";
import { storefrontServerApi } from "@/src/presentation/storefront/storefront-server-api";

import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("site");
  return noIndexMetadata(t("rewards.heading"));
}

export default async function RewardsPage() {
  await requireAuth();
  const overview = await storefrontServerApi.loyalty();
  return <RewardsScreen overview={overview} />;
}
