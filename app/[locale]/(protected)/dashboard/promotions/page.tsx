import { requirePermission } from "@/src/lib/require-permission";
import { promotionsServerApi } from "@/src/presentation/dashboard/promotions/promotion-server-api";
import { PromotionsScreen } from "@/src/presentation/dashboard/promotions/PromotionsScreen";

// Promo codes and the loyalty club's rules, fetched over the REST API (BFF) during server render.
export const dynamic = "force-dynamic";

export default async function DashboardPromotionsPage() {
  await requirePermission("promotions.write");
  const [promoCodes, loyaltySettings] = await Promise.all([
    promotionsServerApi.listPromoCodes(),
    promotionsServerApi.loyaltySettings(),
  ]);

  return <PromotionsScreen promoCodes={promoCodes} loyaltySettings={loyaltySettings} now={new Date().toISOString()} />;
}
