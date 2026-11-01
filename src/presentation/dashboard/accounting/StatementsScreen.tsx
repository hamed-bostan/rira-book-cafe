import { ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";

import type { Account } from "@/src/domain/entities/Ledger";
import { Link } from "@/src/i18n/navigation";
import { cn } from "@/src/lib/utils";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { PAGE_CARD, ROW_TEXT } from "../pageStyles";
import { DashboardPageCrumb } from "../shell/DashboardPageCrumb";

import { STATEMENTS } from "./accounting-format";
import { AccountingHeader } from "./AccountingHeader";

/** The financial statements on offer, each built from the ledger on demand. */
export async function StatementsScreen({
  writer,
}: {
  /** What the header's "New manual entry" needs, for a viewer who can write to the books. */
  writer: { accounts: Account[]; today: string } | null;
}) {
  const t = await getTranslations("dashAccounting");

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <DashboardPageCrumb label={t("tab.statements")} />
      <AccountingHeader active="statements" subtitle={t("statements.subtitle")} writer={writer} />
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {STATEMENTS.map((slug) => (
          <li key={slug} className="min-w-0">
            <Link
              href={`/dashboard/accounting/statements/${slug}`}
              className={cn(
                PAGE_CARD,
                ROW_TEXT,
                "flex h-full flex-col gap-1 px-5 py-4 text-foreground transition-colors hover:border-primary/40",
              )}
            >
              <span className="flex items-center justify-between gap-2 font-semibold">
                {t(`statements.${slug}.title`)}
                <Icon icon={ChevronRight} size="icon-md" className="text-muted-foreground rtl:-scale-x-100" />
              </span>
              <span className="text-muted-foreground">{t(`statements.${slug}.description`)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
