"use client";

import { MoreHorizontal } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { tableChoicesFor, type FloorBooking, type FloorEvent } from "@/src/domain/entities/FloorAvailability";
import { reservationEndsAt, type Reservation, type ReservationStatus } from "@/src/domain/entities/Reservation";
import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatEventTime } from "@/src/lib/formatEventWhen";
import { formatNumber } from "@/src/lib/formatNumber";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuIconTrigger,
  DropdownMenuItem,
} from "@/src/presentation/design-system/components/DropdownMenu/DropdownMenu";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { DashboardDialog } from "../DashboardDialog";
import { tableNameValues } from "../floor/tableName";

import { reservationsApi } from "./reservation-api";
import { TableChoiceGrid } from "./TableChoiceGrid";

type ReservationRowActionsProps = {
  reservation: Pick<
    Reservation,
    "id" | "reference" | "status" | "tableLabel" | "startsAt" | "durationMinutes" | "partySize" | "guestName"
  >;
  /** The day's bookings and events, for which tables the picker can offer. */
  bookings: readonly FloorBooking[];
  events: readonly FloorEvent[];
};

/** What the table dialog is for: confirming a request, seating a party with no table yet, or moving tables. */
type TableMode = "confirm" | "seat" | "change";

/** The moves that end a booking early, each asked about first. */
type Ending = "cancelled" | "noShow";

/**
 * One booking's controls on the day view, as the design lays them out: the next
 * step as a button (Confirm opens the table picker; Seat and Complete act at
 * once), Cancel beside a request, and a "⋯" menu with Change table, Mark no-show
 * and Cancel booking. Cancelling and no-shows ask first. Each writes over the REST
 * API and `router.refresh()`es; a failure (a 409 when the table was just taken)
 * shows in the open dialog, else as a toast.
 */
export function ReservationRowActions({ reservation, bookings, events }: ReservationRowActionsProps) {
  const t = useTranslations("dashReservations");
  const tFloor = useTranslations("floorTables");
  const tApiErrors = useTranslations("apiErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();
  // Each dialog's purpose stays set while it closes, so its words don't change mid-fade.
  const [tableMode, setTableMode] = React.useState<TableMode>("confirm");
  const [picking, setPicking] = React.useState(false);
  const [pick, setPick] = React.useState<string | null>(null);
  const [ending, setEnding] = React.useState<Ending>("cancelled");
  const [confirming, setConfirming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const { status, reference } = reservation;
  const tableName = (label: string): string => tFloor("tableName", tableNameValues(label, locale));
  const dialogOpen = picking || confirming;

  function save(change: { status?: ReservationStatus; tableLabel?: string }): void {
    setError(null);
    startTransition(async () => {
      try {
        await reservationsApi.update(reservation.id, change);
        setPicking(false);
        setConfirming(false);
        toast({
          tone: "success",
          title: change.status
            ? t("statusChanged", { reference, status: t(`status.${change.status}`) }) +
              (change.tableLabel ? ` · ${tableName(change.tableLabel)}` : "")
            : t("tableSaved", { reference, table: tableName(change.tableLabel ?? "") }),
        });
      } catch (err) {
        const message = localizeApiError(err, tApiErrors, t("updateError"));
        if (dialogOpen) setError(message);
        else toast({ tone: "error", title: message });
      }
      router.refresh();
    });
  }

  function openTable(mode: TableMode): void {
    setError(null);
    setPick(mode === "change" ? (reservation.tableLabel ?? null) : null);
    setTableMode(mode);
    setPicking(true);
  }

  function ask(next: Ending): void {
    setError(null);
    setEnding(next);
    setConfirming(true);
  }

  const primary =
    status === "requested"
      ? { label: t("action.confirmed"), run: () => openTable("confirm") }
      : status === "confirmed"
        ? {
            label: t("action.seated"),
            // Seating needs a table; a booking confirmed without one picks it here.
            run: () => (reservation.tableLabel ? save({ status: "seated" }) : openTable("seat")),
          }
        : status === "seated"
          ? { label: t("action.completed"), run: () => save({ status: "completed" }) }
          : null;
  if (!primary) return null;

  const choices = tableChoicesFor(
    {
      startsAt: reservation.startsAt,
      durationMinutes: reservation.durationMinutes,
      partySize: reservation.partySize,
      reservationId: reservation.id,
    },
    bookings,
    events,
  );
  const until = reservationEndsAt(reservation).toISOString();

  function saveTable(): void {
    if (!pick) return;
    if (tableMode === "confirm") save({ status: "confirmed", tableLabel: pick });
    else if (tableMode === "seat") save({ status: "seated", tableLabel: pick });
    else save({ tableLabel: pick });
  }

  return (
    <div className="ms-auto flex shrink-0 items-center gap-2">
      {status === "requested" ? (
        <Button
          type="button"
          variant="ghost"
          size="control-md"
          disabled={pending}
          onClick={() => ask("cancelled")}
          className="px-3 font-medium text-muted-foreground hover:bg-muted hover:text-error-foreground"
        >
          {t("action.cancelled")}
        </Button>
      ) : null}
      <Button
        type="button"
        variant="secondary"
        size="control-md"
        className="px-3"
        loading={pending && !dialogOpen}
        onClick={primary.run}
      >
        {primary.label}
      </Button>
      {status === "confirmed" || status === "seated" ? (
        <DropdownMenu>
          <DropdownMenuIconTrigger
            appearance="secondary"
            disabled={pending}
            aria-label={t("moreActionsAria", { reference })}
          >
            <Icon icon={MoreHorizontal} size="sm" className="sm:size-4" />
          </DropdownMenuIconTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => openTable("change")}>{t("changeTable")}</DropdownMenuItem>
            {status === "confirmed" ? (
              <>
                <DropdownMenuItem destructive onSelect={() => ask("noShow")}>
                  {t("markNoShow")}
                </DropdownMenuItem>
                <DropdownMenuItem destructive onSelect={() => ask("cancelled")}>
                  {t("cancelBooking")}
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      <DashboardDialog
        open={picking}
        onOpenChange={setPicking}
        title={t("tableDialogTitle", { reference })}
        subtitle={t("tableDialogSub", {
          name: reservation.guestName,
          party: t("partySize", {
            count: reservation.partySize,
            formatted: formatNumber(reservation.partySize, locale),
          }),
          from: formatEventTime(reservation.startsAt, locale),
          to: formatEventTime(until, locale),
        })}
        submitLabel={
          tableMode === "confirm" ? t("confirmBooking") : tableMode === "seat" ? t("action.seated") : t("saveTable")
        }
        blocked={!pick || (tableMode === "change" && pick === reservation.tableLabel)}
        pending={pending}
        onSubmit={saveTable}
        error={error}
      >
        <TableChoiceGrid choices={choices} value={pick} onChange={setPick} />
      </DashboardDialog>

      <DashboardDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t(`confirmTitle.${ending}`, { reference })}
        subtitle={t("confirmMessage")}
        submitLabel={ending === "noShow" ? t("markNoShow") : t("cancelBooking")}
        pending={pending}
        onSubmit={() => save({ status: ending })}
        error={error}
        danger
      />
    </div>
  );
}
