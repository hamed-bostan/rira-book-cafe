"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { nextReservationStatuses, type Reservation, type ReservationStatus } from "@/src/domain/entities/Reservation";
import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import {
  Button,
  ConfirmSheet,
  FormMessage,
  Input,
  Modal,
  ModalContent,
  useToast,
} from "@/src/presentation/design-system";

import { reservationsApi } from "./reservation-api";

type ReservationActionsProps = {
  reservation: Pick<Reservation, "id" | "reference" | "status" | "tableLabel">;
};

/** Steps that ask for a table first. Seating requires one; confirming offers one. */
const NEEDS_TABLE: readonly ReservationStatus[] = ["confirmed", "seated"];
/** Steps that withdraw the booking, behind a confirmation. */
const DESTRUCTIVE: readonly ReservationStatus[] = ["cancelled", "noShow"];

/**
 * The floor's controls for one booking: the workflow steps the current status
 * allows, a table dialog for confirming/seating (and moving tables), and a
 * confirmation before cancelling or marking a no-show. Each writes over the REST
 * API and `router.refresh()`es; a 409 (table taken, someone else moved it) shows
 * in the table dialog when it came from there, as a toast otherwise.
 */
export function ReservationActions({ reservation }: ReservationActionsProps) {
  const t = useTranslations("dashReservations");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();
  /** A failure inside the table dialog — shown there, since the admin is still in it. */
  const [error, setError] = React.useState<string | null>(null);
  /** The step in flight — only its button shows the spinner; the rest just disable. */
  const [active, setActive] = React.useState<ReservationStatus | "move" | null>(null);
  const [tableFor, setTableFor] = React.useState<ReservationStatus | "move" | null>(null);
  const [table, setTable] = React.useState(reservation.tableLabel ?? "");
  const [confirming, setConfirming] = React.useState<ReservationStatus | null>(null);

  const steps = nextReservationStatuses(reservation.status);
  const holdsTable = reservation.status === "confirmed" || reservation.status === "seated";

  function save(status: ReservationStatus | undefined, tableLabel?: string | null): void {
    const inDialog = tableFor !== null;
    setError(null);
    setActive(status ?? "move");
    startTransition(async () => {
      try {
        await reservationsApi.update(reservation.id, { status, tableLabel });
        setTableFor(null);
        toast({
          tone: "success",
          title: status
            ? t("statusChanged", { reference: reservation.reference, status: t(`status.${status}`) })
            : t("tableSaved", { reference: reservation.reference, table: tableLabel ?? "" }),
        });
      } catch (err) {
        const message = localizeApiError(err, tApiErrors, t("updateError"));
        if (inDialog) setError(message);
        else toast({ tone: "error", title: message });
      }
      router.refresh();
    });
  }

  function openTable(step: ReservationStatus | "move"): void {
    setError(null);
    setTable(reservation.tableLabel ?? "");
    setTableFor(step);
  }

  function onStep(status: ReservationStatus): void {
    if (NEEDS_TABLE.includes(status)) {
      openTable(status);
    } else if (DESTRUCTIVE.includes(status)) {
      setConfirming(status);
    } else {
      save(status);
    }
  }

  if (steps.length === 0 && !holdsTable) return null;

  const tableRequired = tableFor === "seated" || tableFor === "move";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {steps.map((status) => (
          <Button
            key={status}
            type="button"
            size="sm"
            variant={DESTRUCTIVE.includes(status) ? "outline" : "primary"}
            loading={pending && active === status}
            disabled={pending}
            onClick={() => onStep(status)}
          >
            {t(`action.${status}`)}
          </Button>
        ))}
        {holdsTable ? (
          <Button type="button" size="sm" variant="ghost" loading={pending && active === "move"} disabled={pending} onClick={() => openTable("move")}>
            {t("changeTable")}
          </Button>
        ) : null}
      </div>

      <Modal open={tableFor !== null} onOpenChange={(open) => !open && setTableFor(null)}>
        <ModalContent title={t("tableDialogTitle", { reference: reservation.reference })}>
          <form
            className="mt-4 flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const label = table.trim();
              if (tableRequired && !label) return;
              save(tableFor === "move" ? undefined : (tableFor ?? undefined), label || null);
            }}
          >
            <label className="flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
              {tableRequired ? t("tableLabelRequired") : t("tableLabelOptional")}
              <Input value={table} onChange={(event) => setTable(event.target.value)} placeholder="4" autoFocus />
            </label>
            {error ? <FormMessage>{error}</FormMessage> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setTableFor(null)}>
                {t("dialogCancel")}
              </Button>
              <Button type="submit" size="sm" loading={pending} disabled={tableRequired && !table.trim()}>
                {tableFor === "move" ? t("saveTable") : t(`action.${tableFor ?? "confirmed"}`)}
              </Button>
            </div>
          </form>
        </ModalContent>
      </Modal>

      <ConfirmSheet
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={confirming ? t(`confirmTitle.${confirming === "noShow" ? "noShow" : "cancelled"}`, { reference: reservation.reference }) : ""}
        message={t("confirmMessage")}
        confirmLabel={confirming ? t(`action.${confirming}`) : ""}
        cancelLabel={t("dialogCancel")}
        onConfirm={() => {
          if (confirming) save(confirming);
          setConfirming(null);
        }}
      />
    </div>
  );
}
