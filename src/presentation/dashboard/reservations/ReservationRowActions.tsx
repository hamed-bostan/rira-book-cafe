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
import { FormMessage } from "@/src/presentation/design-system/components/form/FormMessage/FormMessage";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { Modal, ModalContent } from "@/src/presentation/design-system/components/Modal/Modal";
import { ConfirmSheet } from "@/src/presentation/design-system/components/Sheet/ConfirmSheet";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

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

/**
 * One booking's controls on the day view, as the design lays them out: the next
 * step as a button (Confirm opens the table picker; Seat and Complete act at
 * once), Cancel beside a request, and a "⋯" menu with Change table, Mark no-show
 * and Cancel booking. Cancelling and no-shows ask first. Each writes over the REST
 * API and `router.refresh()`es; a 409 (table just taken) shows in the dialog.
 */
export function ReservationRowActions({ reservation, bookings, events }: ReservationRowActionsProps) {
  const t = useTranslations("dashReservations");
  const tFloor = useTranslations("floorTables");
  const tApiErrors = useTranslations("apiErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();
  const [tableMode, setTableMode] = React.useState<TableMode | null>(null);
  const [pick, setPick] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [confirming, setConfirming] = React.useState<"cancelled" | "noShow" | null>(null);

  const { status, reference } = reservation;
  const tableName = (label: string): string => tFloor("tableName", tableNameValues(label, locale));

  function save(change: { status?: ReservationStatus; tableLabel?: string }): void {
    setError(null);
    startTransition(async () => {
      try {
        await reservationsApi.update(reservation.id, change);
        setTableMode(null);
        toast({
          tone: "success",
          title: change.status
            ? t("statusChanged", { reference, status: t(`status.${change.status}`) }) +
              (change.tableLabel ? ` · ${tableName(change.tableLabel)}` : "")
            : t("tableSaved", { reference, table: tableName(change.tableLabel ?? "") }),
        });
      } catch (err) {
        const message = localizeApiError(err, tApiErrors, t("updateError"));
        if (tableMode) setError(message);
        else toast({ tone: "error", title: message });
      }
      router.refresh();
    });
  }

  function openTable(mode: TableMode): void {
    setError(null);
    setPick(mode === "change" ? (reservation.tableLabel ?? null) : null);
    setTableMode(mode);
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
  const blocked = !pick || (tableMode === "change" && pick === reservation.tableLabel);

  return (
    <div className="ms-auto flex shrink-0 items-center gap-2">
      {status === "requested" ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => setConfirming("cancelled")}
          className="px-3 font-medium text-muted-foreground hover:bg-muted hover:text-error-foreground"
        >
          {t("action.cancelled")}
        </Button>
      ) : null}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="px-3"
        loading={pending && !tableMode}
        onClick={primary.run}
      >
        {primary.label}
      </Button>
      {status === "confirmed" || status === "seated" ? (
        <DropdownMenu>
          <DropdownMenuIconTrigger
            appearance="outline"
            disabled={pending}
            aria-label={t("moreActionsAria", { reference })}
          >
            <Icon icon={MoreHorizontal} size="sm" className="sm:size-4" />
          </DropdownMenuIconTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => openTable("change")}>{t("changeTable")}</DropdownMenuItem>
            {status === "confirmed" ? (
              <>
                <DropdownMenuItem destructive onSelect={() => setConfirming("noShow")}>
                  {t("markNoShow")}
                </DropdownMenuItem>
                <DropdownMenuItem destructive onSelect={() => setConfirming("cancelled")}>
                  {t("cancelBooking")}
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      <Modal open={tableMode !== null} onOpenChange={(open) => !open && setTableMode(null)}>
        <ModalContent
          title={t("tableDialogTitle", { reference })}
          className="flex max-h-[calc(100dvh-2rem)] max-w-md flex-col gap-5 overflow-y-auto"
          titleClassName="text-start text-body-lead"
        >
          <p className="-mt-4 text-body-default text-muted-foreground sm:text-body-small">
            {t("tableDialogSub", {
              name: reservation.guestName,
              party: t("partySize", {
                count: reservation.partySize,
                formatted: formatNumber(reservation.partySize, locale),
              }),
              from: formatEventTime(reservation.startsAt, locale),
              to: formatEventTime(until, locale),
            })}
          </p>
          <TableChoiceGrid choices={choices} value={pick} onChange={setPick} />
          {error ? <FormMessage>{error}</FormMessage> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" className="px-4" onClick={() => setTableMode(null)}>
              {t("dialogCancel")}
            </Button>
            <Button
              type="button"
              size="sm"
              className="px-4"
              loading={pending}
              disabled={blocked}
              onClick={() => {
                if (!pick) return;
                if (tableMode === "confirm") save({ status: "confirmed", tableLabel: pick });
                else if (tableMode === "seat") save({ status: "seated", tableLabel: pick });
                else save({ tableLabel: pick });
              }}
            >
              {tableMode === "confirm"
                ? t("confirmBooking")
                : tableMode === "seat"
                  ? t("action.seated")
                  : t("saveTable")}
            </Button>
          </div>
        </ModalContent>
      </Modal>

      <ConfirmSheet
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={confirming ? t(`confirmTitle.${confirming}`, { reference }) : ""}
        message={t("confirmMessage")}
        confirmLabel={confirming === "noShow" ? t("markNoShow") : t("cancelBooking")}
        cancelLabel={t("dialogCancel")}
        onConfirm={() => {
          if (confirming) save({ status: confirming });
          setConfirming(null);
        }}
      />
    </div>
  );
}
