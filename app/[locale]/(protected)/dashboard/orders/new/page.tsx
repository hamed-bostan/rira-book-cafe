import { isSellable } from "@/src/domain/entities/Product";
import { requirePermission } from "@/src/lib/require-permission";
import { CounterSaleScreen } from "@/src/presentation/dashboard/orders/CounterSaleScreen";
import { productsServerApi } from "@/src/presentation/dashboard/products/product-server-api";

// The menu is read over the REST API (BFF) during server render, so what's left on
// the shelf is current; each sale `router.refresh()`es it.
export const dynamic = "force-dynamic";

export default async function CounterSalePage() {
  await requirePermission("orders.fulfill");
  const products = await productsServerApi.list();

  return <CounterSaleScreen products={products.filter((product) => product.isPublished && isSellable(product))} />;
}
