import { ChevronRight, Percent, Scale, Sigma, TrendingUp, Wallet } from "lucide-react";
import { getTranslations } from "next-intl/server";

import type { Account } from "@/src/domain/entities/Ledger";
import { Link } from "@/src/i18n/navigation";

import { STATEMENTS } from "./accounting-format";
import { AccountingHeader } from "./AccountingHeader";

const ICONS = {
  "profit-and-loss": TrendingUp,
  "balance-sheet": Scale,
  "trial-balance": Sigma,
  vat: Percent,
  margins: Wallet,
} as const;

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
      <AccountingHeader active="statements" intro={t("statements.subtitle")} writer={writer} />
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {STATEMENTS.map((slug) => {
          const Icon = ICONS[slug];
          return (
            <li key={slug}>
              <Link
                href={`/dashboard/accounting/statements/${slug}`}
                className="flex h-full items-start gap-4 rounded-card-lg border border-border bg-background p-4 transition-colors hover:border-primary/40 md:p-5"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-body-strong text-foreground">{t(`statements.${slug}.title`)}</span>
                  <span className="text-body-small text-muted-foreground">{t(`statements.${slug}.description`)}</span>
                </span>
                <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground rtl:rotate-180" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
