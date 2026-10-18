import { TicketPercent } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import type { LoyaltySettings } from "@/src/domain/entities/Loyalty";
import type { PromoCodeWithUses } from "@/src/domain/entities/Promotion";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { formatOrderDateShort } from "@/src/lib/formatOrderDate";
import { DashboardPanel, DashboardPanelHeader } from "@/src/presentation/dashboard/DashboardPanel";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";
import { EmptyState } from "@/src/presentation/design-system/components/EmptyState/EmptyState";

import { GuestPointsPanel } from "./GuestPointsPanel";
import { LoyaltySettingsForm } from "./LoyaltySettingsForm";
import { PromoActiveSwitch } from "./PromoActiveSwitch";
import { PromoCodeDialog } from "./PromoCodeDialog";

type PromotionsScreenProps = {
  promoCodes: PromoCodeWithUses[];
  loyaltySettings: LoyaltySettings;
  /** "Now", from the page, to tell scheduled and expired codes apart. */
  now: string;
};

/**
 * The levers that bring guests back: promo codes, the loyalty club's rules, and
 * a guest's points at the counter. Presentational — the page fetches over the
 * REST API; every write `router.refresh()`es.
 */
export async function PromotionsScreen({ promoCodes, loyaltySettings, now }: PromotionsScreenProps) {
  const t = await getTranslations("dashPromotions");
  const locale = await getLocale();
  const nowDate = new Date(now);

  function state(promo: PromoCodeWithUses): "active" | "inactive" | "scheduled" | "expired" | "usedUp" {
    if (!promo.isActive) return "inactive";
    if (promo.startsAt && nowDate < new Date(promo.startsAt)) return "scheduled";
    if (promo.endsAt && nowDate >= new Date(promo.endsAt)) return "expired";
    if (promo.usageLimit !== undefined && promo.uses >= promo.usageLimit) return "usedUp";
    return "active";
  }

  const STATE_VARIANT = {
    active: "success",
    inactive: "neutral",
    scheduled: "info",
    expired: "neutral",
    usedUp: "warning",
  } as const;

  return (
    <div className="@container flex min-w-0 flex-col gap-4 sm:gap-6">
      <div className="space-y-1">
        <h1 className="dashboard-page-title">{t("heading")}</h1>
        <p className="text-body-small text-muted-foreground">{t("subtitle")}</p>
      </div>

      <DashboardPanel>
        <DashboardPanelHeader title={t("codesHeading")} action={<PromoCodeDialog />} />
        {promoCodes.length === 0 ? (
          <EmptyState icon={TicketPercent} title={t("codesEmpty")} className="py-10" />
        ) : (
          <ul className="mt-4 flex flex-col divide-y divide-border">
            {promoCodes.map((promo) => {
              const current = state(promo);
              return (
                <li key={promo.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-body-small-strong text-foreground" dir="ltr">
                        {promo.code}
                      </span>
                      <Badge variant={STATE_VARIANT[current]}>{t(`state.${current}`)}</Badge>
                      <span className="text-body-small text-foreground">
                        {promo.kind === "percent"
                          ? t("percentOff", { value: formatNumber(promo.value, locale) })
                          : t("amountOff", { amount: formatMoney(promo.value, locale) })}
                        {promo.maxDiscount !== undefined
                          ? ` · ${t("upTo", { amount: formatMoney(promo.maxDiscount, locale) })}`
                          : null}
                      </span>
                    </div>
                    {promo.description ? (
                      <p className="text-body-small text-muted-foreground">{promo.description}</p>
                    ) : null}
                    <p className="text-body-caption text-muted-foreground">
                      {[
                        promo.usageLimit !== undefined
                          ? t("usesOf", {
                              uses: formatNumber(promo.uses, locale),
                              limit: formatNumber(promo.usageLimit, locale),
                            })
                          : t("uses", { uses: formatNumber(promo.uses, locale) }),
                        promo.perGuestLimit !== undefined
                          ? t("perGuest", { limit: formatNumber(promo.perGuestLimit, locale) })
                          : null,
                        promo.minSubtotal > 0 ? t("minimum", { amount: formatMoney(promo.minSubtotal, locale) }) : null,
                        promo.startsAt ? t("from", { date: formatOrderDateShort(promo.startsAt, locale) }) : null,
                        promo.endsAt
                          ? t("until", {
                              date: formatOrderDateShort(
                                new Date(new Date(promo.endsAt).getTime() - 1).toISOString(),
                                locale,
                              ),
                            })
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <PromoActiveSwitch id={promo.id} code={promo.code} isActive={promo.isActive} />
                    <PromoCodeDialog promo={promo} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </DashboardPanel>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 @min-[60rem]:grid-cols-2">
        <DashboardPanel>
          <DashboardPanelHeader title={t("loyaltyHeading")} />
          <p className="mt-1 text-body-small text-muted-foreground">{t("loyaltyDescription")}</p>
          <div className="mt-4">
            <LoyaltySettingsForm settings={loyaltySettings} />
          </div>
        </DashboardPanel>
        <DashboardPanel>
          <DashboardPanelHeader title={t("guestHeading")} />
          <p className="mt-1 text-body-small text-muted-foreground">{t("guestDescription")}</p>
          <div className="mt-4">
            <GuestPointsPanel />
          </div>
        </DashboardPanel>
      </div>
    </div>
  );
}
