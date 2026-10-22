"use client";

import { Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { isCafeTable } from "@/src/domain/entities/CafeTable";
import { wallTimeToDate } from "@/src/domain/entities/CafeTime";
import { tableChoicesFor, type FloorBooking, type FloorEvent } from "@/src/domain/entities/FloorAvailability";
import {
  BOOKING_SLOT_MINUTES,
  DEFAULT_RESERVATION_MINUTES,
  FIRST_BOOKING_HOUR,
  LAST_BOOKING_HOUR,
  MAX_GUEST_NAME_LENGTH,
  MAX_PARTY_SIZE,
  MAX_RESERVATION_NOTE_LENGTH,
  MIN_PARTY_SIZE,
} from "@/src/domain/entities/Reservation";
import { useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatEventTime } from "@/src/lib/formatEventWhen";
import { formatNumber } from "@/src/lib/formatNumber";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { FormMessage } from "@/src/presentation/design-system/components/form/FormMessage/FormMessage";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Select } from "@/src/presentation/design-system/components/form/Select/Select";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { Modal, ModalContent } from "@/src/presentation/design-system/components/Modal/Modal";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { tableNameValues } from "../floor/tableName";

import { reservationsApi } from "./reservation-api";
import { TableChoiceGrid } from "./TableChoiceGrid";

type NewBookingDialogProps = {
  /** The day on screen, `YYYY-MM-DD` on the cafe calendar — the booking is for this day. */
  day: string;
  /** "Today, long", already formatted for the subtitle. */
  dayLabel: string;
  /** "Now", from the page — on today, times already gone can't be picked. */
  now: string;
  bookings: readonly FloorBooking[];
  events: readonly FloorEvent[];
};

const FIELDS = ["guestName", "guestPhone", "startsAt", "partySize", "note", "tableLabel"] as const;
const DEFAULT_HOUR = 18;
const DEFAULT_PARTY = 2;

const pad = (n: number): string => String(n).padStart(2, "0");

/** Every bookable quarter hour of a day, as `HH:mm`. */
const SLOTS: readonly string[] = Array.from(
  { length: ((LAST_BOOKING_HOUR - FIRST_BOOKING_HOUR) * 60) / BOOKING_SLOT_MINUTES + 1 },
  (_, index) => {
    const minutes = FIRST_BOOKING_HOUR * 60 + index * BOOKING_SLOT_MINUTES;
    return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
  },
);

/**
 * "New booking" for a guest who rang or walked in. Pick a table to confirm it on
 * the spot, or leave it as a request to answer later. The floor shown is the
 * day's bookings and events; the server re-checks the table when it saves.
 */
