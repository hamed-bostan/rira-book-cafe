"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";

import { openingHoursSchema, type OpeningHoursFormInput } from "@/src/contracts/cafe-settings-schema";
import {
  MAX_HOURS_EXCEPTIONS,
  WEEKDAYS,
  type DayHours,
  type OpeningHours,
  type Weekday,
} from "@/src/domain/entities/CafeSettings";
import { useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { DashboardFormField } from "@/src/presentation/dashboard/DashboardFormField";
import { DashboardSection } from "@/src/presentation/dashboard/DashboardSection";
import { FIELD_HINT, FIELD_INPUT, FIELD_LABEL, OVERLINE } from "@/src/presentation/dashboard/fieldStyles";
import { FormAlert } from "@/src/presentation/dashboard/FormAlert";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { cafeSettingsApi } from "./cafe-settings-api";
import { ClosedCheckbox } from "./ClosedCheckbox";
import { HoursExceptionFields } from "./HoursExceptionFields";

/** What a day starts as before the week has ever been set: open, at hours a cafe keeps. */
const STARTING_HOURS = { closed: false, opens: "08:00", closes: "22:00" };

function dayDefaults(hours: DayHours | undefined): { closed: boolean; opens: string; closes: string } {
  if (!hours) return STARTING_HOURS;
  return { closed: hours.closed, opens: hours.opens ?? "", closes: hours.closes ?? "" };
}

function toDefaults(hours: OpeningHours): OpeningHoursFormInput {
  return {
    weekly: Object.fromEntries(WEEKDAYS.map((day) => [day, dayDefaults(hours.weekly?.[day])])) as Record<
      Weekday,
      ReturnType<typeof dayDefaults>
    >,
    exceptions: hours.exceptions.map((exception) => ({
      date: exception.date,
      ...dayDefaults(exception),
      note: exception.note ?? "",
      noteFa: exception.noteFa ?? "",
    })),
  };
}

/**
 * When the cafe is open: each day of the week from Saturday, closed or open from
 * one time to another (a close before the open runs past midnight), and the
 * special days that differ — a holiday closed, a late night. The site shows them,
 * and the basket tells a guest when the cafe is closed; nothing is refused because
 * of them (table bookings take any hour, as before). Times are Tehran time.
 */
export function OpeningHoursForm({ hours, today }: { hours: OpeningHours; today: string }) {
  const t = useTranslations("dashSettings");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const fieldError = (message?: string): string | undefined => formErrorMessage(tFormErrors, message);
  const router = useRouter();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    control,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<OpeningHoursFormInput>({
    resolver: zodResolver(openingHoursSchema, undefined, { raw: true }),
    defaultValues: toDefaults(hours),
  });
  const exceptions = useFieldArray({ control, name: "exceptions" });
  const weekly = useWatch({ control, name: "weekly" });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const saved = await cafeSettingsApi.updateHours(values);
      reset(toDefaults(saved.hours));
      toast({ tone: "success", title: t("hours.saved") });
      router.refresh();
    } catch (error) {
      // The form checks the same rules first, so a refusal here is rare; it's shown
      // above the button, in the field's words when the server names one.
      const [fieldMessage] = error instanceof ApiError ? Object.values(error.fieldErrors ?? {}) : [];
      setError("root", {
        message: fieldMessage
          ? (fieldError(fieldMessage) ?? fieldMessage)
          : localizeApiError(error, tApiErrors, t("saveError")),
      });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate aria-label={t("hours.heading")}>
      <DashboardSection title={t("hours.heading")} description={t("hours.description")}>
        {hours.weekly ? null : <p className={FIELD_HINT}>{t("hours.notSetYet")}</p>}

        <ul className="flex flex-col divide-y divide-border" aria-label={t("hours.week")}>
          {WEEKDAYS.map((day) => {
            const closed = weekly?.[day]?.closed ?? false;
            const dayErrors = errors.weekly?.[day];
            return (
              <li
                key={day}
                className="grid grid-cols-1 items-end gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[7rem_auto_minmax(0,1fr)]"
              >
                <span className={`${FIELD_LABEL} sm:self-center`}>{t(`weekday.${day}`)}</span>
                <Controller
                  control={control}
                  name={`weekly.${day}.closed`}
                  render={({ field }) => (
                    <ClosedCheckbox
                      label={t("hours.closed")}
                      ariaLabel={t("hours.closedOn", { day: t(`weekday.${day}`) })}
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                {closed ? (
                  <span className={`${FIELD_HINT} sm:self-center`}>{t("hours.closedAllDay")}</span>
                ) : (
                  <div className="flex flex-wrap items-end gap-3">
                    <DashboardFormField label={t("hours.opens")} error={fieldError(dayErrors?.opens?.message)}>
                      {(wiring) => (
                        <Input
                          {...wiring}
                          {...register(`weekly.${day}.opens`)}
                          aria-label={t("hours.opensOn", { day: t(`weekday.${day}`) })}
                          size="control-md"
                          inputClassName={FIELD_INPUT}
                          type="time"
                          dir="ltr"
                          className="w-32"
                        />
                      )}
                    </DashboardFormField>
                    <DashboardFormField label={t("hours.closes")} error={fieldError(dayErrors?.closes?.message)}>
                      {(wiring) => (
                        <Input
                          {...wiring}
                          {...register(`weekly.${day}.closes`)}
                          aria-label={t("hours.closesOn", { day: t(`weekday.${day}`) })}
                          size="control-md"
                          inputClassName={FIELD_INPUT}
                          type="time"
                          dir="ltr"
                          className="w-32"
                        />
                      )}
                    </DashboardFormField>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <p className={FIELD_HINT}>{t("hours.pastMidnightHint")}</p>

        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <div className="flex flex-col gap-0.5">
            <p className={OVERLINE}>{t("hours.specialDays")}</p>
            <p className={FIELD_HINT}>{t("hours.specialDaysHint")}</p>
          </div>
          {exceptions.fields.length > 0 ? (
            <ul className="flex flex-col gap-4">
              {exceptions.fields.map((field, index) => (
                <HoursExceptionFields
                  key={field.id}
                  index={index}
                  control={control}
                  register={register}
                  errors={errors}
                  onRemove={() => exceptions.remove(index)}
                />
              ))}
            </ul>
          ) : null}
          {errors.exceptions?.message ? (
            <p className="text-body-small font-medium text-error-foreground sm:text-body-caption">
              {fieldError(errors.exceptions.message)}
            </p>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            size="control-md"
            className="w-fit gap-2 px-3"
            disabled={exceptions.fields.length >= MAX_HOURS_EXCEPTIONS}
            onClick={() =>
              exceptions.append({ date: today, closed: true, opens: "", closes: "", note: "", noteFa: "" })
            }
          >
            <Icon icon={Plus} size="icon-md" />
            {t("hours.addSpecialDay")}
          </Button>
        </div>

        {errors.root?.message ? <FormAlert>{errors.root.message}</FormAlert> : null}
        <Button
          type="submit"
          size="control-md"
          className="w-fit px-4"
          loading={isSubmitting}
          disabled={!isDirty && hours.weekly !== null}
        >
          {t("hours.save")}
        </Button>
      </DashboardSection>
    </form>
  );
}
