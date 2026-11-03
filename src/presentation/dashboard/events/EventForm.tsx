"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

import { eventFormSchema, type EventFormInput } from "@/src/contracts/event-schema";
import { EVENT_KINDS, type CafeEvent } from "@/src/domain/entities/CafeEvent";
import { dateToWallTime } from "@/src/domain/entities/CafeTime";
import { Link, useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { DashboardColumns } from "@/src/presentation/dashboard/DashboardColumns";
import { DashboardFormField } from "@/src/presentation/dashboard/DashboardFormField";
import { DashboardLanguageColumn } from "@/src/presentation/dashboard/DashboardLanguageColumn";
import { DashboardPageHeader } from "@/src/presentation/dashboard/DashboardPageHeader";
import { DashboardSection } from "@/src/presentation/dashboard/DashboardSection";
import { DashboardSwitchField } from "@/src/presentation/dashboard/DashboardSwitchField";
import {
  FIELD_GRID,
  FIELD_HINT,
  FIELD_INPUT,
  FIELD_LABEL,
  FIELD_TEXTAREA,
  LANGUAGE_GRID,
} from "@/src/presentation/dashboard/fieldStyles";
import { FormAlert } from "@/src/presentation/dashboard/FormAlert";
import { OverviewSegmented } from "@/src/presentation/dashboard/overview/OverviewSegmented";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Field } from "@/src/presentation/design-system/components/form/Field/Field";
import { FormMessage } from "@/src/presentation/design-system/components/form/FormMessage/FormMessage";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { RequiredMark } from "@/src/presentation/design-system/components/form/shared/RequiredMark";
import { Textarea } from "@/src/presentation/design-system/components/form/Textarea/Textarea";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { tableNameValues } from "../floor/tableName";

import { DeleteEventButton } from "./DeleteEventButton";
import { eventsApi } from "./event-api";
import { EventImageUpload } from "./EventImageUpload";

const FORM_FIELDS = [
  "kind",
  "title",
  "description",
  "titleFa",
  "descriptionFa",
  "imageUrl",
  "startsAt",
  "endsAt",
  "capacity",
  "price",
] as const satisfies readonly (keyof EventFormInput)[];

type EventFormProps =
  | { mode: "create" }
  | {
      mode: "edit";
      event: CafeEvent;
      /** Who has signed up, for the wide column. */
      guestList: React.ReactNode;
      /** The event's history, for the narrow column. */
      activity: React.ReactNode;
      /** "Cancel event", beside Delete — while there's something to call off. */
      cancelAction?: React.ReactNode;
    };

/** Form values from an event; times as cafe wall time for the `datetime-local` inputs. */
function toDefaults(event?: CafeEvent): EventFormInput {
  return {
    kind: event?.kind ?? "bookClub",
    title: event?.title ?? "",
    description: event?.description ?? "",
    titleFa: event?.titleFa ?? "",
    descriptionFa: event?.descriptionFa ?? "",
    imageUrl: event?.imageUrl ?? "",
    startsAt: event ? dateToWallTime(new Date(event.startsAt)) : "",
    endsAt: event ? dateToWallTime(new Date(event.endsAt)) : "",
    capacity: event?.capacity != null ? String(event.capacity) : "",
    price: event ? String(event.price) : "0",
    // A new event starts as a draft — staff publish it once the details are right.
    isPublished: event?.isPublished ?? false,
  };
}

/**
 * Create/edit event form. React Hook Form + the shared `eventFormSchema` in raw
 * mode, so the form submits its string input shape and the route coerces it.
 * Times are typed on the cafe's clock. On success it returns to the list; API
 * errors land on their fields, or at the root.
 */
