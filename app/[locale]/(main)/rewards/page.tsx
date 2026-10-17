import { requireAuth } from "@/src/lib/require-auth";
import { RewardsScreen } from "@/src/presentation/storefront/rewards/RewardsScreen";
import { storefrontServerApi } from "@/src/presentation/storefront/storefront-server-api";

export const dynamic = "force-dynamic";

export default async function RewardsPage() {
  await requireAuth();
  const overview = await storefrontServerApi.loyalty();
  return <RewardsScreen overview={overview} />;
}
