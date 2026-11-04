"use client";

import { X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { DashboardSwitchField } from "@/src/presentation/dashboard/DashboardSwitchField";
import { FIELD_ERROR, FIELD_HINT, FIELD_LABEL } from "@/src/presentation/dashboard/fieldStyles";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import type { CounterQuoteState } from "./useCounterQuote";

type CounterSaleDiscountsProps = {
  quoteState: CounterQuoteState;
  /** The code applied, as typed; the quote says whether it took. */
  appliedPromo?: string;
  onPromoChange: (code: string | undefined) => void;
  /** Why the last code was refused, already localized. */
  promoError: string | null;
  redeemPoints: boolean;
  onRedeemChange: (redeem: boolean) => void;
  /** Whether a guest's phone is in: points are read from their profile. */
  hasGuest: boolean;
  disabled?: boolean;
};

/**
 * A counter sale's discounts: a promo code the guest gives (applied and priced by
 * the server, with the reason when it can't be used), and the guest's points —
 * offered once their phone is in and the club is on, spent as many as the order
 * allows, exactly as at the guest's own checkout.
 */
export function CounterSaleDiscounts({
  quoteState,
  appliedPromo,
  onPromoChange,
  promoError,
  redeemPoints,
  onRedeemChange,
  hasGuest,
  disabled,
}: CounterSaleDiscountsProps) {
  const t = useTranslations("dashOrders");
  const locale = useLocale();
  const inputId = React.useId();
  const errorId = React.useId();
  const [promoInput, setPromoInput] = React.useState(appliedPromo ?? "");
  const { quote } = quoteState;

  function apply(): void {
    const code = promoInput.trim();
    onPromoChange(code ? code : undefined);
  }

  const points = redeemPoints ? (quote?.pointsRedeemed ?? 0) : (quote?.pointsAvailable ?? 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className={FIELD_LABEL}>
          {t("counter.promoLabel")}
        </label>
        {appliedPromo && quote?.promoCode ? (
          <div className="flex min-h-11 items-center justify-between gap-2 rounded-card-md border border-success-foreground bg-success px-3 sm:min-h-9">
            <span dir="ltr" className="text-body-small-strong text-success-foreground">
              {quote.promoCode}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="control-sm"
              iconOnly
              aria-label={t("counter.promoRemove")}
              disabled={disabled}
              onClick={() => {
                setPromoInput("");
                onPromoChange(undefined);
              }}
            >
              <Icon icon={X} size="icon-md" />
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              id={inputId}
              size="control-md"
              value={promoInput}
              onChange={(event) => setPromoInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  apply();
                }
              }}
              placeholder={t("counter.promoPlaceholder")}
              maxLength={30}
              dir="ltr"
              autoComplete="off"
              aria-invalid={promoError ? true : undefined}
              aria-describedby={promoError ? errorId : undefined}
              disabled={disabled}
            />
            <Button
              type="button"
              variant="secondary"
              size="control-md"
              className="px-3"
              disabled={disabled || !promoInput.trim()}
              loading={quoteState.loading && Boolean(appliedPromo)}
              onClick={apply}
            >
              {t("counter.promoApply")}
            </Button>
          </div>
        )}
        {promoError ? (
          <p id={errorId} role="alert" className={FIELD_ERROR}>
            {promoError}
          </p>
        ) : null}
      </div>

      {quote?.loyaltyEnabled ? (
        hasGuest ? (
          <DashboardSwitchField
            label={t("counter.pointsLabel", { points: formatNumber(quote.pointsBalance, locale) })}
            hint={
              redeemPoints || quote.pointsAvailable > 0
                ? t("counter.pointsHint", {
                    points: formatNumber(points, locale),
                    amount: formatMoney(points * quote.pointValue, locale),
                  })
                : t("counter.pointsMinimum", { points: formatNumber(quote.minRedeemPoints, locale) })
            }
            checked={redeemPoints}
            disabled={disabled || (!redeemPoints && quote.pointsAvailable === 0)}
            onCheckedChange={onRedeemChange}
          />
        ) : (
          <p className={FIELD_HINT}>{t("counter.pointsNeedGuest")}</p>
        )
      ) : null}
    </div>
  );
}
