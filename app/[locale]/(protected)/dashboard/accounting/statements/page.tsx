import { auth } from "@/auth";
import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { requirePermission, sessionHas } from "@/src/lib/require-permission";
import { accountsServerApi } from "@/src/presentation/dashboard/accounting/accounting-server-api";
import { StatementsScreen } from "@/src/presentation/dashboard/accounting/StatementsScreen";

// The header's "New manual entry" reads the chart of accounts over the REST API (BFF).
export const dynamic = "force-dynamic";

export default async function StatementsPage() {
  await requirePermission("accounting.view");
  const [accounts, canWrite] = await Promise.all([
    accountsServerApi.list(),
    auth().then((session) => sessionHas(session, "accounting.write")),
  ]);

  return <StatementsScreen writer={canWrite ? { accounts, today: cafeDayOf(new Date()) } : null} />;
}
