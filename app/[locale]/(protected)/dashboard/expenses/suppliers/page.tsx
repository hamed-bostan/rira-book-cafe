import { auth } from "@/auth";
import { requirePermission, sessionHas } from "@/src/lib/require-permission";
import { suppliersServerApi } from "@/src/presentation/dashboard/expenses/expense-server-api";
import { SuppliersScreen } from "@/src/presentation/dashboard/expenses/SuppliersScreen";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  await requirePermission("accounting.view");
  const [suppliers, canWrite] = await Promise.all([
    suppliersServerApi.list(true),
    auth().then((session) => sessionHas(session, "accounting.write")),
  ]);

  return <SuppliersScreen suppliers={suppliers} canWrite={canWrite} />;
}
