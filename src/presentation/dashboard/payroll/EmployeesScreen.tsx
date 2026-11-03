import { getLocale, getTranslations } from "next-intl/server";

import type { Employee } from "@/src/domain/entities/Payroll";
import { formatMoney } from "@/src/lib/formatMoney";
import { cn } from "@/src/lib/utils";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";

import { DashboardPageHeader } from "../DashboardPageHeader";
import { AMOUNT, PAGE_CARD, ROW_CAPTION, ROW_END, ROW_TEXT } from "../pageStyles";
import { DashboardPageCrumb } from "../shell/DashboardPageCrumb";

import { EmployeeDialog } from "./EmployeeDialog";

/** Who the cafe pays. People are switched off rather than deleted, so old pay runs keep them. */
export async function EmployeesScreen({ employees }: { employees: Employee[] }) {
  const t = await getTranslations("dashPayroll");
  const locale = await getLocale();

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <DashboardPageCrumb label={t("staff.heading")} />
      <DashboardPageHeader
        backHref="/dashboard/payroll"
        backLabel={t("heading")}
        title={t("staff.heading")}
        subtitle={t("staff.subtitle")}
        actions={<EmployeeDialog />}
      />

      <section aria-label={t("staff.heading")} className={cn(PAGE_CARD, ROW_TEXT, "overflow-hidden")}>
        {employees.length === 0 ? (
          <p className="px-5 py-12 text-center font-semibold text-foreground">{t("staff.empty")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {employees.map((employee) => (
              <li key={employee.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                <span className="flex min-w-48 flex-1 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn("font-semibold", employee.isActive ? "text-foreground" : "text-muted-foreground")}
                      dir="auto"
                    >
                      {employee.name}
                    </span>
                    {!employee.isActive ? (
                      <Badge size="compact" variant="neutral" appearance="outline">
                        {t("staff.inactive")}
                      </Badge>
                    ) : null}
                  </span>
                  {employee.position ? (
                    <span className={ROW_CAPTION} dir="auto">
                      {employee.position}
                    </span>
                  ) : null}
                </span>
                <span className={ROW_END}>
                  <span className={cn(AMOUNT, employee.monthlySalary ? "text-foreground" : ROW_CAPTION)}>
                    {employee.monthlySalary ? formatMoney(employee.monthlySalary, locale) : t("staff.noSalary")}
                  </span>
                  <EmployeeDialog employee={employee} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
