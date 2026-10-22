import { TicketPercent } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import type { LoyaltySettings } from "@/src/domain/entities/Loyalty";
import { promoCodeState, type PromoCodeState, type PromoCodeWithUses } from "@/src/domain/entities/Promotion";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { EmptyState } from "@/src/presentation/design-system/components/EmptyState/EmptyState";

import { GuestPointsPanel } from "./GuestPointsPanel";
import { LoyaltySettingsForm } from "./LoyaltySettingsForm";
import { NewPromoCodeButton } from "./NewPromoCodeButton";
import { PromoCodeRow } from "./PromoCodeRow";

type PromotionsScreenProps = {
  /** Every code, newest first, with its uses. */
  promoCodes: PromoCodeWithUses[];
  loyaltySettings: LoyaltySettings;
  /** "Now", from the page, to tell live, scheduled and ended codes apart. */
  now: string;
  /** Today on the cafe calendar — a code can't be set to end before it. */
  today: string;
};

/** Codes guests can use first, then the ones switched off, then the ones only an edit can bring back. */
const RANK: Record<PromoCodeState, number> = { live: 0, scheduled: 0, off: 1, ended: 2, usedUp: 2 };

/**
 * The levers that bring guests back: promo codes (switched on and off from the
 * list, created and edited in a dialog), the rewards club's rules with a worked
 * example, and a guest's points looked up by phone. Presentational — the page
 * fetches over the REST API; every write `router.refresh()`es.
 */
export async function PromotionsScreen({ promoCodes, loyaltySettings, now, today }: PromotionsScreenProps) {
  const t = await getTranslations("dashPromotions");
  const locale = await getLocale();
  const nowDate = new Date(now);

  // A stable sort, so each rank keeps the list's newest-first order.
  const rows = promoCodes
    .map((promo) => ({ promo, state: promoCodeState(promo, nowDate) }))
    .sort((a, b) => RANK[a.state] - RANK[b.state]);
  const live = rows.filter((row) => row.state === "live").length;
  const takenCodes = promoCodes.map((promo) => promo.code);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="dashboard-page-title">{t("heading")}</h1>
          <p className="text-body-default text-muted-foreground sm:text-body-small">{t("subtitle")}</p>
        </div>
        <NewPromoCodeButton takenCodes={takenCodes} today={today} />
      </div>

      <section
        aria-labelledby="promo-codes-heading"
        className="min-w-0 rounded-card-lg border border-border bg-background shadow-xs"
      >
        <div className="flex flex-col gap-1 border-b border-border px-5 py-4">
          <h2 id="promo-codes-heading" className="text-body-strong text-foreground">
            {t("codesHeading")}
          </h2>
          <p className="text-body-default text-muted-foreground sm:text-body-small">
            {live > 0 ? t("codesLive", { count: live, formatted: formatNumber(live, locale) }) : t("codesNoneLive")}
          </p>
        </div>
        {rows.length > 0 ? (
          <ul>
            {rows.map(({ promo, state }, index) => (
              <li key={promo.id} className={cn(index > 0 && "border-t border-border")}>
                <PromoCodeRow promo={promo} state={state} now={now} takenCodes={takenCodes} today={today} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={TicketPercent}
            title={t("codesEmptyTitle")}
            description={t("codesEmptyBody")}
            className="py-12"
          />
        )}
      </section>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        <section
          aria-labelledby="rewards-club-heading"
          className="flex min-w-0 flex-col gap-5 rounded-card-lg border border-border bg-background p-5 shadow-xs"
        >
          <div className="flex flex-col gap-1">
            <h2 id="rewards-club-heading" className="text-body-strong text-foreground">
              {t("clubHeading")}
            </h2>
            <p className="text-body-default text-pretty text-muted-foreground sm:text-body-small">{t("clubSub")}</p>
          </div>
          <LoyaltySettingsForm settings={loyaltySettings} />
        </section>

        <section
          aria-labelledby="guest-points-heading"
          className="flex min-w-0 flex-col gap-5 rounded-card-lg border border-border bg-background p-5 shadow-xs"
        >
          <div className="flex flex-col gap-1">
            <h2 id="guest-points-heading" className="text-body-strong text-foreground">
              {t("guestHeading")}
            </h2>
            <p className="text-body-default text-pretty text-muted-foreground sm:text-body-small">{t("guestSub")}</p>
          </div>
          <GuestPointsPanel pointValue={loyaltySettings.pointValue} />
        </section>
      </div>
    </div>
  );
}
