"use client";

import { CircleCheck, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { shiftCafeDay } from "@/src/domain/entities/CafeTime";
import {
  MAX_SUITE_GUEST_NAME_LENGTH,
  MAX_SUITE_GUESTS,
  MAX_SUITE_NIGHTS,
  MAX_SUITE_NOTE_LENGTH,
  MIN_SUITE_GUESTS,
  staysOverlap,
  suiteNights,
  type SuiteBooking,
} from "@/src/domain/entities/SuiteBooking";
import { useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatCafeDayShort } from "@/src/lib/formatCafeDay";
import { formatNumber } from "@/src/lib/formatNumber";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Select } from "@/src/presentation/design-system/components/form/Select/Select";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { DashboardDialog } from "../DashboardDialog";
import { DashboardField } from "../DashboardField";

import { suiteBookingsApi } from "./suite-booking-api";
import { WINDOW_LEAD_DAYS } from "./suiteCalendar";

type NewStayDialogProps = {
  /** Stays holding the suite, to warn about a clash before saving. */
  held: readonly Pick<SuiteBooking, "reference" | "checkIn" | "checkOut">[];
  today: string;
  /** The first night nobody holds — where the form opens. */
  firstFree: string;
};

const FIELDS = ["guestName", "guestPhone", "checkIn", "checkOut", "guests", "note"] as const;
const DEFAULT_GUESTS = 2;

/**
 * "New stay" for a guest who rang or asked at the counter. It's confirmed straight
 * away, so the form says up front whether the dates work — past, too long, or
 * clashing with a held stay — and the server re-checks under the suite's lock.
 * After saving, the calendar moves to the new stay.
 */
