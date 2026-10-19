"use client";

import { Gift, TicketPercent, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { FormMessage } from "@/src/presentation/design-system/components/form/FormMessage/FormMessage";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { Switch } from "@/src/presentation/design-system/components/Switch/Switch";

import type { OrderQuoteState } from "./useOrderQuote";

type BasketDiscountsProps = {
  quoteState: OrderQuoteState;
  /** The code the guest applied, if any. */
  appliedPromo?: string;
  onPromoChange: (code: string | undefined) => void;
  /** Why the last code was refused, already localized. */
  promoError: string | null;
  redeemPoints: boolean;
  onRedeemChange: (redeem: boolean) => void;
  /** The running total from the basket's own prices, shown until the server answers. */
  fallbackTotal: number;
};

/**
 * The basket's discounts: a promo code field, the loyalty points switch, and the
 * totals they produce — priced by the server, so what's shown is what's charged.
 */
export function BasketDiscounts({
  quoteState,
  appliedPromo,
  onPromoChange,
  promoError,
  redeemPoints,
  onRedeemChange,
  fallbackTotal,
}: BasketDiscountsProps) {
  const t = useTranslations("site");
  const locale = useLocale();
  const [promoInput, setPromoInput] = React.useState(appliedPromo ?? "");
  const { quote, loading } = quoteState;

  function apply(event: React.FormEvent): void {
    event.preventDefault();
    const code = promoInput.trim();
    onPromoChange(code ? code : undefined);
  }

  function clearPromo(): void {
    setPromoInput("");
    onPromoChange(undefined);
  }

  const total = quote?.total ?? fallbackTotal;

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={apply} className="flex flex-col gap-1.5">
        <label htmlFor="promo-code" className="flex items-center gap-1.5 text-body-small-emphasis text-foreground">
          <Icon icon={TicketPercent} size="xs" className="text-primary" />
          {t("basket.promoLabel")}
        </label>
        {appliedPromo && quote?.promoCode ? (
          <div className="flex items-center justify-between gap-2 rounded-card-md border border-success-foreground bg-success px-3 py-2">
            <span className="text-body-small-strong text-success-foreground" dir="ltr">
              {quote.promoCode}
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              iconOnly
              aria-label={t("basket.promoRemove")}
              onClick={clearPromo}
            >
              <Icon icon={X} size="xs" />
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              id="promo-code"
              value={promoInput}
              onChange={(event) => setPromoInput(event.target.value)}
              placeholder={t("basket.promoPlaceholder")}
              maxLength={30}
              dir="ltr"
              autoComplete="off"
              aria-invalid={promoError ? true : undefined}
            />
            <Button
              type="submit"
              variant="outline"
              disabled={!promoInput.trim()}
              loading={loading && Boolean(appliedPromo)}
            >
              {t("basket.promoApply")}
            </Button>
          </div>
        )}
        {promoError ? <FormMessage>{promoError}</FormMessage> : null}
      </form>

      {quote?.loyaltyEnabled ? (
        <div className="flex flex-col gap-1.5 rounded-card-md bg-muted px-3 py-3">
          <div className="flex items-center justify-between gap-3">
            <label
              htmlFor="redeem-points"
              className="flex items-center gap-1.5 text-body-small-emphasis text-foreground"
            >
              <Icon icon={Gift} size="xs" className="text-primary" />
              {t("basket.pointsBalance", { points: formatNumber(quote.pointsBalance, locale) })}
            </label>
            <Switch
              id="redeem-points"
              checked={redeemPoints}
              disabled={!redeemPoints && quote.pointsAvailable === 0}
              onCheckedChange={(checked) => onRedeemChange(checked)}
            />
          </div>
          <p className="text-body-caption text-muted-foreground">
            {redeemPoints || quote.pointsAvailable > 0
              ? t("basket.pointsUse", {
                  points: formatNumber(redeemPoints ? quote.pointsRedeemed : quote.pointsAvailable, locale),
                  amount: formatMoney(
                    (redeemPoints ? quote.pointsRedeemed : quote.pointsAvailable) * quote.pointValue,
                    locale,
                  ),
                })
              : t("basket.pointsMinimum", { points: formatNumber(quote.minRedeemPoints, locale) })}
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5 border-t border-border pt-4">
        <dl className="flex flex-col gap-1.5">
          {quote && (quote.promoDiscount > 0 || quote.pointsDiscount > 0) ? (
            <>
              <div className="flex items-center justify-between text-body-small text-muted-foreground">
                <dt>{t("basket.subtotal")}</dt>
                <dd>{formatMoney(quote.subtotal, locale)}</dd>
              </div>
              {quote.promoDiscount > 0 ? (
                <div className="flex items-center justify-between text-body-small text-success-foreground">
                  <dt>{t("basket.promoDiscount")}</dt>
                  <dd>−{formatMoney(quote.promoDiscount, locale)}</dd>
                </div>
              ) : null}
              {quote.pointsDiscount > 0 ? (
                <div className="flex items-center justify-between text-body-small text-success-foreground">
                  <dt>{t("basket.pointsDiscount")}</dt>
                  <dd>−{formatMoney(quote.pointsDiscount, locale)}</dd>
                </div>
              ) : null}
            </>
          ) : null}
          <div className="flex items-center justify-between">
            <dt className="text-body-strong text-foreground">{t("basket.total")}</dt>
            <dd className="text-body-strong text-foreground" aria-busy={loading}>
              {formatMoney(total, locale)}
            </dd>
          </div>
        </dl>
        {/* Outside the <dl>: a definition list may only hold <dt>/<dd> groups. */}
        {quote && quote.pointsToEarn > 0 ? (
          <p className="text-body-caption text-primary">
            {t("basket.pointsToEarn", { points: formatNumber(quote.pointsToEarn, locale) })}
          </p>
        ) : null}
      </div>
    </div>
  );
}
