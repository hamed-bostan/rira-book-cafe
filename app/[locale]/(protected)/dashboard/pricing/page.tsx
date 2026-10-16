import { auth } from "@/auth";
import { requirePermission, sessionHas } from "@/src/lib/require-permission";
import { pricingServerApi } from "@/src/presentation/dashboard/pricing/pricing-server-api";
import { PricingScreen } from "@/src/presentation/dashboard/pricing/PricingScreen";

// Costs, overhead and suggestions are computed by the API (BFF) during server render.
export const dynamic = "force-dynamic";

export default async function PricingPage() {
  await requirePermission("accounting.view");
  const session = await auth();
  const [report, canWrite, canCatalog] = await Promise.all([
    pricingServerApi.getReport(),
    sessionHas(session, "accounting.write"),
    sessionHas(session, "catalog.write"),
  ]);

  return <PricingScreen report={report} canWrite={canWrite} canApply={canWrite && canCatalog} />;
}
