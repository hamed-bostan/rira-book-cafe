"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { moneyField } from "@/src/contracts/money-fields";
import type { Account } from "@/src/domain/entities/Ledger";
import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatMoney } from "@/src/lib/formatMoney";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Select } from "@/src/presentation/design-system/components/form/Select/Select";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { journalEntriesApi } from "./accounting-api";
import { accountLabel, accountName, normalizeAmount } from "./accounting-format";
import { AccountingDialog } from "./AccountingDialog";

type NewManualEntryButtonProps = {
  /** The chart of accounts; only the active ones are offered. */
  accounts: readonly Account[];
  /** Today on the cafe calendar — the entry's default date and the latest it may be. */
  today: string;
};

const FIELD = "flex min-w-0 flex-col gap-1.5 text-body-small-emphasis text-foreground";

/**
 * "New manual entry": one amount from one account to another — an owner top-up,
 * a correction — for what nothing else posts. Before posting it says which
 * account is debited and which credited. An entry over more than two accounts
 * goes through the full form, which this links to. Posted entries are never
 * edited, only reversed, so there's no undo; it opens the journal on the new entry.
 */
export function NewManualEntryButton({ accounts, today }: NewManualEntryButtonProps) {
  const t = useTranslations("dashAccounting");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();

  const [open, setOpen] = React.useState(false);
  const [date, setDate] = React.useState(today);
  const [amount, setAmount] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [debit, setDebit] = React.useState("");
  const [credit, setCredit] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const active = accounts.filter((account) => account.isActive);
  const nameOf = (code: string): string => {
    const account = active.find((candidate) => candidate.code === code);
    return account ? accountName(account, locale) : code;
  };

  const typed = normalizeAmount(amount);
  const parsedAmount = moneyField.safeParse(typed);
  const fieldError =
    typed !== "" && !parsedAmount.success
      ? formErrorMessage(tFormErrors, parsedAmount.error.issues[0]?.message)
      : debit !== "" && debit === credit
        ? t("quickEntry.sameAccount")
        : undefined;
  const ready =
    fieldError === undefined &&
    parsedAmount.success &&
    debit !== "" &&
    credit !== "" &&
    description.trim() !== "" &&
    date !== "";

  function reset(): void {
    setDate(today);
    setAmount("");
    setDescription("");
    setDebit("");
    setCredit("");
    setError(null);
  }

  function submit(): void {
    setError(null);
    startTransition(async () => {
      try {
        const entry = await journalEntriesApi.create({
          date,
          description,
          lines: [
            { accountCode: debit, debit: typed, credit: "", memo: "" },
            { accountCode: credit, debit: "", credit: typed, memo: "" },
          ],
        });
        toast({ tone: "success", title: t("form.posted", { number: entry.number }) });
        setOpen(false);
        reset();
        router.push("/dashboard/accounting/journal");
        router.refresh();
      } catch (err) {
        setError(localizeApiError(err, tApiErrors, t("form.error")));
      }
    });
  }

  return (
    <>
      <Button size="control-md" type="button" variant="secondary" className="px-3" onClick={() => setOpen(true)}>
        {t("journal.newEntry")}
      </Button>
      <AccountingDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setError(null);
        }}
        title={t("quickEntry.title")}
        subtitle={t("quickEntry.sub")}
        submitLabel={t("form.post")}
        blocked={!ready}
        pending={pending}
        onSubmit={submit}
        preview={
          ready && parsedAmount.success
            ? t("quickEntry.preview", {
                debit: nameOf(debit),
                credit: nameOf(credit),
                amount: formatMoney(parsedAmount.data, locale),
              })
            : undefined
        }
        error={fieldError ?? error}
        fullForm={{
          prompt: t("quickEntry.fullFormPrompt"),
          label: t("quickEntry.fullFormLink"),
          href: "/dashboard/accounting/journal/new",
        }}
      >
        <div className="grid grid-cols-2 gap-4">
          <label className={FIELD}>
            {t("form.dateLabel")}
            <Input
              size="control-md"
              type="date"
              value={date}
              max={today}
              onChange={(event) => setDate(event.target.value)}
              dir="ltr"
            />
          </label>
          <label className={FIELD}>
            {t("quickEntry.amountLabel")}
            <Input
              size="control-md"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="numeric"
              autoComplete="off"
              placeholder="0"
              dir="ltr"
            />
          </label>
        </div>
        <label className={FIELD}>
          {t("form.descriptionLabel")}
          <Input
            size="control-md"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            autoComplete="off"
            maxLength={200}
            placeholder={t("quickEntry.descriptionPlaceholder")}
            dir="auto"
          />
        </label>
        <label className={FIELD}>
          {t("form.debitLabel")}
          <Select size="control-md" value={debit} onChange={(event) => setDebit(event.target.value)}>
            <option value="">{t("form.accountPlaceholder")}</option>
            {active.map((account) => (
              <option key={account.code} value={account.code}>
                {accountLabel(account, locale)}
              </option>
            ))}
          </Select>
        </label>
        <label className={FIELD}>
          {t("form.creditLabel")}
          <Select size="control-md" value={credit} onChange={(event) => setCredit(event.target.value)}>
            <option value="">{t("form.accountPlaceholder")}</option>
            {active.map((account) => (
              <option key={account.code} value={account.code}>
                {accountLabel(account, locale)}
              </option>
            ))}
          </Select>
        </label>
      </AccountingDialog>
    </>
  );
}
