"use client";

import { Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useFieldArray, useWatch, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";

import type { StockItem } from "@/src/domain/entities/Inventory";
import { formatMoney } from "@/src/lib/formatMoney";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { cn } from "@/src/lib/utils";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { FormMessage } from "@/src/presentation/design-system/components/form/FormMessage/FormMessage";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Select } from "@/src/presentation/design-system/components/form/Select/Select";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { FIELD_INPUT, FIELD_LABEL } from "../fieldStyles";
import { AMOUNT_INPUT, LINE_HEAD, LINE_ROW, ROW_TEXT } from "../pageStyles";
import { RemoveLineButton } from "../RemoveLineButton";

import { UNIT_INSIDE, UNIT_SUFFIX } from "./stockFieldStyles";

/** The item, its quantity and cost, and the remove button; on a phone the item takes its own row. */
const LINE_COLUMNS =
  "grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.75rem] sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.25rem] md:grid-cols-[minmax(0,2fr)_9rem_10rem_2.25rem]";

/** The shape both the delivery and the opening-stock forms share. */
export type StockLinesForm = { lines: { ingredientId: string; quantity: string; cost: string }[] };

type StockLinesFieldsProps = {
  control: Control<StockLinesForm>;
  register: UseFormRegister<StockLinesForm>;
  errors: FieldErrors<StockLinesForm>;
  items: StockItem[];
  costLabel: string;
};

const EMPTY = { ingredientId: "", quantity: "", cost: "" };

/** Item, quantity and cost per line, with the running total. */
export function StockLinesFields({ control, register, errors, items, costLabel }: StockLinesFieldsProps) {
  const t = useTranslations("dashInventory");
  const tFormErrors = useTranslations("formErrors");
  const fieldError = (message?: string): string | undefined => formErrorMessage(tFormErrors, message);
  const locale = useLocale();
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });
  const lines = useWatch({ control, name: "lines" });
  const byId = new Map(items.map((item) => [item.id, item]));
  const total = lines.reduce((sum, line) => sum + (/^\d+$/.test(line.cost.trim()) ? Number(line.cost) : 0), 0);
  const linesError = errors.lines?.root?.message ?? errors.lines?.message;

  return (
    <fieldset className="flex min-w-0 flex-col gap-3">
      <legend className={cn(FIELD_LABEL, "mb-3")}>{t("lines.label")}</legend>
      {linesError ? <FormMessage>{fieldError(linesError)}</FormMessage> : null}
      <div aria-hidden className={cn(LINE_HEAD, "hidden gap-x-3 md:grid", LINE_COLUMNS)}>
        <span>{t("lines.item")}</span>
        <span className="text-end">{t("lines.quantity")}</span>
        <span className="text-end">{costLabel}</span>
        <span />
      </div>
      {fields.map((field, index) => {
        const item = byId.get(lines[index]?.ingredientId ?? "");
        const lineErrors = errors.lines?.[index];
        return (
          <div key={field.id} className={cn(LINE_ROW, LINE_COLUMNS)}>
            <div className="col-span-full flex min-w-0 flex-col gap-1 md:col-span-1">
              <Select
                {...register(`lines.${index}.ingredientId`)}
                size="control-md"
                aria-label={t("lines.item")}
                className="border-border-strong"
              >
                <option value="">{t("lines.itemPlaceholder")}</option>
                {items.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </Select>
              {lineErrors?.ingredientId?.message ? (
                <FormMessage>{fieldError(lineErrors.ingredientId.message)}</FormMessage>
              ) : null}
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <div className="relative">
                <Input
                  {...register(`lines.${index}.quantity`)}
                  size="control-md"
                  inputMode="decimal"
                  placeholder={t("lines.quantity")}
                  aria-label={t("lines.quantity")}
                  inputClassName={cn(FIELD_INPUT, AMOUNT_INPUT, UNIT_INSIDE)}
                  dir="ltr"
                />
                <span aria-hidden className={UNIT_SUFFIX}>
                  {item ? t(`unit.${item.unit}`) : ""}
                </span>
              </div>
              {lineErrors?.quantity?.message ? (
                <FormMessage>{fieldError(lineErrors.quantity.message)}</FormMessage>
              ) : null}
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <Input
                {...register(`lines.${index}.cost`)}
                size="control-md"
                inputMode="numeric"
                placeholder={costLabel}
                aria-label={costLabel}
                inputClassName={cn(FIELD_INPUT, AMOUNT_INPUT)}
                dir="ltr"
              />
              {lineErrors?.cost?.message ? <FormMessage>{fieldError(lineErrors.cost.message)}</FormMessage> : null}
            </div>
            <RemoveLineButton label={t("lines.remove")} onClick={() => remove(index)} disabled={fields.length <= 1} />
          </div>
        );
      })}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="secondary" size="control-md" className="px-3" onClick={() => append(EMPTY)}>
          <Icon icon={Plus} size="icon-md" className="me-2" />
          {t("lines.add")}
        </Button>
        <span className={cn(ROW_TEXT, "font-semibold whitespace-nowrap text-foreground tabular-nums")}>
          {t("lines.total", { total: formatMoney(total, locale) })}
        </span>
      </div>
    </fieldset>
  );
}
