"use client";

import { CircleAlert, CircleCheck, Plus } from "lucide-react";
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
import { Modal, ModalContent } from "@/src/presentation/design-system/components/Modal/Modal";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

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

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    if (blocked) return;
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
      <Button type="button" className="gap-2 px-4" onClick={openDialog}>
        <Icon icon={Plus} size="sm" />
        {t("newStay")}
      </Button>

      <Modal open={open} onOpenChange={setOpen}>
        <ModalContent
          title={t("newStay")}
          className="flex max-h-[calc(100dvh-2rem)] max-w-md flex-col overflow-y-auto"
          titleClassName="text-start text-body-lead"
        >
          <p className="mt-1 text-body-default text-pretty text-muted-foreground sm:text-body-small">
            {t("newStaySub")}
          </p>
          <form onSubmit={submit} className="mt-5 flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-4">
              <label className="col-span-2 flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
                {t("guestName")}
                <Input
                  value={guestName}
                  onChange={(event) => setGuestName(event.target.value)}
                  maxLength={MAX_SUITE_GUEST_NAME_LENGTH}
                  placeholder={t("guestNamePlaceholder")}
                  autoComplete="off"
                  required
                />
              </label>
              <label className="col-span-2 flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
                {t("guestPhone")}
                <Input
                  type="tel"
                  inputMode="tel"
                  value={guestPhone}
                  onChange={(event) => setGuestPhone(event.target.value)}
                  placeholder="0912 345 6789"
                  autoComplete="off"
                  dir="ltr"
                  required
                />
              </label>
              <label className="flex min-w-0 flex-col gap-1.5 text-body-small-emphasis text-foreground">
                {t("checkIn")}
                <Input
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
              </label>
              <label className="flex min-w-0 flex-col gap-1.5 text-body-small-emphasis text-foreground">
                {t("checkOut")}
                <Input
                  type="date"
                  value={checkOut}
                  min={shiftCafeDay(checkIn || today, 1)}
                  dir="ltr"
                  onChange={(event) => setCheckOut(event.target.value || checkOut)}
                />
              </label>
              <label className="col-span-2 flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
                {t("guestsLabel")}
                <Select value={String(guests)} onChange={(event) => setGuests(Number(event.target.value))}>
                  {Array.from({ length: MAX_SUITE_GUESTS - MIN_SUITE_GUESTS + 1 }, (_, i) => i + MIN_SUITE_GUESTS).map(
                    (count) => (
                      <option key={count} value={count}>
                        {t("guests", { count, formatted: formatNumber(count, locale) })}
                      </option>
                    ),
                  )}
                </Select>
              </label>
              <label className="col-span-2 flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
                {t("noteOptional")}
                <Input
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={MAX_SUITE_NOTE_LENGTH}
                  placeholder={t("notePlaceholder")}
                  autoComplete="off"
                />
              </label>
            </div>

            {message ? (
              <p className="flex items-start gap-1.5 text-body-default font-medium text-pretty text-error-foreground sm:text-body-small">
                <Icon icon={CircleAlert} size="sm" className="mt-0.5 shrink-0" />
                {message}
              </p>
            ) : nights > 0 ? (
              <p className="flex items-start gap-1.5 text-body-default font-medium text-success-foreground sm:text-body-small">
                <Icon icon={CircleCheck} size="sm" className="mt-0.5 shrink-0" />
                {t("staySummary", {
                  nights: t("nights", { count: nights, formatted: formatNumber(nights, locale) }),
                  range: range(checkIn, checkOut),
                })}
              </p>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" size="sm" className="px-4" onClick={() => setOpen(false)}>
                {t("dialogCancel")}
              </Button>
              <Button type="submit" size="sm" className="px-4" loading={pending} disabled={blocked}>
                {t("confirmStay")}
              </Button>
            </div>
          </form>
        </ModalContent>
      </Modal>
    </>
  );
}
