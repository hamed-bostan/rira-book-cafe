import { getTranslations } from "next-intl/server";

import { suggestedStatementPeriod } from "@/src/domain/entities/BankReconciliation";
import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { requirePermission } from "@/src/lib/require-permission";
import { bankStatementsServerApi } from "@/src/presentation/dashboard/bank/bank-statement-server-api";
import { NewBankStatementForm } from "@/src/presentation/dashboard/bank/NewBankStatementForm";

export const dynamic = "force-dynamic";

export default async function NewBankStatementPage() {
  await requirePermission("accounting.write");
  const t = await getTranslations("dashBank");
  const today = cafeDayOf(new Date());
  // The list is newest first: the first statement is the one this continues.
  const [previous] = await bankStatementsServerApi.list();
  const period = suggestedStatementPeriod(previous?.toDay, today);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div>
        <h1 className="dashboard-page-title">{t("form.heading")}</h1>
        <p className="mt-1 text-body-small text-muted-foreground">{t("form.subtitle")}</p>
      </div>
      <NewBankStatementForm fromDay={period.fromDay} toDay={period.toDay} openingBalance={previous?.closingBalance} today={today} />
    </div>
  );
}
