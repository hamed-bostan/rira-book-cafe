"use client";

import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { MAX_LOYALTY_NOTE_LENGTH, type GuestLoyaltyLookup } from "@/src/domain/entities/Loyalty";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatNumber } from "@/src/lib/formatNumber";
import { formatOrderDateShort } from "@/src/lib/formatOrderDate";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { cn } from "@/src/lib/utils";
import { Button, FormMessage, Icon, Input } from "@/src/presentation/design-system";

import { promotionsApi } from "./promotion-api";

/**
 * Look a guest up by phone at the counter: their balance and recent points — and
 * add or take away points by hand, with a reason (a goodwill gesture, a fix).
 * The guest's standing is ephemeral UI state here; nothing on the page depends on it.
 */
export function GuestPointsPanel() {
  const t = useTranslations("dashPromotions");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const locale = useLocale();

  const [phone, setPhone] = React.useState("");
  const [guest, setGuest] = React.useState<GuestLoyaltyLookup | null>(null);
  const [lookupError, setLookupError] = React.useState<string | null>(null);
  const [delta, setDelta] = React.useState("");
  const [note, setNote] = React.useState("");
  const [adjustError, setAdjustError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function lookup(event: React.FormEvent): void {
    event.preventDefault();
    setLookupError(null);
    startTransition(async () => {
      try {
        setGuest(await promotionsApi.lookupGuest(phone));
      } catch (err) {
        setGuest(null);
        setLookupError(err instanceof ApiError && err.status === 404 ? t("guestNotFound") : localizeApiError(err, tApiErrors, t("lookupError")));
      }
    });
  }

  function adjust(event: React.FormEvent): void {
    event.preventDefault();
    setAdjustError(null);
    const points = Number(delta.replace("−", "-"));
    if (!Number.isInteger(points) || points === 0) {
      setAdjustError(formErrorMessage(tFormErrors, "pointsInvalid") ?? null);
      return;
    }
    startTransition(async () => {
      try {
        await promotionsApi.adjustPoints({ phone, delta: points, note });
        setDelta("");
        setNote("");
        setGuest(await promotionsApi.lookupGuest(phone));
      } catch (err) {
        const field = err instanceof ApiError ? (err.fieldErrors?.delta ?? err.fieldErrors?.note) : undefined;
        setAdjustError(field ? (formErrorMessage(tFormErrors, field) ?? field) : localizeApiError(err, tApiErrors, t("saveError")));
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={lookup} className="flex gap-2">
        <Input
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="0912…"
          dir="ltr"
          aria-label={t("guestPhone")}
          required
        />
        <Button type="submit" variant="outline" disabled={pending || !phone.trim()}>
          <Icon icon={Search} size="sm" className="me-1" />
          {t("lookup")}
        </Button>
      </form>
      {lookupError ? <FormMessage>{lookupError}</FormMessage> : null}

      {guest ? (
        <div className="flex flex-col gap-4 rounded-card-md border border-border p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-body-strong text-foreground">{guest.name}</span>
            <span className="text-heading-subsection text-primary">{t("balance", { points: formatNumber(guest.balance, locale) })}</span>
          </div>

          <form onSubmit={adjust} className="grid grid-cols-1 gap-3 sm:grid-cols-[8rem_minmax(0,1fr)_auto] sm:items-end">
            <label className="flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
              {t("adjustPoints")}
              <Input value={delta} onChange={(event) => setDelta(event.target.value)} placeholder="+50 / -20" dir="ltr" inputMode="numeric" required />
            </label>
            <label className="flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
              {t("adjustNote")}
              <Input value={note} onChange={(event) => setNote(event.target.value)} maxLength={MAX_LOYALTY_NOTE_LENGTH} required />
            </label>
            <Button type="submit" size="sm" disabled={pending}>
              {t("adjust")}
            </Button>
          </form>
          {adjustError ? <FormMessage>{adjustError}</FormMessage> : null}

          {guest.history.length > 0 ? (
            <ul className="flex flex-col divide-y divide-border">
              {guest.history.map((entry) => (
                <li key={entry.id} className="flex items-center gap-3 py-2 text-body-small">
                  <span className="min-w-0 flex-1 text-foreground">
                    {t(`reason.${entry.reason}`)}
                    {entry.orderNumber !== undefined ? ` #${formatNumber(entry.orderNumber, locale)}` : null}
                    {entry.note ? <span className="text-muted-foreground"> · {entry.note}</span> : null}
                    {entry.createdByName ? <span className="text-muted-foreground"> · {entry.createdByName}</span> : null}
                  </span>
                  <span className="text-body-caption text-muted-foreground">{formatOrderDateShort(entry.createdAt, locale)}</span>
                  <span className={cn("tabular-nums", entry.delta > 0 ? "text-success-foreground" : "text-foreground")} dir="ltr">
                    {entry.delta > 0 ? "+" : "−"}
                    {formatNumber(Math.abs(entry.delta), locale)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
