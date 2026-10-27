import { auth } from "@/auth";
import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { requirePermission, sessionHas } from "@/src/lib/require-permission";
import { accountsServerApi } from "@/src/presentation/dashboard/accounting/accounting-server-api";
import { bankStatementsServerApi } from "@/src/presentation/dashboard/bank/bank-statement-server-api";
import { BankStatementsScreen } from "@/src/presentation/dashboard/bank/BankStatementsScreen";

// Bank statements are read over the REST API (BFF) during server render.
export const dynamic = "force-dynamic";

export default async function BankStatementsPage() {
  await requirePermission("accounting.view");
  const [statements, accounts, canWrite] = await Promise.all([
    bankStatementsServerApi.list(),
    accountsServerApi.list(),
    auth().then((session) => sessionHas(session, "accounting.write")),
  ]);
  return (
    <BankStatementsScreen
      statements={statements}
      canWrite={canWrite}
      writer={canWrite ? { accounts, today: cafeDayOf(new Date()) } : null}
    />
  );
}
