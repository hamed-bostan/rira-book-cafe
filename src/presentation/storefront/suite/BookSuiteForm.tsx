"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { shiftCafeDay } from "@/src/domain/entities/CafeTime";
import {
  MAX_SUITE_DAYS_AHEAD,
  MAX_SUITE_GUESTS,
  MAX_SUITE_NIGHTS,
  MAX_SUITE_NOTE_LENGTH,
  MIN_SUITE_GUESTS,
} from "@/src/domain/entities/SuiteBooking";
import { useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatNumber } from "@/src/lib/formatNumber";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { FormMessage } from "@/src/presentation/design-system/components/form/FormMessage/FormMessage";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Select } from "@/src/presentation/design-system/components/form/Select/Select";
import { Textarea } from "@/src/presentation/design-system/components/form/Textarea/Textarea";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { storefrontApi } from "../storefront-api";

type BookSuiteFormProps = {
  /** Today on the cafe calendar — the earliest check-in. */
  today: string;
};

const FIELDS = ["checkIn", "checkOut", "guests", "note"] as const;

/**
 * Ask for the suite: check-in and check-out days, how many guests, and an optional
 * note. The request goes to staff as "requested"; nights already held are refused
 * straight away. The guest's stays below refresh after sending.
 */
export function BookSuiteForm({ today }: BookSuiteFormProps) {
  const t = useTranslations("site");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();

  const [checkIn, setCheckIn] = React.useState(shiftCafeDay(today, 1));
  const [checkOut, setCheckOut] = React.useState(shiftCafeDay(today, 2));
  const [guests, setGuests] = React.useState(2);
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function changeCheckIn(value: string): void {
    setCheckIn(value);
    // Keep at least one night: push check-out along when check-in passes it.
    if (value && checkOut <= value) setCheckOut(shiftCafeDay(value, 1));
  }

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await storefrontApi.requestSuiteBooking({ checkIn, checkOut, guests, note });
        setNote("");
        toast({ tone: "success", title: t("suite.sent") });
        router.refresh();
      } catch (err) {
        if (err instanceof ApiError) {
          const field = FIELDS.map((name) => err.fieldErrors?.[name]).find(Boolean);
          if (field) {
            setError(formErrorMessage(tFormErrors, field) ?? field);
            return;
          }
          // Domain validation (too long a stay, too far ahead) arrives as a plain message.
          if (err.status === 400 && err.message) {
            setError(err.message);
            return;
          }
        }
        setError(localizeApiError(err, tApiErrors, t("suite.error")));
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-card-lg border border-border p-4 md:p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
          {t("suite.checkIn")}
          <Input
            type="date"
            value={checkIn}
            min={today}
            max={shiftCafeDay(today, MAX_SUITE_DAYS_AHEAD)}
            onChange={(event) => changeCheckIn(event.target.value)}
            required
            dir="ltr"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
          {t("suite.checkOut")}
          <Input
            type="date"
            value={checkOut}
            min={checkIn ? shiftCafeDay(checkIn, 1) : today}
            max={checkIn ? shiftCafeDay(checkIn, MAX_SUITE_NIGHTS) : undefined}
            onChange={(event) => setCheckOut(event.target.value)}
            required
            dir="ltr"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
          {t("suite.guests")}
          <Select value={guests} onChange={(event) => setGuests(Number(event.target.value))}>
            {Array.from({ length: MAX_SUITE_GUESTS - MIN_SUITE_GUESTS + 1 }, (_, i) => i + MIN_SUITE_GUESTS).map(
              (size) => (
                <option key={size} value={size}>
                  {t("book.guests", { count: size, formatted: formatNumber(size, locale) })}
                </option>
              ),
            )}
          </Select>
        </label>
      </div>
      <label className="flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
        {t("book.note")}
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={MAX_SUITE_NOTE_LENGTH}
          rows={2}
          placeholder={t("suite.notePlaceholder")}
        />
      </label>
      <p className="text-body-caption text-muted-foreground">
        {t("suite.hint", { nights: formatNumber(MAX_SUITE_NIGHTS, locale) })}
      </p>
      {error ? <FormMessage>{error}</FormMessage> : null}
      <Button type="submit" loading={pending} className="self-start">
        {pending ? t("book.sending") : t("suite.submit")}
      </Button>
    </form>
  );
}
