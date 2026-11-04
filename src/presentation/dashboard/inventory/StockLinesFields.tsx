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
import { formatStockQuantity } from "./stockFormat";

/** The item, its quantity and cost, and the remove button; on a phone the item takes its own row. */
const LINE_COLUMNS =
  "grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.75rem] sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.25rem] md:grid-cols-[minmax(0,2fr)_9rem_10rem_2.25rem]";

/**
 * With packs: the item, the quantity and the unit it's typed in, the cost and what
 * it's for, and the remove button. On a phone and a tablet the item takes its own
 * row and the four fields pair up under it; a laptop's card holds them in one row.
 */
const PACK_COLUMNS = "grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,2fr)_7rem_8rem_9rem_8rem_2.25rem]";

/** The shape both the delivery and the opening-stock forms share; packs are the delivery's. */
export type StockLinesForm = {
  lines: { ingredientId: string; quantity: string; cost: string; unit?: string; costPer?: "line" | "unit" }[];
};

type StockLinesFieldsProps = {
  control: Control<StockLinesForm>;
  register: UseFormRegister<StockLinesForm>;
  errors: FieldErrors<StockLinesForm>;
  items: StockItem[];
  costLabel: string;
  /** Lines may be typed in an item's purchase units, and costed per unit typed. */
  withPacks?: boolean;
};

const EMPTY = { ingredientId: "", quantity: "", cost: "" };
const EMPTY_WITH_PACKS = { ...EMPTY, unit: "", costPer: "line" as const };

const NUMBER = /^\d+(\.\d{1,3})?$/;
const WHOLE = /^\d+$/;

/** A line's cost for the whole line: per unit typed × quantity, or as typed. */
function lineTotal(line: StockLinesForm["lines"][number]): number {
  const cost = line.cost.trim();
  if (!WHOLE.test(cost)) return 0;
  if (line.costPer !== "unit") return Number(cost);
  const quantity = line.quantity.trim();
  return NUMBER.test(quantity) ? Math.round(Number(cost) * Number(quantity)) : 0;
}

/** Item, quantity and cost per line (in packs, for a delivery), with the running total. */
export function StockLinesFields({ control, register, errors, items, costLabel, withPacks }: StockLinesFieldsProps) {
  const t = useTranslations("dashInventory");
  const tFormErrors = useTranslations("formErrors");
  const fieldError = (message?: string): string | undefined => formErrorMessage(tFormErrors, message);
  const locale = useLocale();
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });
  const lines = useWatch({ control, name: "lines" });
  const byId = new Map(items.map((item) => [item.id, item]));
  const total = lines.reduce((sum, line) => sum + lineTotal(line), 0);
  const linesError = errors.lines?.root?.message ?? errors.lines?.message;
  const columns = withPacks ? PACK_COLUMNS : LINE_COLUMNS;

  return (
    <fieldset className="flex min-w-0 flex-col gap-3">
      <legend className={cn(FIELD_LABEL, "mb-3")}>{t("lines.label")}</legend>
      {linesError ? <FormMessage>{fieldError(linesError)}</FormMessage> : null}
      <div aria-hidden className={cn(LINE_HEAD, "hidden gap-x-3", withPacks ? "lg:grid" : "md:grid", columns)}>
        <span>{t("lines.item")}</span>
        <span className="text-end">{t("lines.quantity")}</span>
        {withPacks ? <span>{t("packs.unitLabel")}</span> : null}
        <span className="text-end">{costLabel}</span>
        {withPacks ? <span>{t("packs.costPerLabel")}</span> : null}
        <span />
      </div>
      {fields.map((field, index) => {
        const line = lines[index];
        const item = byId.get(line?.ingredientId ?? "");
        const lineErrors = errors.lines?.[index];
        const packs = item?.purchaseUnits ?? [];
        const unit = item ? t(`unit.${item.unit}`) : "";
        const typedUnit = line?.unit || unit;
        return (
          <div key={field.id} className={cn(LINE_ROW, columns)}>
            <div
              className={cn("col-span-full flex min-w-0 flex-col gap-1", withPacks ? "lg:col-span-1" : "md:col-span-1")}
            >
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
                  inputClassName={cn(FIELD_INPUT, AMOUNT_INPUT, withPacks ? undefined : UNIT_INSIDE)}
                  dir="ltr"
                />
                {withPacks ? null : (
                  <span aria-hidden className={UNIT_SUFFIX}>
                    {unit}
                  </span>
                )}
              </div>
              {lineErrors?.quantity?.message ? (
                <FormMessage>{fieldError(lineErrors.quantity.message)}</FormMessage>
              ) : null}
            </div>
            {withPacks ? (
              // Without packs the base unit is the only choice, shown and not chosen.
              <Select
                {...register(`lines.${index}.unit`)}
                size="control-md"
                aria-label={t("packs.unitLabel")}
                className="border-border-strong"
                disabled={packs.length === 0}
              >
                <option value="">{unit || t("packs.baseUnit")}</option>
                {packs.map((option) => (
                  <option key={option.name} value={option.name}>
                    {t("packs.option", {
                      name: option.name,
                      quantity: formatStockQuantity(option.factor, locale),
                      unit,
                    })}
                  </option>
                ))}
              </Select>
            ) : null}
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
            {withPacks ? (
              <Select
                {...register(`lines.${index}.costPer`)}
                size="control-md"
                aria-label={t("packs.costPerLabel")}
                className="border-border-strong"
              >
                <option value="line">{t("packs.costPer.line")}</option>
                <option value="unit">{t("packs.costPer.unit", { unit: typedUnit || t("packs.baseUnit") })}</option>
              </Select>
            ) : null}
            {withPacks ? (
              // Its own row under the fields until a laptop's card holds them all in one.
              <div className="col-span-full flex justify-end lg:col-span-1">
                <RemoveLineButton
                  label={t("lines.remove")}
                  onClick={() => remove(index)}
                  disabled={fields.length <= 1}
                />
              </div>
            ) : (
              <RemoveLineButton label={t("lines.remove")} onClick={() => remove(index)} disabled={fields.length <= 1} />
            )}
          </div>
        );
      })}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="secondary"
          size="control-md"
          className="px-3"
          onClick={() => append(withPacks ? EMPTY_WITH_PACKS : EMPTY)}
        >
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