export function EventForm(props: EventFormProps) {
  const t = useTranslations("dashEvents");
  const tFloor = useTranslations("floorTables");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const fieldError = (message?: string): string | undefined => formErrorMessage(tFormErrors, message);
  const editing = props.mode === "edit";
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<EventFormInput>({
    resolver: zodResolver(eventFormSchema, undefined, { raw: true }),
    defaultValues: toDefaults(editing ? props.event : undefined),
  });

  const imageUrl = useWatch({ control, name: "imageUrl" });

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (editing) {
        const saved = await eventsApi.update(props.event.id, values);
        // A new time can release held tables that a booking or another event has then.
        const released = props.event.tableLabels.filter((label) => !saved.tableLabels.includes(label));
        toast({
          tone: "success",
          title: t("savedToast"),
          description: released.length
            ? t("tablesReleasedOnSave", {
                tables: released.map((label) => tFloor("tableName", tableNameValues(label, locale))).join(", "),
              })
            : undefined,
        });
      } else {
        await eventsApi.create(values);
        toast({ tone: "success", title: t("createdToast") });
      }
      router.push("/dashboard/events");
      router.refresh();
    } catch (error) {
      if (!(error instanceof ApiError)) {
        setError("root", { message: t("formError") });
        return;
      }
      let appliedField = false;
      for (const field of FORM_FIELDS) {
        const message = error.fieldErrors?.[field];
        if (message) {
          setError(field, { message });
          appliedField = true;
        }
      }
      if (!appliedField) setError("root", { message: localizeApiError(error, tApiErrors, t("formError")) });
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <DashboardPageHeader
        backHref="/dashboard/events"
        backLabel={t("backToEvents")}
        title={editing ? t("editHeading") : t("newEvent")}
        subtitle={editing ? props.event.title : t("createSubtitle")}
        actions={
          <>
            {editing ? props.cancelAction : null}
            {editing ? <DeleteEventButton id={props.event.id} title={props.event.title} /> : null}
            <Button asChild variant="secondary" size="control-md" className="px-3">
              <Link href="/dashboard/events">{t("cancel")}</Link>
            </Button>
            <Button type="submit" size="control-md" loading={isSubmitting}>
              {editing ? t("saveChanges") : t("createEvent")}
            </Button>
          </>
        }
        alert={errors.root?.message ? <FormAlert>{errors.root.message}</FormAlert> : null}
      />

      <DashboardColumns
        main={
          <>
            <DashboardSection title={t("sectionDetails")}>
              <div className="flex flex-col gap-1.5">
                <span className={FIELD_LABEL}>
                  {t("kindLabel")}
                  <RequiredMark />
                </span>
                <Controller
                  control={control}
                  name="kind"
                  render={({ field }) => (
                    <OverviewSegmented
                      label={t("kindLabel")}
                      value={field.value}
                      options={EVENT_KINDS.map((kind) => ({ value: kind, label: t(`kind.${kind}`) }))}
                      onChange={field.onChange}
                      fill
                    />
                  )}
                />
                {errors.kind?.message ? <FormMessage>{fieldError(errors.kind.message)}</FormMessage> : null}
              </div>

              {/* Guest-facing copy per locale, both on screen so no value is hidden. */}
              <div className={LANGUAGE_GRID}>
                <DashboardLanguageColumn label={t("localeTabBase")}>
                  <DashboardFormField label={t("titleLabel")} required error={fieldError(errors.title?.message)}>
                    {(wiring) => (
                      <Input
                        {...wiring}
                        {...register("title")}
                        size="control-md"
                        inputClassName={FIELD_INPUT}
                        dir="auto"
                        placeholder={t("titlePlaceholder")}
                      />
                    )}
                  </DashboardFormField>
                  <DashboardFormField label={t("descriptionLabel")} error={fieldError(errors.description?.message)}>
                    {(wiring) => (
                      <Textarea
                        {...wiring}
                        {...register("description")}
                        className={FIELD_TEXTAREA}
                        dir="auto"
                        rows={4}
                      />
                    )}
                  </DashboardFormField>
                </DashboardLanguageColumn>

                <DashboardLanguageColumn label={t("localeTabFa")}>
                  <DashboardFormField label={t("titleLabel")} error={fieldError(errors.titleFa?.message)}>
                    {(wiring) => (
                      <Input
                        {...wiring}
                        {...register("titleFa")}
                        size="control-md"
                        inputClassName={FIELD_INPUT}
                        dir="rtl"
                      />
                    )}
                  </DashboardFormField>
                  <DashboardFormField label={t("descriptionLabel")} error={fieldError(errors.descriptionFa?.message)}>
                    {(wiring) => (
                      <Textarea
                        {...wiring}
                        {...register("descriptionFa")}
                        className={FIELD_TEXTAREA}
                        dir="rtl"
                        rows={4}
                      />
                    )}
                  </DashboardFormField>
                </DashboardLanguageColumn>
              </div>
            </DashboardSection>

            <DashboardSection title={t("sectionWhen")}>
              <div className="flex flex-col gap-1.5">
                <div className={FIELD_GRID}>
                  <DashboardFormField label={t("startsAtLabel")} required error={fieldError(errors.startsAt?.message)}>
                    {(wiring) => (
                      <Input
                        {...wiring}
                        {...register("startsAt")}
                        size="control-md"
                        inputClassName={FIELD_INPUT}
                        type="datetime-local"
                        dir="ltr"
                      />
                    )}
                  </DashboardFormField>
                  <DashboardFormField label={t("endsAtLabel")} required error={fieldError(errors.endsAt?.message)}>
                    {(wiring) => (
                      <Input
                        {...wiring}
                        {...register("endsAt")}
                        size="control-md"
                        inputClassName={FIELD_INPUT}
                        type="datetime-local"
                        dir="ltr"
                      />
                    )}
                  </DashboardFormField>
                </div>
                <p className={FIELD_HINT}>{t("timeZoneHint")}</p>
              </div>

              <div className={FIELD_GRID}>
                <DashboardFormField
                  label={t("capacityLabel")}
                  hint={t("capacityDescription")}
                  error={fieldError(errors.capacity?.message)}
                >
                  {(wiring) => (
                    <Input
                      {...wiring}
                      {...register("capacity")}
                      size="control-md"
                      inputClassName={FIELD_INPUT}
                      inputMode="numeric"
                      placeholder="20"
                    />
                  )}
                </DashboardFormField>
                <DashboardFormField
                  label={t("priceLabel")}
                  hint={t("priceDescription")}
                  error={fieldError(errors.price?.message)}
                >
                  {(wiring) => (
                    <Input
                      {...wiring}
                      {...register("price")}
                      size="control-md"
                      inputClassName={FIELD_INPUT}
                      inputMode="numeric"
                      placeholder="0"
                    />
                  )}
                </DashboardFormField>
              </div>
            </DashboardSection>

            {editing ? props.guestList : null}
          </>
        }
        side={
          <>
            <DashboardSection title={t("imageLabel")}>
              <Field error={fieldError(errors.imageUrl?.message)}>
                {({ id }) => (
                  <>
                    <label htmlFor={id} className="sr-only">
                      {t("imageLabel")}
                    </label>
                    <EventImageUpload
                      id={id}
                      value={imageUrl}
                      onChange={(url) => setValue("imageUrl", url, { shouldValidate: true })}
                    />
                  </>
                )}
              </Field>
              <input type="hidden" {...register("imageUrl")} />
            </DashboardSection>

            <DashboardSection title={t("sectionVisibility")}>
              <Controller
                control={control}
                name="isPublished"
                render={({ field }) => (
                  <DashboardSwitchField
                    label={t("publishedLabel")}
                    hint={t("publishedDescription")}
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </DashboardSection>

            {editing ? props.activity : null}
          </>
        }
      />
    </form>
  );
}