export function NewStayDialog({ held, today, firstFree }: NewStayDialogProps) {
  const t = useTranslations("dashSuite");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();

  const [open, setOpen] = React.useState(false);
  const [guestName, setGuestName] = React.useState("");
  const [guestPhone, setGuestPhone] = React.useState("");
  const [checkIn, setCheckIn] = React.useState(firstFree);
  const [checkOut, setCheckOut] = React.useState(shiftCafeDay(firstFree, 1));
  const [guests, setGuests] = React.useState(DEFAULT_GUESTS);
  const [note, setNote] = React.useState("");
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function openDialog(): void {
    setGuestName("");
    setGuestPhone("");
    setCheckIn(firstFree);
    setCheckOut(shiftCafeDay(firstFree, 1));
    setGuests(DEFAULT_GUESTS);
    setNote("");
    setServerError(null);
    setOpen(true);
  }

  const range = (from: string, to: string): string =>
    `${formatCafeDayShort(from, locale)} → ${formatCafeDayShort(to, locale)}`;
  const nights = checkIn && checkOut ? suiteNights(checkIn, checkOut) : 0;
  const clash = nights > 0 ? held.find((stay) => staysOverlap(stay, { checkIn, checkOut })) : undefined;
  const problem =
    !checkIn || !checkOut
      ? null
      : checkIn < today
        ? t("errorPast")
        : nights < 1
          ? t("errorOrder")
          : nights > MAX_SUITE_NIGHTS
            ? t("errorTooLong", { nights: formatNumber(MAX_SUITE_NIGHTS, locale) })
            : clash
              ? t("errorClash", { reference: clash.reference, range: range(clash.checkIn, clash.checkOut) })
              : null;
  const blocked = problem !== null || nights < 1 || !guestName.trim() || !guestPhone.trim();

  function submit(): void {
    setServerError(null);
    startTransition(async () => {
      try {
        const saved = await suiteBookingsApi.create({ guestName, guestPhone, checkIn, checkOut, guests, note });
        toast({
          tone: "success",
          title: t("stayBooked", {
            reference: saved.reference,
            name: saved.guestName,
            range: range(saved.checkIn, saved.checkOut),
          }),
        });
        setOpen(false);
        // The calendar jumps to the new stay, outlined.
        router.push(
          `/dashboard/suite?from=${shiftCafeDay(saved.checkIn, -WINDOW_LEAD_DAYS)}&focus=${saved.id}#stay-${saved.id}`,
        );
      } catch (err) {
        if (err instanceof ApiError) {
          const field = FIELDS.map((name) => err.fieldErrors?.[name]).find(Boolean);
          if (field) {
            setServerError(formErrorMessage(tFormErrors, field) ?? field);
            return;
          }
          if (err.status === 400 && err.message) {
            setServerError(err.message);
            return;
          }
        }
        setServerError(localizeApiError(err, tApiErrors, t("bookError")));
        router.refresh();
      }
    });
  }

  const message = problem ?? serverError;

  return (
    <>
      <Button size="control-md" type="button" className="gap-2 px-4" onClick={openDialog}>
        <Icon icon={Plus} size="icon-md" />
        {t("newStay")}
      </Button>

      <DashboardDialog
        open={open}
        onOpenChange={setOpen}
        title={t("newStay")}
        subtitle={t("newStaySub")}
        submitLabel={t("confirmStay")}
        blocked={blocked}
        pending={pending}
        onSubmit={submit}
        error={message}
        aside={
          // The dates work: said in green, where a problem would otherwise show.
          !message && nights > 0 ? (
            <p className="flex items-start gap-1.5 text-body-default font-medium text-pretty text-success-foreground sm:text-body-small">
              <Icon icon={CircleCheck} size="icon-md" className="mt-0.5 shrink-0" />
              {t("staySummary", {
                nights: t("nights", { count: nights, formatted: formatNumber(nights, locale) }),
                range: range(checkIn, checkOut),
              })}
            </p>
          ) : null
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <DashboardField label={t("guestName")} className="col-span-2">
            <Input
              size="control-md"
              value={guestName}
              onChange={(event) => setGuestName(event.target.value)}
              maxLength={MAX_SUITE_GUEST_NAME_LENGTH}
              placeholder={t("guestNamePlaceholder")}
              autoComplete="off"
              required
            />
          </DashboardField>
          <DashboardField label={t("guestPhone")} className="col-span-2">
            <Input
              size="control-md"
              type="tel"
              inputMode="tel"
              value={guestPhone}
              onChange={(event) => setGuestPhone(event.target.value)}
              placeholder="0912 345 6789"
              autoComplete="off"
              dir="ltr"
              required
            />
          </DashboardField>
          <DashboardField label={t("checkIn")}>
            <Input
              size="control-md"
              type="date"
              value={checkIn}
              min={today}
              dir="ltr"
              onChange={(event) => {
                const next = event.target.value || checkIn;
                setCheckIn(next);
                // Keep check-out after check-in as the arrival moves.
                if (!checkOut || checkOut <= next) setCheckOut(shiftCafeDay(next, 1));
              }}
            />
          </DashboardField>
          <DashboardField label={t("checkOut")}>
            <Input
              size="control-md"
              type="date"
              value={checkOut}
              min={shiftCafeDay(checkIn || today, 1)}
              dir="ltr"
              onChange={(event) => setCheckOut(event.target.value || checkOut)}
            />
          </DashboardField>
          <DashboardField label={t("guestsLabel")} className="col-span-2">
            <Select
              size="control-md"
              value={String(guests)}
              onChange={(event) => setGuests(Number(event.target.value))}
            >
              {Array.from({ length: MAX_SUITE_GUESTS - MIN_SUITE_GUESTS + 1 }, (_, i) => i + MIN_SUITE_GUESTS).map(
                (count) => (
                  <option key={count} value={count}>
                    {t("guests", { count, formatted: formatNumber(count, locale) })}
                  </option>
                ),
              )}
            </Select>
          </DashboardField>
          <DashboardField label={t("noteOptional")} className="col-span-2">
            <Input
              size="control-md"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={MAX_SUITE_NOTE_LENGTH}
              placeholder={t("notePlaceholder")}
              autoComplete="off"
            />
          </DashboardField>
        </div>
      </DashboardDialog>
    </>
  );
}
