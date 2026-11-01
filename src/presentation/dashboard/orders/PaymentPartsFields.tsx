"use client";

import { useLocale, useTranslations } from "next-intl";

import { COUNTER_PAYMENT_METHODS } from "@/src/domain/entities/Order";
import { formatMoney } from "@/src/lib/formatMoney";
import { cn } from "@/src/lib/utils";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";

import { DashboardField } from "../DashboardField";
import { FIELD_HINT } from "../fieldStyles";
import { AMOUNT_INPUT } from "../pageStyles";

import { splitParts, splitRemainder, type SplitAmounts } from "./paymentParts";

type PaymentPartsFieldsProps = {
  total: number;
  amounts: SplitAmounts;
  onChange: (amounts: SplitAmounts) => void;
  disabled?: boolean;
};

/** A split bill: how much went on each method, and how far that is from the total. */
export function PaymentPartsFields({ total, amounts, onChange, disabled = false }: PaymentPartsFieldsProps) {
  const t = useTranslations("dashOrders");
  const locale = useLocale();
  const remainder = splitRemainder(splitParts(amounts), total);

  return (
    <div className="flex flex-col gap-3">
      {/* A long method name can wrap to two lines: the inputs still sit on one. */}
      <div className="grid grid-cols-3 items-end gap-2">
        {COUNTER_PAYMENT_METHODS.map((method) => (
          <DashboardField key={method} label={t(`paymentMethod.${method}`)}>
            <Input
              size="control-md"
              value={amounts[method] ?? ""}
              onChange={(event) => onChange({ ...amounts, [method]: event.target.value })}
              inputClassName={AMOUNT_INPUT}
              autoComplete="off"
              inputMode="numeric"
              placeholder="0"
              dir="ltr"
              disabled={disabled}
            />
          </DashboardField>
        ))}
      </div>
      <p className={cn(FIELD_HINT, remainder !== 0 && "text-warning-foreground")}>
        {remainder === 0
          ? t("splitAddsUp")
          : remainder > 0
            ? t("splitRemaining", { amount: formatMoney(remainder, locale) })
            : t("splitOver", { amount: formatMoney(-remainder, locale) })}
      </p>
    </div>
  );
}
