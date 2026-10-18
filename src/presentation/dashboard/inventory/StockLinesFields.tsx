"use client";

import { Plus, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useFieldArray, useWatch, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";

import type { StockItem } from "@/src/domain/entities/Inventory";
import { formatMoney } from "@/src/lib/formatMoney";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { FormMessage } from "@/src/presentation/design-system/components/form/FormMessage/FormMessage";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Select } from "@/src/presentation/design-system/components/form/Select/Select";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

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
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-2 text-body-small-emphasis text-input-foreground">{t("lines.label")}</legend>
      {fields.map((field, index) => {
        const item = byId.get(lines[index]?.ingredientId ?? "");
        const lineErrors = errors.lines?.[index];
        return (
          <div
            key={field.id}
            className="grid grid-cols-2 gap-2 rounded-card-md border border-border p-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-start md:border-0 md:p-0"
          >
            <div className="col-span-2 flex flex-col gap-1 md:col-span-1">
              <Select {...register(`lines.${index}.ingredientId`)} aria-label={t("lines.item")} className="h-10">
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
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                <Input
                  {...register(`lines.${index}.quantity`)}
                  inputMode="decimal"
                  placeholder={t("lines.quantity")}
                  aria-label={t("lines.quantity")}
                  className="h-10"
                  dir="ltr"
                />
                <span className="text-body-caption text-muted-foreground">{item ? t(`unit.${item.unit}`) : ""}</span>
              </div>
              {lineErrors?.quantity?.message ? (
                <FormMessage>{fieldError(lineErrors.quantity.message)}</FormMessage>
              ) : null}
            </div>
            <div className="flex flex-col gap-1">
              <Input
                {...register(`lines.${index}.cost`)}
                inputMode="numeric"
                placeholder={costLabel}
                aria-label={costLabel}
                className="h-10"
                dir="ltr"
              />
              {lineErrors?.cost?.message ? <FormMessage>{fieldError(lineErrors.cost.message)}</FormMessage> : null}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-10 justify-self-end"
              onClick={() => remove(index)}
              disabled={fields.length <= 1}
              aria-label={t("lines.remove")}
            >
              <Icon icon={X} size="sm" />
            </Button>
          </div>
        );
      })}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" size="sm" onClick={() => append(EMPTY)}>
          <Icon icon={Plus} size="sm" className="me-1.5" />
          {t("lines.add")}
        </Button>
        <p className="text-body-small-emphasis text-foreground">
          {t("lines.total", { total: formatMoney(total, locale) })}
        </p>
      </div>
      {linesError ? <FormMessage>{fieldError(linesError)}</FormMessage> : null}
    </fieldset>
  );
}
