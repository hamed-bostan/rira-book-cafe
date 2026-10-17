"use client";

import { Plus, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { useFieldArray, useWatch, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";

import type { StatementLineFormInput } from "@/src/contracts/bank-schema";
import { formatMoney } from "@/src/lib/formatMoney";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { Button, FormMessage, Icon, Input, Textarea } from "@/src/presentation/design-system";

import { parseStatementAmount, parseStatementCsv } from "./parseStatementCsv";

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
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-2 text-body-small-emphasis text-input-foreground">{t("lines.label")}</legend>

      <div className="flex flex-col gap-2 rounded-card-md border border-dashed border-border p-3">
        <label className="flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
          {t("lines.pasteLabel")}
          <Textarea value={pasted} onChange={(event) => setPasted(event.target.value)} rows={4} dir="ltr" placeholder={t("lines.pastePlaceholder")} />
        </label>
        <p className="text-body-caption text-muted-foreground">{t("lines.pasteHint")}</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" size="sm" variant="outline" disabled={!pasted.trim()} onClick={importPasted}>
            {t("lines.import")}
          </Button>
          {readout ? <span className="text-body-caption text-muted-foreground" aria-live="polite">{readout}</span> : null}
        </div>
      </div>

      {fields.map((field, index) => {
        const lineErrors = errors.lines?.[index];
        const amount = parseStatementAmount(lines[index]?.amount ?? "");
        return (
          <div
            key={field.id}
            className="grid grid-cols-2 gap-2 rounded-card-md border border-border p-3 md:grid-cols-[9.5rem_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-start md:border-0 md:p-0"
          >
            <div className="flex flex-col gap-1">
              <Input {...register(`lines.${index}.date`)} type="date" aria-label={t("lines.date")} className="h-10" dir="ltr" />
              {lineErrors?.date?.message ? <FormMessage>{fieldError(lineErrors.date.message)}</FormMessage> : null}
            </div>
            <div className="col-span-2 flex flex-col gap-1 md:col-span-1">
              <Input {...register(`lines.${index}.description`)} placeholder={t("lines.description")} aria-label={t("lines.description")} className="h-10" dir="auto" />
              {lineErrors?.description?.message ? <FormMessage>{fieldError(lineErrors.description.message)}</FormMessage> : null}
            </div>
            <Input {...register(`lines.${index}.reference`)} placeholder={t("lines.reference")} aria-label={t("lines.reference")} className="h-10" dir="ltr" />
            <div className="flex flex-col gap-1">
              <Input
                {...register(`lines.${index}.amount`)}
                inputMode="numeric"
                placeholder={t("lines.amount")}
                aria-label={t("lines.amount")}
                className={amount !== null && amount < 0 ? "h-10 text-error-foreground" : "h-10"}
                dir="ltr"
              />
              {lineErrors?.amount?.message ? <FormMessage>{fieldError(lineErrors.amount.message)}</FormMessage> : null}
            </div>
            <Button type="button" variant="ghost" size="sm" className="h-10 justify-self-end" onClick={() => remove(index)} aria-label={t("lines.remove")}>
              <Icon icon={X} size="sm" />
            </Button>
          </div>
        );
      })}

      {linesError ? <FormMessage>{fieldError(linesError)}</FormMessage> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" size="sm" onClick={() => append({ date: defaultDay, description: "", reference: "", amount: "" })}>
          <Icon icon={Plus} size="sm" className="me-1.5" />
          {t("lines.add")}
        </Button>
        <span className="text-body-small text-muted-foreground">
          {t("lines.total", { count: fields.length, amount: formatMoney(linesTotal(lines), locale) })}
        </span>
      </div>
    </fieldset>
  );
}