export function NewBookingDialog({ day, dayLabel, now, bookings, events }: NewBookingDialogProps) {
  const t = useTranslations("dashReservations");
  const tFloor = useTranslations("floorTables");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();

  const nowDate = new Date(now);
  const startOf = (slot: string): Date => wallTimeToDate(`${day}T${slot}`);
  const isPast = (slot: string): boolean => startOf(slot) < nowDate;
  // Today opens on the next quarter hour; another day on the evening rush.
  const defaultSlot = (): string =>
    SLOTS.some(isPast) ? (SLOTS.find((slot) => !isPast(slot)) ?? SLOTS[SLOTS.length - 1]) : `${pad(DEFAULT_HOUR)}:00`;

  const [open, setOpen] = React.useState(false);
  const [guestName, setGuestName] = React.useState("");
  const [guestPhone, setGuestPhone] = React.useState("");
  const [time, setTime] = React.useState(`${pad(DEFAULT_HOUR)}:00`);
  const [partySize, setPartySize] = React.useState(DEFAULT_PARTY);
  const [note, setNote] = React.useState("");
  const [pick, setPick] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function openDialog(): void {
    setGuestName("");
    setGuestPhone("");
    setTime(defaultSlot());
    setPartySize(DEFAULT_PARTY);
    setNote("");
    setPick(null);
    setError(null);
    setOpen(true);
  }

  const choices = tableChoicesFor(
    { startsAt: startOf(time).toISOString(), durationMinutes: DEFAULT_RESERVATION_MINUTES, partySize },
    bookings,
    events,
  );
  const blocked = !guestName.trim() || !guestPhone.trim();

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    if (blocked) return;
    setError(null);
    startTransition(async () => {
      try {
        const saved = await reservationsApi.create({
          guestName,
          guestPhone,
          startsAt: `${day}T${time}`,
          partySize,
          note,
          tableLabel: pick && isCafeTable(pick) ? pick : undefined,
        });
        toast({
          tone: "success",
          title: t("bookedToast", {
            reference: saved.reference,
            name: saved.guestName,
            time: formatEventTime(saved.startsAt, locale),
            table: saved.tableLabel ? tFloor("tableName", tableNameValues(saved.tableLabel, locale)) : t("noTableYet"),
          }),
        });
        setOpen(false);
        router.refresh();
      } catch (err) {
        if (err instanceof ApiError) {
          const field = FIELDS.map((name) => err.fieldErrors?.[name]).find(Boolean);
          if (field) {
            setError(formErrorMessage(tFormErrors, field) ?? field);
            return;
          }
          if (err.status === 400 && err.message) {
            setError(err.message);
            return;
          }
        }
        setError(localizeApiError(err, tApiErrors, t("bookError")));
        // A table taken meanwhile: show the floor as it is now.
        router.refresh();
      }
    });
  }

  return (
    <>
      <Button type="button" className="gap-2 px-4" onClick={openDialog}>
        <Icon icon={Plus} size="sm" />
        {t("newBooking")}
      </Button>

      <Modal open={open} onOpenChange={setOpen}>
        <ModalContent
          title={t("newBooking")}
          className="flex max-h-[calc(100dvh-2rem)] max-w-md flex-col overflow-y-auto"
          titleClassName="text-start text-body-lead"
        >
          <p className="mt-1 text-body-default text-muted-foreground sm:text-body-small">
            {t("newBookingSub", { day: dayLabel })}
          </p>
          <form onSubmit={submit} className="mt-5 flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-4">
              <label className="col-span-2 flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
                {t("guestName")}
                <Input
                  value={guestName}
                  onChange={(event) => setGuestName(event.target.value)}
                  maxLength={MAX_GUEST_NAME_LENGTH}
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
                {t("time")}
                <Select
                  value={time}
                  onChange={(event) => {
                    setTime(event.target.value);
                    setPick(null);
                  }}
                >
                  {SLOTS.map((slot) => (
                    <option key={slot} value={slot} disabled={isPast(slot)}>
                      {formatEventTime(startOf(slot).toISOString(), locale)}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="flex min-w-0 flex-col gap-1.5 text-body-small-emphasis text-foreground">
                {t("party")}
                <Select
                  value={String(partySize)}
                  onChange={(event) => {
                    const size = Number(event.target.value);
                    setPartySize(size);
                    // A table too small for the new party is let go.
                    const picked = choices.find((choice) => choice.label === pick);
                    if (picked && picked.seats < size) setPick(null);
                  }}
                >
                  {Array.from(
                    { length: MAX_PARTY_SIZE - MIN_PARTY_SIZE + 1 },
                    (_, index) => index + MIN_PARTY_SIZE,
                  ).map((size) => (
                    <option key={size} value={size}>
                      {t("partySize", { count: size, formatted: formatNumber(size, locale) })}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="col-span-2 flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
                {t("noteOptional")}
                <Input
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={MAX_RESERVATION_NOTE_LENGTH}
                  placeholder={t("notePlaceholder")}
                  autoComplete="off"
                />
              </label>
            </div>

            <div className="flex flex-col gap-3">
              <p className="text-body-caption-bold tracking-wider text-muted-foreground uppercase">
                {t("tableOptional")}
              </p>
              <TableChoiceGrid choices={choices} value={pick} onChange={setPick} clearable />
            </div>

            {error ? <FormMessage>{error}</FormMessage> : null}

            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" size="sm" className="px-4" onClick={() => setOpen(false)}>
                {t("dialogCancel")}
              </Button>
              <Button type="submit" size="sm" className="px-4" loading={pending} disabled={blocked}>
                {pick ? t("confirmBooking") : t("saveAsRequest")}
              </Button>
            </div>
          </form>
        </ModalContent>
      </Modal>
    </>
  );
}
