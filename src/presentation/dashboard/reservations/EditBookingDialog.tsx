"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import type { ReservationDetailsInput } from "@/src/contracts/reservation-schema";
import { isCafeTable } from "@/src/domain/entities/CafeTable";
import { dateToWallTime, shiftCafeDay, wallTimeToDate } from "@/src/domain/entities/CafeTime";
import { tableChoicesFor, type Floor } from "@/src/domain/entities/FloorAvailability";
import {
  BOOKING_TIMES,
  MAX_BOOKING_DAYS_AHEAD,
  MAX_GUEST_NAME_LENGTH,
  MAX_PARTY_SIZE,
  MAX_RESERVATION_NOTE_LENGTH,
  MIN_PARTY_SIZE,
  RESERVATION_LENGTHS,
  editableReservationDetails,
  type Reservation,
} from "@/src/domain/entities/Reservation";
import { useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatCafeDayShort } from "@/src/lib/formatCafeDay";
import { formatEventTime } from "@/src/lib/formatEventWhen";
import { formatNumber } from "@/src/lib/formatNumber";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Select } from "@/src/presentation/design-system/components/form/Select/Select";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { DashboardDialog } from "../DashboardDialog";
import { DashboardField } from "../DashboardField";
import { FIELD_GRID, OVERLINE, TABLE_TILE_GRID } from "../fieldStyles";
import { tableNameValues } from "../floor/tableName";
import { FormAlert } from "../FormAlert";

import { reservationsApi } from "./reservation-api";
import { TableChoiceGrid } from "./TableChoiceGrid";

type EditBookingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservation: Reservation;
  /** "Now", from the page — times already gone today can't be picked. */
  now: string;
  /** The day on screen, whose floor is already here; another day's is read when it's picked. */
  day: string;
  floor: Floor;
  /** Today on the cafe calendar — the earliest day a booking can move to. */
  today: string;
};

const FIELDS = [
  "startsAt",
  "partySize",
  "durationMinutes",
  "guestName",
  "guestPhone",
  "note",
  "tableLabel",
] as const satisfies readonly (keyof ReservationDetailsInput)[];

/** Placeholder tiles drawn while another day's floor loads — one per table on the plan. */
const LOADING_TILES = 9;

/**
 * "Edit booking": move a booking to another day or time, change the party, how
 * long it holds the table, the guest's name and phone, the note, or the table. A
 * seated party can only change its length and table; a guest's own booking keeps
 * its account's phone (`editableReservationDetails`). The floor shown is the one
 * the booking would land on — read fresh when the day changes — and a table taken
 * then is flagged before saving; the server re-checks it under its lock. Only what
 * changed is sent. Mounted fresh each time it opens, so it starts from the booking.
 */
