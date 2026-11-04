import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { requirePermission } from "@/src/lib/require-permission";
import { categoriesServerApi } from "@/src/presentation/dashboard/categories/category-server-api";
import { productsServerApi } from "@/src/presentation/dashboard/products/product-server-api";
import { promotionsServerApi } from "@/src/presentation/dashboard/promotions/promotion-server-api";
import { PromotionsScreen } from "@/src/presentation/dashboard/promotions/PromotionsScreen";

// Promo codes, the loyalty club's rules, and the menu a code can be limited to,
// fetched over the REST API (BFF) during server render.
export const dynamic = "force-dynamic";

export default async function DashboardPromotionsPage() {
  await requirePermission("promotions.write");
  const [promoCodes, loyaltySettings, products, categories] = await Promise.all([
    promotionsServerApi.listPromoCodes(),
    promotionsServerApi.loyaltySettings(),
    productsServerApi.list(),
    categoriesServerApi.list(),
  ]);

  const now = new Date();
  return (
    <PromotionsScreen
      promoCodes={promoCodes}
      loyaltySettings={loyaltySettings}
      now={now.toISOString()}
      today={cafeDayOf(now)}
      scope={{
        products: products.map(({ id, name }) => ({ id, name })),
        categories: categories.map(({ id, name }) => ({ id, name })),
      }}
    />
  );
}
