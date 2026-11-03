"use client";

import { useLocale, useTranslations } from "next-intl";

import { LOAN_DEPOSIT_METHODS, MAX_LOAN_NOTE_LENGTH, type LoanDepositMethod } from "@/src/domain/entities/BookLoan";
import { formatCafeDayLong } from "@/src/lib/formatCafeDay";
import { formatNumber } from "@/src/lib/formatNumber";
import { OverviewSegmented } from "@/src/presentation/dashboard/overview/OverviewSegmented";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Select } from "@/src/presentation/design-system/components/form/Select/Select";

import { DashboardField } from "../DashboardField";
import { FIELD_GRID, FIELD_HINT, FIELD_LABEL } from "../fieldStyles";

import { LOAN_LENGTHS, type LoanTermsState } from "./useLoanTerms";

type LoanTermsFieldsProps = {
  terms: LoanTermsState;
};

/**
 * A loan's terms in a lending dialog: how long it runs (7, 14 or 21 days, with the
 * day that makes it due), an optional deposit — asking where it was paid into once
 * there is one — and a note. State lives in `useLoanTerms`.
 */
export function LoanTermsFields({ terms }: LoanTermsFieldsProps) {
  const t = useTranslations("dashBookLoans");
  const locale = useLocale();

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <span className={FIELD_LABEL}>{t("dueBack")}</span>
        <OverviewSegmented
          label={t("loanLength")}
          value={terms.length}
          onChange={terms.setLength}
          fill
          options={LOAN_LENGTHS.map((value) => ({
            value,
            label: t("days", { count: Number(value), formatted: formatNumber(Number(value), locale) }),
          }))}
        />
        <span className={FIELD_HINT}>{t("dueOnDay", { date: formatCafeDayLong(terms.dueOn, locale) })}</span>
      </div>
      <div className={FIELD_GRID}>
        <DashboardField label={t("depositLabel")} hint={t("depositHint")}>
          <Input
            size="control-md"
            value={terms.depositAmount}
            onChange={(event) => terms.setDepositAmount(event.target.value)}
            autoComplete="off"
            inputMode="numeric"
            placeholder="0"
            dir="ltr"
          />
        </DashboardField>
        {terms.depositAmount.trim() ? (
          <DashboardField label={t("depositMethodLabel")}>
            <Select
              size="control-md"
              value={terms.depositMethod}
              onChange={(event) => terms.setDepositMethod(event.target.value as LoanDepositMethod)}
            >
              {LOAN_DEPOSIT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {t(`depositMethod.${method}`)}
                </option>
              ))}
            </Select>
          </DashboardField>
        ) : null}
      </div>
      <DashboardField label={t("note")}>
        <Input
          size="control-md"
          value={terms.note}
          onChange={(event) => terms.setNote(event.target.value)}
          maxLength={MAX_LOAN_NOTE_LENGTH}
          placeholder={t("notePlaceholder")}
          autoComplete="off"
        />
      </DashboardField>
    </>
  );
}
