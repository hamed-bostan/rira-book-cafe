import { auth } from "@/auth";
import { requirePermission, sessionHas } from "@/src/lib/require-permission";
import { IngredientsScreen } from "@/src/presentation/dashboard/pricing/IngredientsScreen";
import { ingredientsServerApi } from "@/src/presentation/dashboard/pricing/pricing-server-api";

export const dynamic = "force-dynamic";

export default async function IngredientsPage() {
  await requirePermission("accounting.view");
  const [ingredients, canWrite] = await Promise.all([
    ingredientsServerApi.list(true),
    auth().then((session) => sessionHas(session, "accounting.write")),
  ]);

  return <IngredientsScreen ingredients={ingredients} canWrite={canWrite} />;
}
