"use client";

import { Plus, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import {
  MAX_LOYALTY_NOTE_LENGTH,
  MAX_POINTS_ADJUSTMENT,
  pointsValue,
  type GuestLoyaltyLookup,
  type LoyaltyTransaction,
} from "@/src/domain/entities/Loyalty";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { formatOrderDateShort } from "@/src/lib/formatOrderDate";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { cn } from "@/src/lib/utils";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { FormMessage } from "@/src/presentation/design-system/components/form/FormMessage/FormMessage";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { promotionsApi } from "./promotion-api";

/** How many of a guest's latest movements show before "Show all". */
const RECENT_SHOWN = 3;

type GuestPointsPanelProps = {
  /** What one point takes off, in Toman — to say what a balance is worth. */
  pointValue: number;
};

/**
 * Look a guest up by phone at the counter: their balance and what it's worth,
 * their latest points — and add or take away points by hand, with a reason (a
 * goodwill gesture, a fix). The guest on screen is ephemeral UI state; nothing
 * else on the page depends on it.
 */
export function GuestPointsPanel({ pointValue }: GuestPointsPanelProps) {
  const t = useTranslations("dashPromotions");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const locale = useLocale();
  const { toast } = useToast();
  const phoneId = React.useId();

  const [phone, setPhone] = React.useState("");
  const [guest, setGuest] = React.useState<GuestLoyaltyLookup | null>(null);
  const [notFound, setNotFound] = React.useState(false);
  const [lookupError, setLookupError] = React.useState<string | null>(null);
  const [amount, setAmount] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [adjustError, setAdjustError] = React.useState<string | null>(null);
  const [showAll, setShowAll] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  /** Which button is in flight — only it shows the spinner. */
  const [active, setActive] = React.useState<"lookup" | "add" | "take" | null>(null);

  function lookup(event: React.FormEvent): void {
    event.preventDefault();
    if (!phone.trim()) return;
    setLookupError(null);
    setNotFound(false);
    setAdjustError(null);
    setAmount("");
    setReason("");
    setShowAll(false);
    setActive("lookup");
    startTransition(async () => {
      try {
        setGuest(await promotionsApi.lookupGuest(phone));
      } catch (err) {
        setGuest(null);
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
          return;
        }
        const field = err instanceof ApiError ? err.fieldErrors?.phone : undefined;
        setLookupError(
          field ? (formErrorMessage(tFormErrors, field) ?? field) : localizeApiError(err, tApiErrors, t("lookupError")),
        );
      }
    });
  }

  function adjust(current: GuestLoyaltyLookup, sign: 1 | -1): void {
    const points = amount.trim() === "" ? Number.NaN : Number(amount);
    const note = reason.trim();
    const name = current.name ?? t("guestNoName");
    if (!Number.isInteger(points) || points <= 0) {
      setAdjustError(t("pointsInvalid"));
      return;
    }
    if (points > MAX_POINTS_ADJUSTMENT) {
      setAdjustError(t("pointsTooMany", { max: formatNumber(MAX_POINTS_ADJUSTMENT, locale) }));
      return;
    }
    if (!note) {
      setAdjustError(t("reasonRequired"));
      return;
    }
    if (sign < 0 && points > current.balance) {
      setAdjustError(
        t("notEnough", { name, count: current.balance, formatted: formatNumber(current.balance, locale) }),
      );
      return;
    }
    setAdjustError(null);
    setActive(sign > 0 ? "add" : "take");
    startTransition(async () => {
      try {
        // The account found, not the phone box — it may have been edited since.
        await promotionsApi.adjustPoints({ phone: current.userId, delta: sign * points, note });
        toast({
          tone: "success",
          title: t(sign > 0 ? "added" : "tookAway", { count: points, formatted: formatNumber(points, locale), name }),
        });
        setAmount("");
        setReason("");
        setGuest(await promotionsApi.lookupGuest(current.userId));
      } catch (err) {
        const field = err instanceof ApiError ? (err.fieldErrors?.delta ?? err.fieldErrors?.note) : undefined;
        setAdjustError(
          field ? (formErrorMessage(tFormErrors, field) ?? field) : localizeApiError(err, tApiErrors, t("saveError")),
        );
      }
    });
  }

  function why(entry: LoyaltyTransaction): string {
    const number = entry.orderNumber !== undefined ? formatNumber(entry.orderNumber, locale) : undefined;
    const text =
      entry.reason === "adjust"
        ? (entry.note ?? t("history.adjust"))
        : number !== undefined
          ? t(`history.${entry.reason}`, { number })
          : t(`history.${entry.reason}Plain`);
    return entry.reason === "adjust" && entry.createdByName
      ? `${text} · ${t("byStaff", { name: entry.createdByName })}`
      : text;
  }

  const history = guest ? (showAll ? guest.history : guest.history.slice(0, RECENT_SHOWN)) : [];

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={lookup} className="flex gap-2">
        <label htmlFor={phoneId} className="sr-only">
          {t("guestPhone")}
        </label>
        <Input
          id={phoneId}
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="0912 111 0004"
          autoComplete="off"
          dir="ltr"
          className="min-w-0 flex-1"
        />
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          className="gap-2 px-3"
          loading={pending && active === "lookup"}
          disabled={pending || !phone.trim()}
        >
          <Icon icon={Search} size="sm" />
          {t("lookup")}
        </Button>
      </form>

      {notFound ? (
        <p className="text-body-default text-pretty text-muted-foreground sm:text-body-small">{t("guestNotFound")}</p>
      ) : null}
      {lookupError ? <FormMessage>{lookupError}</FormMessage> : null}

      {guest ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 rounded-button bg-muted p-4">
            <div className="flex min-w-0 flex-col">
              <span className="text-body-strong text-foreground sm:text-body-small-strong">
                {guest.name ?? t("guestNoName")}
              </span>
              <span dir="ltr" className="text-body-small text-muted-foreground tabular-nums sm:text-body-caption">
                {guest.userId}
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="flex items-baseline gap-1.5">
                <span className="text-heading-subsection tracking-tight text-foreground tabular-nums sm:text-heading-section">
                  {formatNumber(guest.balance, locale)}
                </span>
                <span className="text-body-default font-medium text-muted-foreground sm:text-body-small">
                  {t("pointsUnit", { count: guest.balance })}
                </span>
              </span>
              <span className="text-body-small text-muted-foreground sm:text-body-caption">
                {t("pointsWorth", { amount: formatMoney(pointsValue(guest.balance, { pointValue }), locale) })}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-4">
            <label className="flex min-w-0 flex-col gap-1.5 text-body-small-emphasis text-foreground">
              {t("pointsField")}
              <Input
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value);
                  setAdjustError(null);
                }}
                inputMode="numeric"
                dir="ltr"
                autoComplete="off"
                placeholder={t("pointsPlaceholder")}
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5 text-body-small-emphasis text-foreground">
              {t("reasonField")}
              <Input
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value);
                  setAdjustError(null);
                }}
                maxLength={MAX_LOYALTY_NOTE_LENGTH}
                autoComplete="off"
                placeholder={t("reasonPlaceholder")}
              />
            </label>
          </div>
          {adjustError ? <FormMessage>{adjustError}</FormMessage> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="px-3"
              loading={pending && active === "take"}
              disabled={pending}
              onClick={() => adjust(guest, -1)}
            >
              {t("takeAway")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-2 px-3"
              loading={pending && active === "add"}
              disabled={pending}
              onClick={() => adjust(guest, 1)}
            >
              <Icon icon={Plus} size="sm" />
              {t("addPoints")}
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-body-caption-bold tracking-wider text-muted-foreground uppercase">{t("recent")}</h3>
            {history.length > 0 ? (
              <ul className="flex flex-col">
                {history.map((entry, index) => (
                  <li
                    key={entry.id}
                    className={cn(
                      "flex items-baseline gap-3 py-2 text-body-default sm:text-body-small",
                      index > 0 && "border-t border-border",
                    )}
                  >
                    <span
                      dir="ltr"
                      className={cn(
                        "min-w-12 shrink-0 font-semibold tabular-nums",
                        entry.delta > 0 ? "text-success-foreground" : "text-foreground/80",
                      )}
                    >
                      {entry.delta > 0 ? "+" : "−"}
                      {formatNumber(Math.abs(entry.delta), locale)}
                    </span>
                    <span className="min-w-0 flex-1 text-foreground/80">{why(entry)}</span>
                    <span className="text-body-small whitespace-nowrap text-muted-foreground tabular-nums sm:text-body-caption">
                      {formatOrderDateShort(entry.createdAt, locale)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-body-default text-muted-foreground sm:text-body-small">{t("noHistory")}</p>
            )}
            {guest.history.length > RECENT_SHOWN ? (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="self-start"
                onClick={() => setShowAll((current) => !current)}
              >
                {showAll ? t("showLess") : t("showAll", { formatted: formatNumber(guest.history.length, locale) })}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
