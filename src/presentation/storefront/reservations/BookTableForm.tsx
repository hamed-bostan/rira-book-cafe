"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { shiftCafeDay } from "@/src/domain/entities/CafeTime";
import {
  BOOKING_SLOT_MINUTES,
  MAX_BOOKING_DAYS_AHEAD,
  MAX_PARTY_SIZE,
  MAX_RESERVATION_NOTE_LENGTH,
  MIN_PARTY_SIZE,
} from "@/src/domain/entities/Reservation";
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

/**
 * The hours a guest can pick. The cafe has no opening-hours setting yet, so this is
 * a sensible daytime window on the quarter hour; staff confirm or decline each
 * request anyway.
 */
const FIRST_SLOT_MINUTES = 8 * 60;
const LAST_SLOT_MINUTES = 22 * 60;

function slots(): string[] {
  const out: string[] = [];
  for (let minutes = FIRST_SLOT_MINUTES; minutes <= LAST_SLOT_MINUTES; minutes += BOOKING_SLOT_MINUTES) {
    out.push(`${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`);
  }
  return out;
}

const SLOTS = slots();

type BookTableFormProps = {
  /** Today on the cafe calendar — the earliest bookable day. */
  today: string;
};

/**
 * Ask for a table: day, time, party size, and an optional note. The request goes to
 * staff as "requested"; the guest sees it confirmed (with a table) on their
 * reservations page.
 */
export function BookTableForm({ today }: BookTableFormProps) {
  const t = useTranslations("site");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();

  const [day, setDay] = React.useState(today);
  const [time, setTime] = React.useState("19:00");
  const [partySize, setPartySize] = React.useState(2);
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await storefrontApi.requestReservation({ startsAt: `${day}T${time}`, partySize, note });
        toast({ tone: "success", title: t("book.sent") });
        router.push("/reservations");
        router.refresh();
      } catch (err) {
        if (err instanceof ApiError) {
          const field = err.fieldErrors?.startsAt ?? err.fieldErrors?.partySize ?? err.fieldErrors?.note;
          if (field) {
            setError(formErrorMessage(tFormErrors, field) ?? field);
            return;
          }
          // Domain validation (past time, too far ahead) arrives as a plain message.
          if (err.status === 400 && err.message) {
            setError(err.message);
            return;
          }
        }
        setError(localizeApiError(err, tApiErrors, t("book.error")));
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-card-lg border border-border p-4 md:p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
          {t("book.day")}
          <Input
            type="date"
            value={day}
            min={today}
            max={shiftCafeDay(today, MAX_BOOKING_DAYS_AHEAD)}
            onChange={(event) => setDay(event.target.value)}
            required
            dir="ltr"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
          {t("book.time")}
          <Select value={time} onChange={(event) => setTime(event.target.value)} dir="ltr">
            {SLOTS.map((slot) => (
              <option key={slot} value={slot}>
                {slot}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
          {t("book.partySize")}
          <Select value={partySize} onChange={(event) => setPartySize(Number(event.target.value))}>
            {Array.from({ length: MAX_PARTY_SIZE - MIN_PARTY_SIZE + 1 }, (_, i) => i + MIN_PARTY_SIZE).map((size) => (
              <option key={size} value={size}>
                {t("book.guests", { count: size, formatted: formatNumber(size, locale) })}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <label className="flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
        {t("book.note")}
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={MAX_RESERVATION_NOTE_LENGTH}
          rows={2}
          placeholder={t("book.notePlaceholder")}
        />
      </label>
      <p className="text-body-caption text-muted-foreground">
        {t("book.hint", { max: formatNumber(MAX_PARTY_SIZE, locale) })}
      </p>
      {error ? <FormMessage>{error}</FormMessage> : null}
      <Button type="submit" loading={pending} className="self-start">
        {pending ? t("book.sending") : t("book.submit")}
      </Button>
    </form>
  );
}
