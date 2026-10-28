"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { MAX_SHIFT_NOTE_LENGTH, type CashShift } from "@/src/domain/entities/CashShift";
import { useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { cn } from "@/src/lib/utils";
import { DashboardField } from "@/src/presentation/dashboard/DashboardField";
import { FormAlert } from "@/src/presentation/dashboard/FormAlert";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { cashShiftsApi } from "./cash-shift-api";
import { shiftResult } from "./shiftResult";

import type { ReactNode } from "react";

/** Digits typed in either script → a whole number, or `null` when it isn't one. */
function parseAmount(text: string): number | null {
  const latin = text.replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0)).replace(/[,\s٬]/g, "");
  return /^\d+$/.test(latin) ? Number(latin) : null;
}

/**
 * Sends a shift write and says how it went: a toast naming the shift on success
 * (worded from what the server saved), the field's or the request's error inline
 * on failure. Neither write has an undo — opening is a form, and closing books
 * the over or short.
 */
function useShiftSubmit() {
  const t = useTranslations("dashCashShifts");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function run(action: () => Promise<CashShift>, success: (shift: CashShift) => string): void {
    setError(null);
    startTransition(async () => {
      try {
        const shift = await action();
        toast({ tone: "success", title: success(shift) });
        router.refresh();
      } catch (err) {
        const field = err instanceof ApiError ? Object.values(err.fieldErrors ?? {})[0] : undefined;
        setError(
          field ? (formErrorMessage(tFormErrors, field) ?? field) : localizeApiError(err, tApiErrors, t("saveError")),
        );
      }
    });
  }

  return { pending, error, setError, run, t };
}

type AmountFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
};

function AmountField({ label, value, onChange, hint }: AmountFieldProps) {
  return (
    <DashboardField label={label} hint={hint}>
      <Input
        size="control-md"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode="numeric"
        dir="ltr"
        autoComplete="off"
        placeholder="0"
      />
    </DashboardField>
  );
}

type NoteFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

function NoteField({ label, value, onChange, placeholder }: NoteFieldProps) {
  return (
    <DashboardField label={label}>
      <Input
        size="control-md"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={MAX_SHIFT_NOTE_LENGTH}
        autoComplete="off"
        placeholder={placeholder}
      />
    </DashboardField>
  );
}

type ShiftFormProps = {
  onSubmit: () => void;
  /** Nothing to save yet, or what's typed isn't an amount — the button waits. */
  blocked: boolean;
  pending: boolean;
  error: string | null;
  submitLabel: string;
  children: ReactNode;
};

/** The column both shift forms share: the fields, any error, then the one button. */
function ShiftForm({ onSubmit, blocked, pending, error, submitLabel, children }: ShiftFormProps) {
  return (
    <form
      noValidate
      className="flex max-w-md flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!blocked && !pending) onSubmit();
      }}
    >
      {children}
      {error ? <FormAlert>{error}</FormAlert> : null}
      <Button type="submit" size="control-md" className="self-start px-4" loading={pending} disabled={blocked}>
        {submitLabel}
      </Button>
    </form>
  );
}

/** Start a shift: how much cash went into the drawer. The button names the shift it opens. */
export function OpenShiftForm({ nextNumber }: { nextNumber: number }) {
  const { pending, error, setError, run, t } = useShiftSubmit();
  const locale = useLocale();
  const [float, setFloat] = React.useState("");
  const [note, setNote] = React.useState("");
  const openingFloat = parseAmount(float);
  const typedError = float.trim() !== "" && openingFloat === null ? t("amountInvalid") : null;

  return (
    <ShiftForm
      blocked={openingFloat === null}
      pending={pending}
      error={typedError ?? error}
      submitLabel={t("openNumbered", { number: formatNumber(nextNumber, locale) })}
      onSubmit={() => {
        if (openingFloat === null) return;
        run(
          () => cashShiftsApi.open({ openingFloat, note }),
          (shift) => t("opened", { number: formatNumber(shift.number, locale) }),
        );
      }}
    >
      <AmountField
        label={t("openingFloat")}
        hint={t("openingFloatHint")}
        value={float}
        onChange={(value) => {
          setFloat(value);
          setError(null);
        }}
      />
      <NoteField label={t("note")} value={note} onChange={setNote} />
    </ShiftForm>
  );
}

/** End the shift: count the drawer; the difference from what the books expect shows as you type. */
export function CloseShiftForm({ shiftId, expectedCash }: { shiftId: string; expectedCash: number }) {
  const { pending, error, setError, run, t } = useShiftSubmit();
  const locale = useLocale();
  const [counted, setCounted] = React.useState("");
  const [note, setNote] = React.useState("");
  const countedCash = parseAmount(counted);
  const difference = countedCash === null ? null : countedCash - expectedCash;
  const typedError = counted.trim() !== "" && countedCash === null ? t("amountInvalid") : null;

  return (
    <ShiftForm
      blocked={countedCash === null}
      pending={pending}
      error={typedError ?? error}
      submitLabel={t("close")}
      onSubmit={() => {
        if (countedCash === null) return;
        run(
          () => cashShiftsApi.close(shiftId, { countedCash, note }),
          (shift) => {
            const result = shiftResult(shift.difference ?? 0);
            return t("closed", {
              number: formatNumber(shift.number, locale),
              result:
                result.kind === "exact"
                  ? t("result.exact")
                  : t(`result.${result.kind}`, { amount: formatMoney(result.amount, locale) }),
            });
          },
        );
      }}
    >
      <AmountField
        label={t("countedCash")}
        value={counted}
        onChange={(value) => {
          setCounted(value);
          setError(null);
        }}
      />
      {difference !== null ? (
        <p
          aria-live="polite"
          className={cn(
            "rounded-button px-4 py-3 text-body-default text-pretty sm:text-body-small",
            difference === 0 ? "bg-success text-success-foreground" : "bg-warning text-warning-foreground",
          )}
        >
          {difference === 0
            ? t("preview.exact")
            : difference > 0
              ? t("preview.over", { amount: formatMoney(difference, locale) })
              : t("preview.short", { amount: formatMoney(-difference, locale) })}
        </p>
      ) : null}
      <NoteField label={t("note")} value={note} onChange={setNote} placeholder={t("closeNotePlaceholder")} />
    </ShiftForm>
  );
}
