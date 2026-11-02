import { getTranslations } from "next-intl/server";

import type { PayRunDraft } from "@/src/domain/entities/Payroll";
import { Link } from "@/src/i18n/navigation";
import { Button } from "@/src/presentation/design-system/components/Button/Button";

import { DashboardEmptyState } from "../DashboardEmptyState";
import { DashboardPageHeader } from "../DashboardPageHeader";
import { DashboardPageCrumb } from "../shell/DashboardPageCrumb";

import { PayRunForm } from "./PayRunForm";

/** The page around the form, or what's in the way of it: nobody to pay, or no month left to record. */
export async function NewPayRunScreen({ draft, today }: { draft: PayRunDraft; today: string }) {
  const t = await getTranslations("dashPayroll");

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <DashboardPageCrumb label={t("form.title")} />
      <DashboardPageHeader
        backHref="/dashboard/payroll"
        backLabel={t("heading")}
        title={t("form.title")}
        subtitle={t("form.subtitle")}
      />
      {draft.lines.length === 0 ? (
        <div className="flex flex-col items-center gap-4">
          <DashboardEmptyState title={t("form.noEmployees")} body={t("emptyBody")} />
          <Button size="control-md" asChild className="px-4">
            <Link href="/dashboard/payroll/employees">{t("form.addEmployees")}</Link>
          </Button>
        </div>
      ) : draft.periods.length === 0 ? (
        <DashboardEmptyState title={t("heading")} body={t("form.noMonths")} />
      ) : (
        <PayRunForm draft={draft} today={today} />
      )}
    </div>
  );
}
