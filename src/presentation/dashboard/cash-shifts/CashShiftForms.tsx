"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { MAX_SHIFT_NOTE_LENGTH } from "@/src/domain/entities/CashShift";
import { useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatMoney } from "@/src/lib/formatMoney";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { cn } from "@/src/lib/utils";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { FormMessage } from "@/src/presentation/design-system/components/form/FormMessage/FormMessage";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { cashShiftsApi } from "./cash-shift-api";

/** Digits typed in either script → a whole number, or `null` when it isn't one. */
function parseAmount(text: string): number | null {
  const latin = text.replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0)).replace(/[,\s٬]/g, "");
  return /^\d+$/.test(latin) ? Number(latin) : null;
}

function useShiftSubmit() {
  const t = useTranslations("dashCashShifts");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function run(action: () => Promise<unknown>, success: string): void {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        toast({ tone: "success", title: success });
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

/** Start a shift: how much cash went into the drawer. */
export function OpenShiftForm() {
  const { pending, error, setError, run, t } = useShiftSubmit();
  const [float, setFloat] = React.useState("");
  const [note, setNote] = React.useState("");

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    const openingFloat = parseAmount(float);
    if (openingFloat === null) {
      setError(t("amountInvalid"));
      return;
    }
    run(() => cashShiftsApi.open({ openingFloat, note }), t("opened"));
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
        {t("openingFloat")}
        <Input
          value={float}
          onChange={(event) => setFloat(event.target.value)}
          inputMode="numeric"
          dir="ltr"
          required
          placeholder="0"
        />
        <span className="text-body-caption font-normal text-muted-foreground">{t("openingFloatHint")}</span>
      </label>
      <label className="flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
        {t("note")}
        <Input value={note} onChange={(event) => setNote(event.target.value)} maxLength={MAX_SHIFT_NOTE_LENGTH} />
      </label>
      {error ? <FormMessage>{error}</FormMessage> : null}
      <Button type="submit" className="self-start" loading={pending}>
        {t("open")}
      </Button>
    </form>
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

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    if (countedCash === null) {
      setError(t("amountInvalid"));
      return;
    }
    run(() => cashShiftsApi.close(shiftId, { countedCash, note }), t("closed"));
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
        {t("countedCash")}
        <Input
          value={counted}
          onChange={(event) => setCounted(event.target.value)}
          inputMode="numeric"
          dir="ltr"
          required
        />
      </label>
      {difference !== null ? (
        <p
          className={cn(
            "rounded-card-md px-3 py-2 text-body-small",
            difference === 0 ? "bg-success text-success-foreground" : "bg-warning text-warning-foreground",
          )}
        >
          {difference === 0
            ? t("exact")
            : difference > 0
              ? t("over", { amount: formatMoney(difference, locale) })
              : t("short", { amount: formatMoney(-difference, locale) })}
        </p>
      ) : null}
      <label className="flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
        {t("note")}
        <Input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={MAX_SHIFT_NOTE_LENGTH}
          placeholder={t("closeNotePlaceholder")}
        />
      </label>
      {error ? <FormMessage>{error}</FormMessage> : null}
      <Button type="submit" className="self-start" loading={pending}>
        {t("close")}
      </Button>
    </form>
  );
}
