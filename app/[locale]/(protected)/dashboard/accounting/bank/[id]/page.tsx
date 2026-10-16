import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { requirePermission, sessionHas } from "@/src/lib/require-permission";
import { bankStatementsServerApi } from "@/src/presentation/dashboard/bank/bank-statement-server-api";
import { BankReconciliationScreen } from "@/src/presentation/dashboard/bank/BankReconciliationScreen";

export const dynamic = "force-dynamic";

type BankStatementPageProps = { params: Promise<{ id: string }> };

export default async function BankStatementPage({ params }: BankStatementPageProps) {
  await requirePermission("accounting.view");
  const { id } = await params;
  const [view, canWrite] = await Promise.all([bankStatementsServerApi.getById(id), auth().then((session) => sessionHas(session, "accounting.write"))]);
  if (!view) notFound();
  return <BankReconciliationScreen view={view} canWrite={canWrite} />;
}
