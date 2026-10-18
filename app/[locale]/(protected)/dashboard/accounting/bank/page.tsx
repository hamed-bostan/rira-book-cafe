import { auth } from "@/auth";
import { requirePermission, sessionHas } from "@/src/lib/require-permission";
import { bankStatementsServerApi } from "@/src/presentation/dashboard/bank/bank-statement-server-api";
import { BankStatementsScreen } from "@/src/presentation/dashboard/bank/BankStatementsScreen";

// Bank statements are read over the REST API (BFF) during server render.
export const dynamic = "force-dynamic";

export default async function BankStatementsPage() {
  await requirePermission("accounting.view");
  const [statements, canWrite] = await Promise.all([
    bankStatementsServerApi.list(),
    auth().then((session) => sessionHas(session, "accounting.write")),
  ]);
  return <BankStatementsScreen statements={statements} canWrite={canWrite} />;
}
