import { Gift } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import type { GuestLoyaltyOverview } from "@/src/domain/entities/Loyalty";
import { Link } from "@/src/i18n/navigation";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { formatOrderDateShort } from "@/src/lib/formatOrderDate";
import { cn } from "@/src/lib/utils";
import { EmptyState } from "@/src/presentation/design-system/components/EmptyState/EmptyState";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

/**
 * The guest's place in the loyalty club: their balance and what it's worth, how
 * points are earned and spent, and where their points came from.
 */
export async function RewardsScreen({ overview }: { overview: GuestLoyaltyOverview }) {
  const t = await getTranslations("site");
  const locale = await getLocale();
  const { balance, history, settings } = overview;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-heading-page text-foreground">{t("rewards.heading")}</h1>
        <p className="mt-1 text-body-small text-muted-foreground">{t("rewards.subtitle")}</p>
      </div>

      <section className="flex items-center gap-4 rounded-card-lg bg-accent p-5">
        <span className="grid size-14 shrink-0 place-items-center rounded-full bg-background text-primary">
          <Icon icon={Gift} size="lg" />
        </span>
        <div>
          <p className="text-heading-subsection text-foreground">
            {t("rewards.balance", { points: formatNumber(balance, locale) })}
          </p>
          <p className="text-body-small text-muted-foreground">
            {t("rewards.worth", { amount: formatMoney(balance * settings.pointValue, locale) })}
          </p>
        </div>
      </section>

      {settings.enabled ? (
        <section className="flex flex-col gap-2 rounded-card-lg border border-border p-4">
          <h2 className="text-body-strong text-foreground">{t("rewards.howHeading")}</h2>
          <ul className="flex list-disc flex-col gap-1 ps-5 text-body-small text-foreground">
            <li>{t("rewards.howEarn", { amount: formatMoney(settings.tomanPerPoint, locale) })}</li>
            <li>{t("rewards.howSpend", { amount: formatMoney(settings.pointValue, locale) })}</li>
            <li>{t("rewards.howMinimum", { points: formatNumber(settings.minRedeemPoints, locale) })}</li>
          </ul>
        </section>
      ) : (
        <p className="rounded-card-md bg-muted px-4 py-3 text-body-small text-muted-foreground">
          {t("rewards.paused")}
        </p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-body-lead text-foreground">{t("rewards.historyHeading")}</h2>
        {history.length === 0 ? (
          <EmptyState
            icon={Gift}
            title={t("rewards.empty")}
            className="rounded-card-lg border border-dashed border-border py-10"
          />
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-card-lg border border-border">
            {history.map((entry) => (
              <li key={entry.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-body-small-strong text-foreground">
                    {entry.orderId && entry.orderNumber !== undefined ? (
                      <Link href={`/orders/${entry.orderId}`} className="hover:underline">
                        {t(`rewards.reason.${entry.reason}`, { orderNumber: formatNumber(entry.orderNumber, locale) })}
                      </Link>
                    ) : (
                      t(`rewards.reason.${entry.reason}`, { orderNumber: "" })
                    )}
                  </p>
                  <p className="text-body-caption text-muted-foreground">
                    {formatOrderDateShort(entry.createdAt, locale)}
                    {entry.note ? ` · ${entry.note}` : null}
                  </p>
                </div>
                <span
                  className={cn(
                    "text-body-small-strong tabular-nums",
                    entry.delta > 0 ? "text-success-foreground" : "text-foreground",
                  )}
                  dir="ltr"
                >
                  {entry.delta > 0 ? "+" : "−"}
                  {formatNumber(Math.abs(entry.delta), locale)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
