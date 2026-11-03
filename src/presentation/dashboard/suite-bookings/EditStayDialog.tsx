"use client";

import { CircleCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import type { SuiteStayInput } from "@/src/contracts/suite-booking-schema";
import { shiftCafeDay } from "@/src/domain/entities/CafeTime";
import {
  MAX_SUITE_DAYS_AHEAD,
  MAX_SUITE_GUESTS,
  MAX_SUITE_NIGHTS,
  MIN_SUITE_GUESTS,
  editableSuiteStayDetails,
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
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Select } from "@/src/presentation/design-system/components/form/Select/Select";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { DashboardDialog } from "../DashboardDialog";
import { DashboardField } from "../DashboardField";
import { FIELD_GRID } from "../fieldStyles";

import { suiteBookingsApi } from "./suite-booking-api";

type EditStayDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: Pick<SuiteBooking, "id" | "reference" | "status" | "guestName" | "checkIn" | "checkOut" | "guests">;
  /** Stays holding the suite, to warn about a clash before saving. */
  held: readonly Pick<SuiteBooking, "id" | "reference" | "checkIn" | "checkOut">[];
  today: string;
};

const FIELDS = ["checkIn", "checkOut", "guests"] as const satisfies readonly (keyof SuiteStayInput)[];

/**
 * "Edit stay": move a stay's arrival and departure or change how many it's for —
 * or, once the guest is in, only the departure, to extend or shorten it
 * (`editableSuiteStayDetails`). Like "New stay" it says up front whether the
 * nights work — past, too long, or clashing with a held stay — and the server
 * re-checks under the suite's lock. Only what changed is sent. Mounted fresh each
 * time it opens, so it starts from the stay.
 */
export function EditStayDialog({ open, onOpenChange, booking, held, today }: EditStayDialogProps) {
  const t = useTranslations("dashSuite");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();

  const editable = editableSuiteStayDetails(booking);
  const [checkIn, setCheckIn] = React.useState(booking.checkIn);
  const [checkOut, setCheckOut] = React.useState(booking.checkOut);
  const [guests, setGuests] = React.useState(booking.guests);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const range = (from: string, to: string): string =>
    `${formatCafeDayShort(from, locale)} → ${formatCafeDayShort(to, locale)}`;
  const moved = checkIn !== booking.checkIn || checkOut !== booking.checkOut;
  const nights = checkIn && checkOut ? suiteNights(checkIn, checkOut) : 0;
  const clash =
    moved && nights > 0
      ? held.find((stay) => stay.id !== booking.id && staysOverlap(stay, { checkIn, checkOut }))
      : undefined;
  const problem =
    !checkIn || !checkOut
      ? null
      : checkIn !== booking.checkIn && checkIn < today
        ? t("errorPast")
        : checkOut !== booking.checkOut && checkOut < today
          ? t("errorDeparturePast")
          : nights < 1
            ? t("errorOrder")
            : nights > MAX_SUITE_NIGHTS
              ? t("errorTooLong", { nights: formatNumber(MAX_SUITE_NIGHTS, locale) })
              : clash
                ? t("errorClash", { reference: clash.reference, range: range(clash.checkIn, clash.checkOut) })
                : null;

  const changes: SuiteStayInput = {
    ...(checkIn !== booking.checkIn ? { checkIn } : {}),
    ...(checkOut !== booking.checkOut ? { checkOut } : {}),
    ...(guests !== booking.guests ? { guests } : {}),
  };
  const blocked = Object.keys(changes).length === 0 || problem !== null || nights < 1;

  function submit(): void {
    setServerError(null);
    startTransition(async () => {
      try {
        const saved = await suiteBookingsApi.edit(booking.id, changes);
        toast({
          tone: "success",
          title: t("stayChanged", { reference: saved.reference, range: range(saved.checkIn, saved.checkOut) }),
        });
        onOpenChange(false);
        router.refresh();
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
        setServerError(localizeApiError(err, tApiErrors, t("editStayError")));
        router.refresh();
      }
    });
  }

  const message = problem ?? serverError;

  return (
    <DashboardDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("editStayTitle", { reference: booking.reference })}
      subtitle={
        booking.status === "checkedIn" ? t("editStayCheckedInSub") : t("editStaySub", { name: booking.guestName })
      }
      submitLabel={t("editStaySubmit")}
      blocked={blocked}
      pending={pending}
      onSubmit={submit}
      error={message}
      aside={
        // The nights work: said in green, where a problem would otherwise show.
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
      <div className={FIELD_GRID}>
        <DashboardField label={t("checkIn")}>
          <Input
            size="control-md"
            type="date"
            value={checkIn}
            min={today}
            max={shiftCafeDay(today, MAX_SUITE_DAYS_AHEAD)}
            dir="ltr"
            disabled={!editable.includes("checkIn")}
            onChange={(event) => {
              const next = event.target.value || checkIn;
              setCheckIn(next);
              // Keep the departure after the arrival as the arrival moves.
              if (checkOut <= next) setCheckOut(shiftCafeDay(next, 1));
            }}
          />
        </DashboardField>
        <DashboardField label={t("checkOut")}>
          <Input
            size="control-md"
            type="date"
            value={checkOut}
            // After the arrival, and — for a guest already in — not before today.
            min={checkIn >= today ? shiftCafeDay(checkIn, 1) : today}
            dir="ltr"
            disabled={!editable.includes("checkOut")}
            onChange={(event) => setCheckOut(event.target.value || checkOut)}
          />
        </DashboardField>
        <DashboardField label={t("guestsLabel")} className="col-span-full">
          <Select
            size="control-md"
            value={String(guests)}
            disabled={!editable.includes("guests")}
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
      </div>
    </DashboardDialog>
  );
}