export function EditBookingDialog({ open, onOpenChange, reservation, now, day, floor, today }: EditBookingDialogProps) {
  const t = useTranslations("dashReservations");
  const tFloor = useTranslations("floorTables");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();

  const editable = editableReservationDetails(reservation);
  const can = (detail: (typeof FIELDS)[number]): boolean => editable.includes(detail);
  const original = dateToWallTime(new Date(reservation.startsAt));

  const [bookingDay, setBookingDay] = React.useState(original.slice(0, 10));
  const [time, setTime] = React.useState(original.slice(11));
  const [partySize, setPartySize] = React.useState(reservation.partySize);
  const [length, setLength] = React.useState(reservation.durationMinutes);
  const [guestName, setGuestName] = React.useState(reservation.guestName);
  const [guestPhone, setGuestPhone] = React.useState(reservation.guestPhone);
  const [note, setNote] = React.useState(reservation.note ?? "");
  const [pick, setPick] = React.useState<string | null>(reservation.tableLabel ?? null);
  const [floors, setFloors] = React.useState<Record<string, Floor>>({ [day]: floor });
  const [floorFailed, setFloorFailed] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const nowDate = new Date(now);
  const startOf = (slot: string): Date => wallTimeToDate(`${bookingDay}T${slot}`);
  const isPast = (slot: string): boolean => startOf(slot) < nowDate;
  // A request gets its table when it's confirmed; a booking holding one can move it here.
  const showTables = reservation.status !== "requested";
  const lengths = (RESERVATION_LENGTHS as readonly number[]).includes(reservation.durationMinutes)
    ? RESERVATION_LENGTHS
    : [...RESERVATION_LENGTHS, reservation.durationMinutes].sort((a, b) => a - b);

  async function loadFloor(target: string): Promise<void> {
    setFloorFailed(false);
    try {
      const fresh = await reservationsApi.getFloor(target);
      setFloors((current) => ({ ...current, [target]: fresh }));
    } catch {
      setFloorFailed(true);
    }
  }

  function changeDay(next: string): void {
    if (!next) return;
    setBookingDay(next);
    if (showTables && !floors[next]) void loadFloor(next);
  }

  const wallTime = `${bookingDay}T${time}`;
  const startsAt = wallTimeToDate(wallTime).toISOString();
  const shownFloor = floors[bookingDay];
  const choices = shownFloor
    ? tableChoicesFor(
        { startsAt, durationMinutes: length, partySize, reservationId: reservation.id },
        shownFloor.bookings,
        shownFloor.events,
      )
    : null;
  // The table the booking keeps (or was moved to) is someone else's at the new time.
  const clash = choices?.find((choice) => choice.label === pick)?.block;
  const clashMessage =
    pick && clash?.kind === "booking"
      ? t("editTableTaken", { table: tFloor("tableName", tableNameValues(pick, locale)), reference: clash.reference })
      : pick && clash?.kind === "event"
        ? t("editTableHeld", { table: tFloor("tableName", tableNameValues(pick, locale)), title: clash.title })
        : null;

  const changes: ReservationDetailsInput = {
    ...(wallTime !== original ? { startsAt: wallTime } : {}),
    ...(partySize !== reservation.partySize ? { partySize } : {}),
    ...(length !== reservation.durationMinutes ? { durationMinutes: length } : {}),
    ...(guestName !== reservation.guestName ? { guestName } : {}),
    ...(guestPhone !== reservation.guestPhone ? { guestPhone } : {}),
    ...(note !== (reservation.note ?? "") ? { note } : {}),
    ...(showTables && pick !== (reservation.tableLabel ?? null)
      ? { tableLabel: pick && isCafeTable(pick) ? pick : null }
      : {}),
  };
  const problem =
    "startsAt" in changes && (bookingDay < today || isPast(time)) ? t("editErrorPast") : (clashMessage ?? null);
  const blocked = Object.keys(changes).length === 0 || problem !== null || !guestName.trim() || !guestPhone.trim();

  function submit(): void {
    setError(null);
    startTransition(async () => {
      try {
        const saved = await reservationsApi.edit(reservation.id, changes);
        toast({
          tone: "success",
          title: t("editSaved", {
            reference: saved.reference,
            day: formatCafeDayShort(dateToWallTime(new Date(saved.startsAt)).slice(0, 10), locale),
            time: formatEventTime(saved.startsAt, locale),
          }),
        });
        onOpenChange(false);
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
          // The table was just taken: show the floor as it is now.
          if (err.status === 409 && showTables) await loadFloor(bookingDay);
        }
        setError(localizeApiError(err, tApiErrors, t("editError")));
        router.refresh();
      }
    });
  }

  return (
    <DashboardDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("editTitle", { reference: reservation.reference })}
      subtitle={reservation.status === "seated" ? t("editSeatedSub") : t("editSub", { name: reservation.guestName })}
      submitLabel={t("editSubmit")}
      blocked={blocked}
      pending={pending}
      onSubmit={submit}
      error={problem ?? error}
    >
      <div className="flex flex-col gap-5">
        <div className={FIELD_GRID}>
          <DashboardField label={t("editDay")}>
            <Input
              size="control-md"
              type="date"
              value={bookingDay}
              min={today}
              max={shiftCafeDay(today, MAX_BOOKING_DAYS_AHEAD)}
              dir="ltr"
              disabled={!can("startsAt")}
              onChange={(event) => changeDay(event.target.value)}
            />
          </DashboardField>
          <DashboardField label={t("time")}>
            <Select
              size="control-md"
              value={time}
              disabled={!can("startsAt")}
              onChange={(event) => setTime(event.target.value)}
            >
              {BOOKING_TIMES.map((slot) => (
                <option key={slot} value={slot} disabled={slot !== time && isPast(slot)}>
                  {formatEventTime(startOf(slot).toISOString(), locale)}
                </option>
              ))}
            </Select>
          </DashboardField>
          <DashboardField label={t("party")}>
            <Select
              size="control-md"
              value={String(partySize)}
              disabled={!can("partySize")}
              onChange={(event) => setPartySize(Number(event.target.value))}
            >
              {Array.from({ length: MAX_PARTY_SIZE - MIN_PARTY_SIZE + 1 }, (_, index) => index + MIN_PARTY_SIZE).map(
                (size) => (
                  <option key={size} value={size}>
                    {t("partySize", { count: size, formatted: formatNumber(size, locale) })}
                  </option>
                ),
              )}
            </Select>
          </DashboardField>
          <DashboardField label={t("length")}>
            <Select
              size="control-md"
              value={String(length)}
              onChange={(event) => setLength(Number(event.target.value))}
            >
              {lengths.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {t("lengthOption", { minutes: formatNumber(minutes, locale) })}
                </option>
              ))}
            </Select>
          </DashboardField>
          <DashboardField label={t("guestName")} className="col-span-full">
            <Input
              size="control-md"
              value={guestName}
              onChange={(event) => setGuestName(event.target.value)}
              maxLength={MAX_GUEST_NAME_LENGTH}
              disabled={!can("guestName")}
              autoComplete="off"
              required
            />
          </DashboardField>
          <DashboardField
            label={t("guestPhone")}
            hint={reservation.userId ? t("editPhoneFromAccount") : undefined}
            className="col-span-full"
          >
            <Input
              size="control-md"
              type="tel"
              inputMode="tel"
              value={guestPhone}
              onChange={(event) => setGuestPhone(event.target.value)}
              disabled={!can("guestPhone")}
              autoComplete="off"
              dir="ltr"
              required
            />
          </DashboardField>
          <DashboardField label={t("noteOptional")} className="col-span-full">
            <Input
              size="control-md"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={MAX_RESERVATION_NOTE_LENGTH}
              disabled={!can("note")}
              placeholder={t("notePlaceholder")}
              autoComplete="off"
            />
          </DashboardField>
        </div>

        {showTables ? (
          <>
            <p className={OVERLINE}>{reservation.status === "seated" ? t("tableGroupLabel") : t("tableOptional")}</p>
            {floorFailed ? (
              <div className="flex flex-col items-start gap-3">
                <FormAlert>{t("floorLoadError")}</FormAlert>
                <Button
                  type="button"
                  variant="secondary"
                  size="control-md"
                  className="px-3"
                  onClick={() => void loadFloor(bookingDay)}
                >
                  {t("tryAgain")}
                </Button>
              </div>
            ) : choices ? (
              <TableChoiceGrid
                choices={choices}
                value={pick}
                onChange={setPick}
                clearable={reservation.status !== "seated"}
              />
            ) : (
              <div className={TABLE_TILE_GRID}>
                {Array.from({ length: LOADING_TILES }, (_, index) => (
                  <Skeleton key={index} className="h-14 rounded-button" />
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
    </DashboardDialog>
  );
}
