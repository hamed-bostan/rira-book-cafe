"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { INCOME_METHODS, type IncomeMethod } from "@/src/domain/entities/Income";
import { formatMoney } from "@/src/lib/formatMoney";
import { Checkbox } from "@/src/presentation/design-system/components/Checkbox/Checkbox";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Select } from "@/src/presentation/design-system/components/form/Select/Select";

import { DashboardField } from "../DashboardField";
import { FIELD_ERROR, FIELD_GRID, FIELD_HINT, FIELD_LABEL } from "../fieldStyles";

import type { RefundOfferState } from "./useRefundOffer";

/**
 * Inside a cancel dialog for a paid booking: "Refund the guest now", and once
 * ticked, how much (all that's left, to start) and how it goes back.
 */
export function RefundOfferFields({ state }: { state: RefundOfferState }) {
  const t = useTranslations("dashIncome");
  const locale = useLocale();
  const id = React.useId();

  return (
    <div className="flex flex-col gap-4 rounded-button border border-border p-4">
      {/* The whole row is the target: 44px tall on a phone. */}
      <label htmlFor={id} className="-my-2 flex min-h-11 cursor-pointer items-center gap-3 sm:min-h-0">
        <Checkbox id={id} checked={state.checked} onCheckedChange={(checked) => state.setChecked(checked === true)} />
        <span className="flex flex-col">
          <span className={FIELD_LABEL}>{t("refund.offerLabel")}</span>
          <span className={FIELD_HINT}>{t("refund.offerHint", { left: formatMoney(state.offer.left, locale) })}</span>
        </span>
      </label>
      {state.checked ? (
        <div className={FIELD_GRID}>
          <DashboardField label={t("refund.amountLabel")}>
            <Input
              size="control-md"
              value={state.amount}
              onChange={(event) => state.setAmount(event.target.value)}
              autoComplete="off"
              inputMode="numeric"
              dir="ltr"
            />
          </DashboardField>
          <DashboardField label={t("refund.methodLabel")}>
            <Select
              size="control-md"
              value={state.method}
              onChange={(event) => state.setMethod(event.target.value as IncomeMethod)}
            >
              {INCOME_METHODS.map((option) => (
                <option key={option} value={option}>
                  {t(`method.${option}`)}
                </option>
              ))}
            </Select>
          </DashboardField>
        </div>
      ) : null}
      {state.fieldError ? (
        <p role="alert" className={FIELD_ERROR}>
          {state.fieldError}
        </p>
      ) : null}
    </div>
  );
}
