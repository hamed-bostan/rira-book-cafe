"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { moneyField, optionalMoneyField } from "@/src/contracts/money-fields";
import { useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatMoney } from "@/src/lib/formatMoney";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { DashboardField } from "../DashboardField";
import { FormAlert } from "../FormAlert";

import { settlementsApi } from "./accounting-api";
import { normalizeAmount } from "./accounting-format";

type GatewaySettlementFormProps = {
  /** The cafe day today — the payout's default date and the latest it may be. */
  today: string;
  /** What the gateway holds for the cafe today, which a payout can't clear more than. */
  gatewayBalance: number;
};

/**
 * Record a payout from the online gateway as the bank shows it: what reached the
 * bank and the fee the gateway kept. As you type it says how much that clears
 * from the gateway and what's left; the server books Dr Bank + Dr fees / Cr
 * Gateway clearing, and refuses to clear more than the gateway held that day.
 */
export function GatewaySettlementForm({ today, gatewayBalance }: GatewaySettlementFormProps) {
  const t = useTranslations("dashAccounting");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();

  const [date, setDate] = React.useState(today);
  const [reference, setReference] = React.useState("");
  const [deposited, setDeposited] = React.useState("");
  const [fee, setFee] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const depositedValue = normalizeAmount(deposited);
  const feeValue = normalizeAmount(fee);
  const parsedDeposit = moneyField.safeParse(depositedValue);
  const parsedFee = optionalMoneyField.safeParse(feeValue);
  const clears = parsedDeposit.success && parsedFee.success ? parsedDeposit.data + parsedFee.data : null;

  const fieldError =
    depositedValue !== "" && !parsedDeposit.success
      ? formErrorMessage(tFormErrors, parsedDeposit.error.issues[0]?.message)
      : !parsedFee.success
        ? formErrorMessage(tFormErrors, parsedFee.error.issues[0]?.message)
        : clears !== null && clears > gatewayBalance
          ? t("overview.settlement.exceeds", { amount: formatMoney(gatewayBalance, locale) })
          : undefined;
  const ready = fieldError === undefined && clears !== null && date !== "";

  function submit(): void {
    setError(null);
    startTransition(async () => {
      try {
        const entry = await settlementsApi.create({ date, deposited: depositedValue, fee: feeValue, reference });
        toast({ tone: "success", title: t("overview.settlement.saved", { number: entry.number }) });
        setDate(today);
        setReference("");
        setDeposited("");
        setFee("");
        router.refresh();
      } catch (err) {
        // A field the server refused (the gateway held less on that day, a closed
        // period) carries its own message; anything else is the general one.
        const fieldMessage =
          err instanceof ApiError
            ? (err.fieldErrors?.deposited ?? err.fieldErrors?.date ?? err.fieldErrors?.fee)
            : undefined;
        setError(
          fieldMessage
            ? (formErrorMessage(tFormErrors, fieldMessage) ?? fieldMessage)
            : localizeApiError(err, tApiErrors, t("overview.settlement.error")),
        );
      }
    });
  }

  const message = fieldError ?? error;

  return (
    <section
      aria-labelledby="gateway-payout-heading"
      className="flex min-w-0 flex-col gap-4 rounded-card-lg border border-border bg-background p-5 shadow-xs"
    >
      <div className="flex min-w-0 flex-col gap-1">
        <h2 id="gateway-payout-heading" className="text-body-strong text-foreground">
          {t("overview.settlement.heading")}
        </h2>
        <p className="text-body-default text-pretty text-muted-foreground sm:text-body-small">
          {t("overview.settlement.hint")}
        </p>
      </div>

      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (ready && !pending) submit();
        }}
      >
        <div className="grid max-w-3xl grid-cols-1 items-start gap-4 md:grid-cols-2">
          <DashboardField label={t("overview.settlement.date")}>
            <Input
              size="control-md"
              type="date"
              value={date}
              max={today}
              onChange={(event) => setDate(event.target.value)}
              dir="ltr"
            />
          </DashboardField>
          <DashboardField label={t("overview.settlement.reference")}>
            <Input
              size="control-md"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              autoComplete="off"
              maxLength={80}
              placeholder={t("overview.settlement.referencePlaceholder")}
              dir="ltr"
            />
          </DashboardField>
          <DashboardField label={t("overview.settlement.deposited")}>
            <Input
              size="control-md"
              value={deposited}
              onChange={(event) => setDeposited(event.target.value)}
              inputMode="numeric"
              autoComplete="off"
              placeholder="0"
              dir="ltr"
            />
          </DashboardField>
          <DashboardField label={t("overview.settlement.fee")} hint={t("overview.settlement.feeHint")}>
            <Input
              size="control-md"
              value={fee}
              onChange={(event) => setFee(event.target.value)}
              inputMode="numeric"
              autoComplete="off"
              placeholder="0"
              dir="ltr"
            />
          </DashboardField>
        </div>

        {ready && clears !== null ? (
          <p
            aria-live="polite"
            className="rounded-button bg-muted px-4 py-3 text-body-default text-pretty text-foreground/80 sm:text-body-small"
          >
            {t("overview.settlement.clears", {
              amount: formatMoney(clears, locale),
              left: formatMoney(gatewayBalance - clears, locale),
            })}
          </p>
        ) : null}
        {message ? <FormAlert>{message}</FormAlert> : null}

        <div>
          <Button size="control-md" type="submit" className="px-4" loading={pending} disabled={!ready}>
            {t("overview.settlement.submit")}
          </Button>
        </div>
      </form>
    </section>
  );
}
