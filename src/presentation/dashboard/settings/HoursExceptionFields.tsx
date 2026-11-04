"use client";

import { useTranslations } from "next-intl";
import { Controller, useWatch, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";

import type { OpeningHoursFormInput } from "@/src/contracts/cafe-settings-schema";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";

import { DashboardFormField } from "../DashboardFormField";
import { FIELD_INPUT } from "../fieldStyles";
import { RemoveLineButton } from "../RemoveLineButton";

import { ClosedCheckbox } from "./ClosedCheckbox";

type HoursExceptionFieldsProps = {
  index: number;
  control: Control<OpeningHoursFormInput>;
  register: UseFormRegister<OpeningHoursFormInput>;
  errors: FieldErrors<OpeningHoursFormInput>;
  onRemove: () => void;
};

/**
 * One special day on the hours form: its date, closed or its own hours, and why
 * (for guests, in both languages).
 */
export function HoursExceptionFields({ index, control, register, errors, onRemove }: HoursExceptionFieldsProps) {
  const t = useTranslations("dashSettings");
  const tFormErrors = useTranslations("formErrors");
  const fieldError = (message?: string): string | undefined => formErrorMessage(tFormErrors, message);
  const closed = useWatch({ control, name: `exceptions.${index}.closed` });
  const date = useWatch({ control, name: `exceptions.${index}.date` });
  const rowErrors = errors.exceptions?.[index];

  return (
    <li className="flex flex-col gap-3 border-t border-border pt-4 first:border-t-0 first:pt-0">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
        <DashboardFormField label={t("hours.date")} required error={fieldError(rowErrors?.date?.message)}>
          {(wiring) => (
            <Input
              {...wiring}
              {...register(`exceptions.${index}.date`)}
              size="control-md"
              inputClassName={FIELD_INPUT}
              type="date"
              dir="ltr"
              className="max-w-56"
            />
          )}
        </DashboardFormField>
        <RemoveLineButton label={t("hours.removeSpecialDay", { date: date || "—" })} onClick={onRemove} />
      </div>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <Controller
          control={control}
          name={`exceptions.${index}.closed`}
          render={({ field }) => (
            <ClosedCheckbox
              label={t("hours.closed")}
              ariaLabel={t("hours.closedOn", { day: date || t("hours.thisDay") })}
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
        {closed ? null : (
          <>
            <DashboardFormField label={t("hours.opens")} error={fieldError(rowErrors?.opens?.message)}>
              {(wiring) => (
                <Input
                  {...wiring}
                  {...register(`exceptions.${index}.opens`)}
                  size="control-md"
                  inputClassName={FIELD_INPUT}
                  type="time"
                  dir="ltr"
                  className="w-32"
                />
              )}
            </DashboardFormField>
            <DashboardFormField label={t("hours.closes")} error={fieldError(rowErrors?.closes?.message)}>
              {(wiring) => (
                <Input
                  {...wiring}
                  {...register(`exceptions.${index}.closes`)}
                  size="control-md"
                  inputClassName={FIELD_INPUT}
                  type="time"
                  dir="ltr"
                  className="w-32"
                />
              )}
            </DashboardFormField>
          </>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <DashboardFormField label={t("hours.noteEn")} error={fieldError(rowErrors?.note?.message)}>
          {(wiring) => (
            <Input
              {...wiring}
              {...register(`exceptions.${index}.note`)}
              size="control-md"
              inputClassName={FIELD_INPUT}
              dir="auto"
              placeholder={t("hours.notePlaceholder")}
            />
          )}
        </DashboardFormField>
        <DashboardFormField label={t("hours.noteFa")} error={fieldError(rowErrors?.noteFa?.message)}>
          {(wiring) => (
            <Input
              {...wiring}
              {...register(`exceptions.${index}.noteFa`)}
              size="control-md"
              inputClassName={FIELD_INPUT}
              dir="rtl"
            />
          )}
        </DashboardFormField>
      </div>
    </li>
  );
}
