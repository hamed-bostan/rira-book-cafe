"use client";

import { Minus, Plus, ShoppingBag, ShoppingBasket, Trash2, UtensilsCrossed } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import {
  MAX_LINE_QUANTITY,
  MAX_ORDER_NOTE_TEXT_LENGTH,
  MAX_TABLE_LABEL_LENGTH,
  type ServiceType,
} from "@/src/domain/entities/Order";
import { Link, useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { cn } from "@/src/lib/utils";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { EmptyState } from "@/src/presentation/design-system/components/EmptyState/EmptyState";
import { FormMessage } from "@/src/presentation/design-system/components/form/FormMessage/FormMessage";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Textarea } from "@/src/presentation/design-system/components/form/Textarea/Textarea";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { storefrontApi } from "../storefront-api";

import { basketToOrderItems, basketTotal } from "./basket";
import { BasketDiscounts } from "./BasketDiscounts";
import { useBasket } from "./BasketProvider";
import { useOrderQuote } from "./useOrderQuote";

/** Refusals that are about the promo code: shown under its field, and the code is dropped. */
const PROMO_ERRORS: ReadonlySet<string> = new Set([
  "PROMO_INVALID",
  "PROMO_EXPIRED",
  "PROMO_USED_UP",
  "PROMO_MIN_SUBTOTAL",
]);

type BasketScreenProps = {
  /** Whether a guest is signed in — ordering needs an account. */
  signedIn: boolean;
};

/**
 * Review the basket and place the order: quantities and notes per line, dine-in
 * (with a table) or takeaway, a note for the whole order. The total shown is from
 * when items were added; the server prices the order from the menu, and the
 * order page shows what was actually charged.
 */
