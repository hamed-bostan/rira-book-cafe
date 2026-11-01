"use client";

import { Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { useFieldArray, useWatch, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";

import type { StatementLineFormInput } from "@/src/contracts/bank-schema";
import { formatNumber } from "@/src/lib/formatNumber";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { cn } from "@/src/lib/utils";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { FormMessage } from "@/src/presentation/design-system/components/form/FormMessage/FormMessage";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Textarea } from "@/src/presentation/design-system/components/form/Textarea/Textarea";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { DashboardField } from "../DashboardField";
import { FIELD_INPUT, FIELD_LABEL, FIELD_TEXTAREA } from "../fieldStyles";
import { AMOUNT_INPUT, LINE_HEAD, LINE_ROW, ROW_TEXT } from "../pageStyles";
import { RemoveLineButton } from "../RemoveLineButton";

import { parseStatementAmount, parseStatementCsv } from "./parseStatementCsv";

/** Date, description, reference, amount and the remove button; on a phone the description takes its own row. */
const LINE_COLUMNS =
  "grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.75rem] sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.25rem] md:grid-cols-[9rem_minmax(0,2fr)_minmax(0,1fr)_9rem_2.25rem]";

/** The shape both the new-statement and add-lines forms share. */
export type StatementLinesForm = { lines: StatementLineFormInput[] };

type StatementLinesFieldsProps = {
  control: Control<StatementLinesForm>;
  register: UseFormRegister<StatementLinesForm>;
  errors: FieldErrors<StatementLinesForm>;
  /** The day a typed line starts on. */
  defaultDay: string;
};

/** Sum of the typed amounts that read as numbers. */
export function linesTotal(lines: readonly StatementLineFormInput[]): number {
  return lines.reduce((sum, line) => sum + (parseStatementAmount(line.amount) ?? 0), 0);
}

/**
 * Statement lines, typed one by one or pasted from the bank's export. Pasted rows
 * are read in the browser and added as ordinary lines, so they can be checked and
 * corrected before anything is saved; rows that couldn't be read are named.
 */
export function StatementLinesFields({ control, register, errors, defaultDay }: StatementLinesFieldsProps) {
  const t = useTranslations("dashBank");
  const tFormErrors = useTranslations("formErrors");
  const fieldError = (message?: string): string | undefined => formErrorMessage(tFormErrors, message);
  const locale = useLocale();
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });
  const lines = useWatch({ control, name: "lines" });
  const [pasted, setPasted] = React.useState("");
  const [readout, setReadout] = React.useState<string | null>(null);
  const linesError = errors.lines?.root?.message ?? errors.lines?.message;

  function importPasted(): void {
    const { lines: parsed, skippedRows } = parseStatementCsv(pasted);
    if (parsed.length > 0) append(parsed);
    setPasted("");
    setReadout(
      skippedRows.length > 0
        ? t("lines.importedSkipped", { count: parsed.length, rows: skippedRows.slice(0, 10).join(", ") })
        : t("lines.imported", { count: parsed.length }),
    );
  }

  return (
    <fieldset className="flex min-w-0 flex-col gap-3">
      <legend className={cn(FIELD_LABEL, "mb-3")}>{t("lines.label")}</legend>
      {linesError ? <FormMessage>{fieldError(linesError)}</FormMessage> : null}

      <div className="flex flex-col gap-2 rounded-card-lg bg-muted p-4">
        <DashboardField label={t("lines.pasteLabel")} hint={t("lines.pasteHint")}>
          <Textarea
            value={pasted}
            onChange={(event) => setPasted(event.target.value)}
            rows={3}
            dir="ltr"
            placeholder={t("lines.pastePlaceholder")}
            className={FIELD_TEXTAREA}
          />
        </DashboardField>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            size="control-md"
            className="px-3"
            disabled={!pasted.trim()}
            onClick={importPasted}
          >
            {t("lines.import")}
          </Button>
          {readout ? (
            <span className={cn(ROW_TEXT, "text-foreground/80")} aria-live="polite">
              {readout}
            </span>
          ) : null}
        </div>
      </div>

      {fields.length > 0 ? (
        <div aria-hidden className={cn(LINE_HEAD, "hidden gap-x-3 md:grid", LINE_COLUMNS)}>
          <span>{t("lines.date")}</span>
          <span>{t("lines.description")}</span>
          <span>{t("lines.reference")}</span>
          <span className="text-end">{t("lines.amount")}</span>
          <span />
        </div>
      ) : null}
      {fields.map((field, index) => {
        const lineErrors = errors.lines?.[index];
        const amount = parseStatementAmount(lines[index]?.amount ?? "");
        return (
          <div key={field.id} className={cn(LINE_ROW, LINE_COLUMNS)}>
            <div className="flex min-w-0 flex-col gap-1">
              <Input
                {...register(`lines.${index}.date`)}
                size="control-md"
                type="date"
                aria-label={t("lines.date")}
                inputClassName={FIELD_INPUT}
                dir="ltr"
              />
              {lineErrors?.date?.message ? <FormMessage>{fieldError(lineErrors.date.message)}</FormMessage> : null}
            </div>
            <div className="col-span-full flex min-w-0 flex-col gap-1 md:col-span-1">
              <Input
                {...register(`lines.${index}.description`)}
                size="control-md"
                placeholder={t("lines.description")}
                aria-label={t("lines.description")}
                inputClassName={FIELD_INPUT}
                dir="auto"
              />
              {lineErrors?.description?.message ? (
                <FormMessage>{fieldError(lineErrors.description.message)}</FormMessage>
              ) : null}
            </div>
            <Input
              {...register(`lines.${index}.reference`)}
              size="control-md"
              placeholder={t("lines.reference")}
              aria-label={t("lines.reference")}
              inputClassName={FIELD_INPUT}
              dir="ltr"
            />
            <div className="flex min-w-0 flex-col gap-1">
              <Input
                {...register(`lines.${index}.amount`)}
                size="control-md"
                inputMode="numeric"
                placeholder={t("lines.amount")}
                aria-label={t("lines.amount")}
                inputClassName={cn(FIELD_INPUT, AMOUNT_INPUT, amount !== null && amount < 0 && "text-error-foreground")}
                dir="ltr"
              />
              {lineErrors?.amount?.message ? <FormMessage>{fieldError(lineErrors.amount.message)}</FormMessage> : null}
            </div>
            <RemoveLineButton label={t("lines.remove")} onClick={() => remove(index)} />
          </div>
        );
      })}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="secondary"
          size="control-md"
          className="px-3"
          onClick={() => append({ date: defaultDay, description: "", reference: "", amount: "" })}
        >
          <Icon icon={Plus} size="icon-md" className="me-2" />
          {t("lines.add")}
        </Button>
        <span className={cn(ROW_TEXT, "whitespace-nowrap text-foreground/80 tabular-nums")}>
          {t("lines.total", { count: fields.length, amount: formatNumber(linesTotal(lines), locale) })}
        </span>
      </div>
    </fieldset>
  );
}
