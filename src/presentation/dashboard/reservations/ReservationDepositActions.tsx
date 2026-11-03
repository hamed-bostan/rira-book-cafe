"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { moneyField } from "@/src/contracts/money-fields";
import type { Reservation } from "@/src/domain/entities/Reservation";
import {
  canSettleReservationDeposit,
  canTakeReservationDeposit,
  RESERVATION_DEPOSIT_METHODS,
  type ReservationDepositMethod,
  type ReservationDepositSettlement,
} from "@/src/domain/entities/ReservationDeposit";
import { useRouter } from "@/src/i18n/navigation";
import { formatMoney } from "@/src/lib/formatMoney";
import { cn } from "@/src/lib/utils";
import { expenseApiErrorMessage } from "@/src/presentation/dashboard/expenses/expenseApiErrorMessage";
import { normalizeAmount } from "@/src/presentation/dashboard/expenses/expenseFormat";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Select } from "@/src/presentation/design-system/components/form/Select/Select";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { DashboardDialog } from "../DashboardDialog";
import { DashboardField } from "../DashboardField";
import { DANGER_SECONDARY, FIELD_GRID } from "../fieldStyles";

import { reservationDepositsApi } from "./reservation-deposit-api";

type ReservationDepositActionsProps = {
  reservation: Pick<Reservation, "id" | "reference" | "status" | "guestName" | "deposit">;
  /** Keeping a deposit books it as income — for a viewer who keeps the books. */
  canKeep: boolean;
};

/**
 * A table booking's deposit, at the desk: Take deposit while the booking is on
 * (amount and how it was paid, never online); once it's over — completed, a
 * no-show, cancelled — Return deposit, or Keep deposit as income. Each asks
 * first, writes over the REST API and `router.refresh()`es.
 */
export function ReservationDepositActions({ reservation, canKeep }: ReservationDepositActionsProps) {
  const t = useTranslations("dashReservations");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();
  const [taking, setTaking] = React.useState(false);
  const [amount, setAmount] = React.useState("");
  const [method, setMethod] = React.useState<ReservationDepositMethod>("cash");
  // What the settle dialog is for stays set while it closes, so its words don't change mid-fade.
  const [settling, setSettling] = React.useState<ReservationDepositSettlement>("returned");
  const [confirming, setConfirming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const { reference, deposit } = reservation;
  const canTake = canTakeReservationDeposit(reservation);
  const canSettle = canSettleReservationDeposit(reservation);
  if (!canTake && !canSettle) return null;

  const parsed = moneyField.safeParse(normalizeAmount(amount));
  const fieldError = amount.trim() !== "" && !parsed.success ? tFormErrors("amountInvalid") : undefined;

  function take(): void {
    setError(null);
    startTransition(async () => {
      try {
        await reservationDepositsApi.create(reservation.id, { amount: normalizeAmount(amount), method });
        setTaking(false);
        toast({ tone: "success", title: t("deposit.taken", { reference }) });
        router.refresh();
      } catch (err) {
        setError(expenseApiErrorMessage(err, tFormErrors, tApiErrors, t("deposit.error")));
      }
    });
  }

  function settle(): void {
    setError(null);
    startTransition(async () => {
      try {
        await reservationDepositsApi.update(reservation.id, settling);
        setConfirming(false);
        toast({ tone: "success", title: t(`deposit.${settling}`, { reference }) });
        router.refresh();
      } catch (err) {
        setError(expenseApiErrorMessage(err, tFormErrors, tApiErrors, t("deposit.error")));
      }
    });
  }

  function ask(to: ReservationDepositSettlement): void {
    setError(null);
    setSettling(to);
    setConfirming(true);
  }

  const held = deposit ? formatMoney(deposit.amount, locale) : "";

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      {canTake ? (
        <Button
          type="button"
          variant="secondary"
          size="control-sm"
          className="px-3"
          onClick={() => {
            setAmount("");
            setMethod("cash");
            setError(null);
            setTaking(true);
          }}
        >
          {t("deposit.take")}
        </Button>
      ) : null}
      {canSettle ? (
        <>
          <Button type="button" variant="secondary" size="control-sm" className="px-3" onClick={() => ask("returned")}>
            {t("deposit.return")}
          </Button>
          {canKeep ? (
            <Button
              type="button"
              variant="secondary"
              size="control-sm"
              className={cn("px-3", DANGER_SECONDARY)}
              onClick={() => ask("kept")}
            >
              {t("deposit.keep")}
            </Button>
          ) : null}
        </>
      ) : null}

      <DashboardDialog
        open={taking}
        onOpenChange={setTaking}
        title={t("deposit.takeTitle", { reference })}
        subtitle={t("deposit.takeSubtitle", { name: reservation.guestName })}
        submitLabel={t("deposit.take")}
        blocked={!parsed.success}
        pending={pending}
        onSubmit={take}
        preview={parsed.success ? t("deposit.takePreview", { amount: formatMoney(parsed.data, locale) }) : undefined}
        error={fieldError ?? error}
      >
        <div className={FIELD_GRID}>
          <DashboardField label={t("deposit.amountLabel")}>
            <Input
              size="control-md"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              autoComplete="off"
              inputMode="numeric"
              placeholder="0"
              dir="ltr"
            />
          </DashboardField>
          <DashboardField label={t("deposit.methodLabel")}>
            <Select
              size="control-md"
              value={method}
              onChange={(event) => setMethod(event.target.value as ReservationDepositMethod)}
            >
              {RESERVATION_DEPOSIT_METHODS.map((option) => (
                <option key={option} value={option}>
                  {t(`deposit.method.${option}`)}
                </option>
              ))}
            </Select>
          </DashboardField>
        </div>
      </DashboardDialog>

      <DashboardDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t(settling === "kept" ? "deposit.keepTitle" : "deposit.returnTitle", { reference })}
        subtitle={
          settling === "kept"
            ? t("deposit.keepMessage", { amount: held })
            : t("deposit.returnMessage", {
                amount: held,
                name: reservation.guestName,
                method: deposit ? t(`deposit.method.${deposit.method}`) : "",
              })
        }
        submitLabel={t(settling === "kept" ? "deposit.keep" : "deposit.return")}
        pending={pending}
        onSubmit={settle}
        error={error}
        danger={settling === "kept"}
      />
    </div>
  );
}