export function BasketScreen({ signedIn }: BasketScreenProps) {
  const t = useTranslations("site");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const { basket, ready, setQuantity, remove, clear } = useBasket();

  const [serviceType, setServiceType] = React.useState<ServiceType>("dineIn");
  const [tableLabel, setTableLabel] = React.useState("");
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [tableError, setTableError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [appliedPromo, setAppliedPromo] = React.useState<string | undefined>(undefined);
  const [promoError, setPromoError] = React.useState<string | null>(null);
  const [redeemPoints, setRedeemPoints] = React.useState(false);

  // A code the server refuses is dropped (with the reason shown), and so is a points
  // request it can't honour — the totals fall back to what the basket can have.
  const onQuoteRejected = React.useCallback(
    (rejection: ApiError) => {
      if (rejection.code && PROMO_ERRORS.has(rejection.code)) {
        setPromoError(localizeApiError(rejection, tApiErrors, t("basket.promoError")));
        setAppliedPromo(undefined);
      } else if (rejection.code === "NOT_ENOUGH_POINTS" || rejection.code === "LOYALTY_DISABLED") {
        setRedeemPoints(false);
      }
    },
    [tApiErrors, t],
  );
  const quoteState = useOrderQuote({
    basket,
    promoCode: appliedPromo,
    redeemPoints,
    enabled: signedIn && ready,
    onRejected: onQuoteRejected,
  });

  if (!ready) return null;

  if (basket.lines.length === 0) {
    return (
      <EmptyState
        size="page"
        icon={ShoppingBasket}
        title={t("basket.emptyTitle")}
        description={t("basket.emptyBody")}
        action={
          <Button asChild>
            <Link href="/menu">{t("home.seeMenu")}</Link>
          </Button>
        }
        className="mx-auto max-w-md"
      />
    );
  }

  function placeOrder(): void {
    setError(null);
    setTableError(null);
    if (serviceType === "dineIn" && !tableLabel.trim()) {
      setTableError(t("basket.tableRequired"));
      return;
    }
    startTransition(async () => {
      try {
        const order = await storefrontApi.placeOrder({
          items: basketToOrderItems(basket),
          serviceType,
          tableLabel: serviceType === "dineIn" ? tableLabel : undefined,
          note,
          promoCode: appliedPromo,
          redeemPoints,
        });
        clear();
        toast({ tone: "success", title: t("basket.orderPlaced") });
        router.push(`/orders/${order.id}`);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          router.push(`/login?callbackUrl=${encodeURIComponent("/basket")}`);
          return;
        }
        const fieldMessage = err instanceof ApiError ? err.fieldErrors?.tableLabel : undefined;
        if (fieldMessage) setTableError(formErrorMessage(tFormErrors, fieldMessage) ?? fieldMessage);
        else setError(localizeApiError(err, tApiErrors, t("basket.orderError")));
        // The discounts may have changed underneath the guest (a code used up meanwhile).
        if (err instanceof ApiError) onQuoteRejected(err);
      }
    });
  }

  const serviceOption = (value: ServiceType, icon: typeof ShoppingBag, label: string) => (
    <label
      className={cn(
        "flex flex-1 cursor-pointer items-center gap-3 rounded-card-md border px-4 py-3 text-body-small-emphasis",
        focusRing,
        serviceType === value ? "border-primary bg-accent text-primary" : "border-border text-foreground",
      )}
    >
      <input
        type="radio"
        name="serviceType"
        value={value}
        checked={serviceType === value}
        onChange={() => setServiceType(value)}
        className="sr-only"
      />
      <Icon icon={icon} size="sm" />
      {label}
    </label>
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <section className="flex flex-col gap-4">
        <h1 className="text-heading-page text-foreground">{t("basket.heading")}</h1>
        <ul className="flex flex-col divide-y divide-border rounded-card-lg border border-border">
          {basket.lines.map((line, index) => (
            <li key={`${line.productId}-${line.note ?? ""}`} className="flex gap-3 p-3">
              <div className="relative size-16 shrink-0 overflow-hidden rounded-card-md bg-muted">
                <Image src={line.imageUrl} alt="" fill sizes="64px" className="object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-body-small-strong text-foreground">{line.name}</p>
                {line.note ? <p className="text-body-caption text-warning-foreground">{line.note}</p> : null}
                <p className="text-body-small text-muted-foreground">{formatMoney(line.unitPrice, locale)}</p>
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    iconOnly
                    aria-label={t("menu.decrease")}
                    onClick={() => setQuantity(index, line.quantity - 1)}
                  >
                    <Icon icon={Minus} size="xs" />
                  </Button>
                  <span className="w-6 text-center text-body-small-strong tabular-nums">
                    {formatNumber(line.quantity, locale)}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    iconOnly
                    aria-label={t("menu.increase")}
                    disabled={line.quantity >= MAX_LINE_QUANTITY}
                    onClick={() => setQuantity(index, line.quantity + 1)}
                  >
                    <Icon icon={Plus} size="xs" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    iconOnly
                    aria-label={t("basket.removeAria", { name: line.name })}
                    className="ms-auto text-destructive"
                    onClick={() => remove(index)}
                  >
                    <Icon icon={Trash2} size="sm" />
                  </Button>
                </div>
              </div>
              <span className="shrink-0 text-body-small-emphasis text-foreground">
                {formatMoney(line.unitPrice * line.quantity, locale)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4 self-start rounded-card-lg border border-border p-4 lg:sticky lg:top-20">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-body-strong text-foreground">{t("basket.serviceHeading")}</legend>
          <div className="flex gap-2">
            {serviceOption("dineIn", UtensilsCrossed, t("basket.dineIn"))}
            {serviceOption("takeaway", ShoppingBag, t("basket.takeaway"))}
          </div>
        </fieldset>

        {serviceType === "dineIn" ? (
          <label className="flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
            {t("basket.tableLabel")}
            <Input
              value={tableLabel}
              onChange={(event) => setTableLabel(event.target.value)}
              maxLength={MAX_TABLE_LABEL_LENGTH}
              placeholder="4"
              aria-invalid={tableError ? true : undefined}
            />
            <span className="text-body-caption font-normal text-muted-foreground">{t("basket.tableHint")}</span>
            {tableError ? <FormMessage>{tableError}</FormMessage> : null}
          </label>
        ) : null}

        <label className="flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
          {t("basket.noteLabel")}
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={MAX_ORDER_NOTE_TEXT_LENGTH}
            rows={2}
          />
        </label>

        {signedIn ? (
          <BasketDiscounts
            quoteState={quoteState}
            appliedPromo={appliedPromo}
            onPromoChange={(code) => {
              setPromoError(null);
              setAppliedPromo(code);
            }}
            promoError={promoError}
            redeemPoints={redeemPoints}
            onRedeemChange={setRedeemPoints}
            fallbackTotal={basketTotal(basket)}
          />
        ) : (
          <div className="flex items-center justify-between border-t border-border pt-4">
            <span className="text-body-strong text-foreground">{t("basket.total")}</span>
            <span className="text-body-strong text-foreground">{formatMoney(basketTotal(basket), locale)}</span>
          </div>
        )}
        <p className="text-body-caption text-muted-foreground">{t("basket.payAtCounter")}</p>

        {error ? <FormMessage>{error}</FormMessage> : null}

        {signedIn ? (
          <Button type="button" onClick={placeOrder} disabled={quoteState.loading} loading={pending}>
            {pending ? t("basket.placing") : t("basket.placeOrder")}
          </Button>
        ) : (
          <Button asChild>
            <Link href={`/login?callbackUrl=${encodeURIComponent("/basket")}`}>{t("basket.signInToOrder")}</Link>
          </Button>
        )}
      </section>
    </div>
  );
}
