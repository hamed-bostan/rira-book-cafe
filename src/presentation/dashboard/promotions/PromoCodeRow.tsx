import { getLocale, getTranslations } from "next-intl/server";

import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { isPromoCodeFinished, type PromoCodeState, type PromoCodeWithUses } from "@/src/domain/entities/Promotion";
import { formatCafeDayShort } from "@/src/lib/formatCafeDay";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { Badge, type BadgeProps } from "@/src/presentation/design-system/components/Badge/Badge";

import { PromoCodeRowActions } from "./PromoCodeRowActions";

type PromoCodeRowProps = {
  promo: PromoCodeWithUses;
  state: PromoCodeState;
  /** "Now", from the page — to tell a start still to come from one that's passed. */
  now: string;
  takenCodes: readonly string[];
  /** Today on the cafe calendar. */
  today: string;
};

/** The states worth a badge; a live or switched-off code says so with its switch. */
const BADGE: Partial<Record<PromoCodeState, NonNullable<BadgeProps["variant"]>>> = {
  scheduled: "info",
  ended: "neutral",
  usedUp: "neutral",
};

/**
 * One promo code: the code and what it takes off, a badge when it hasn't started
 * or can't be used any more, a line of who it's for and its limits, and the
 * controls. A finished code (ended, used up) is dimmed.
 */
export async function PromoCodeRow({ promo, state, now, takenCodes, today }: PromoCodeRowProps) {
  const t = await getTranslations("dashPromotions");
  const locale = await getLocale();
  const finished = isPromoCodeFinished(state);

  const value =
    promo.kind === "percent"
      ? [
          t("percentOff", { value: formatNumber(promo.value, locale) }),
          promo.maxDiscount !== undefined ? t("upTo", { amount: formatMoney(promo.maxDiscount, locale) }) : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : t("amountOff", { amount: formatMoney(promo.value, locale) });

  const startsLater = promo.startsAt !== undefined && new Date(promo.startsAt) > new Date(now);
  // Stored as the instant the last day ends, so step back into that day.
  const lastDay = promo.endsAt ? cafeDayOf(new Date(new Date(promo.endsAt).getTime() - 1)) : undefined;

  const meta = [
    promo.description,
    promo.usageLimit !== undefined
      ? t("usedOf", { uses: formatNumber(promo.uses, locale), limit: formatNumber(promo.usageLimit, locale) })
      : t("used", { count: promo.uses, formatted: formatNumber(promo.uses, locale) }),
    promo.perGuestLimit !== undefined ? t("perGuest", { limit: formatNumber(promo.perGuestLimit, locale) }) : null,
    promo.minSubtotal > 0 ? t("minimum", { amount: formatMoney(promo.minSubtotal, locale) }) : null,
    startsLater && promo.startsAt
      ? t("starts", { date: formatCafeDayShort(cafeDayOf(new Date(promo.startsAt)), locale) })
      : null,
    lastDay ? t(state === "ended" ? "endedOn" : "ends", { date: formatCafeDayShort(lastDay, locale) }) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const badge = BADGE[state];

  return (
    <article
      aria-label={promo.code}
      className={cn("flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4", finished && "opacity-70")}
    >
      <div className="flex min-w-0 flex-[1_1_15rem] flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span dir="ltr" className="text-body-default font-bold tracking-wider text-foreground sm:text-body-small">
            {promo.code}
          </span>
          <span className="text-body-default font-medium text-foreground/80 sm:text-body-small">{value}</span>
          {badge && (state === "scheduled" || state === "ended" || state === "usedUp") ? (
            <Badge variant={badge} appearance="outline" size="compact" dot>
              {t(`badge.${state}`)}
            </Badge>
          ) : null}
        </div>
        <p className="text-body-small text-pretty text-muted-foreground sm:text-body-caption">{meta}</p>
      </div>

      <PromoCodeRowActions promo={promo} finished={finished} takenCodes={takenCodes} today={today} />
    </article>
  );
}
