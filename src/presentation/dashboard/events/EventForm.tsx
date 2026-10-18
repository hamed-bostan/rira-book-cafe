"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

import { eventFormSchema, type EventFormInput } from "@/src/contracts/event-schema";
import { EVENT_KINDS, type CafeEvent } from "@/src/domain/entities/CafeEvent";
import { dateToWallTime } from "@/src/domain/entities/CafeTime";
import { Link, useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { ControlledChoicePicker } from "@/src/presentation/dashboard/list";
import {
  Button,
  Field,
  FormMessage,
  Input,
  RequiredMark,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  TextField,
  useToast,
} from "@/src/presentation/design-system";

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

type EventFormProps = { mode: "create" } | { mode: "edit"; event: CafeEvent };

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
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const fieldError = (message?: string): string | undefined => formErrorMessage(tFormErrors, message);
  const editing = props.mode === "edit";
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
      if (editing) await eventsApi.update(props.event.id, values);
      else await eventsApi.create(values);
      toast({ tone: "success", title: editing ? t("savedToast") : t("createdToast") });
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
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <Field error={fieldError(errors.kind?.message)}>
        {({ id, ariaDescribedBy, ariaInvalid }) => (
          <>
            <label htmlFor={id} className="text-body-small-emphasis text-input-foreground">
              {t("kindLabel")}
              <RequiredMark />
            </label>
            <Controller
              control={control}
              name="kind"
              render={({ field }) => (
                <ControlledChoicePicker
                  id={id}
                  ariaInvalid={ariaInvalid}
                  ariaDescribedBy={ariaDescribedBy}
                  label={t("kindLabel")}
                  value={field.value}
                  onValueChange={field.onChange}
                  inactiveValue="bookClub"
                  triggerClassName="h-12 w-full justify-between rounded-input text-body-small"
                  options={EVENT_KINDS.map((kind) => ({ value: kind, label: t(`kind.${kind}`) }))}
                />
              )}
            />
          </>
        )}
      </Field>

      {/* Guest-facing copy per locale; both panels stay mounted so no value is dropped. */}
      <Tabs defaultValue="base">
        <TabsList>
          <TabsTrigger value="base">{t("localeTabBase")}</TabsTrigger>
          <TabsTrigger value="fa">{t("localeTabFa")}</TabsTrigger>
        </TabsList>

        <TabsContent value="base" forceMount className="flex flex-col gap-5 pt-4 data-[state=inactive]:hidden">
          <TextField label={t("titleLabel")} required error={fieldError(errors.title?.message)}>
            {(control) => <Input {...control} {...register("title")} dir="auto" placeholder={t("titlePlaceholder")} />}
          </TextField>
          <TextField label={t("descriptionLabel")} error={fieldError(errors.description?.message)}>
            {(control) => <Textarea {...control} {...register("description")} dir="auto" rows={5} />}
          </TextField>
        </TabsContent>

        <TabsContent value="fa" forceMount className="flex flex-col gap-5 pt-4 data-[state=inactive]:hidden">
          <p className="text-body-caption text-muted-foreground">{t("translationDescription")}</p>
          <TextField label={t("titleLabel")} error={fieldError(errors.titleFa?.message)}>
            {(control) => <Input {...control} {...register("titleFa")} dir="rtl" />}
          </TextField>
          <TextField label={t("descriptionLabel")} error={fieldError(errors.descriptionFa?.message)}>
            {(control) => <Textarea {...control} {...register("descriptionFa")} dir="rtl" rows={5} />}
          </TextField>
        </TabsContent>
      </Tabs>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField label={t("startsAtLabel")} required error={fieldError(errors.startsAt?.message)}>
          {(control) => <Input {...control} {...register("startsAt")} type="datetime-local" dir="ltr" />}
        </TextField>
        <TextField label={t("endsAtLabel")} required error={fieldError(errors.endsAt?.message)}>
          {(control) => <Input {...control} {...register("endsAt")} type="datetime-local" dir="ltr" />}
        </TextField>
      </div>
      <p className="-mt-3 text-body-caption text-muted-foreground">{t("timeZoneHint")}</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField label={t("capacityLabel")} description={t("capacityDescription")} error={fieldError(errors.capacity?.message)}>
          {(control) => <Input {...control} {...register("capacity")} inputMode="numeric" placeholder="20" />}
        </TextField>
        <TextField label={t("priceLabel")} description={t("priceDescription")} error={fieldError(errors.price?.message)}>
          {(control) => <Input {...control} {...register("price")} inputMode="numeric" placeholder="0" />}
        </TextField>
      </div>

      <Field error={fieldError(errors.imageUrl?.message)}>
        {({ id }) => (
          <>
            <label htmlFor={id} className="text-body-small-emphasis text-input-foreground">
              {t("imageLabel")}
            </label>
            <EventImageUpload id={id} value={imageUrl} onChange={(url) => setValue("imageUrl", url, { shouldValidate: true })} />
          </>
        )}
      </Field>
      <input type="hidden" {...register("imageUrl")} />

      <Controller
        control={control}
        name="isPublished"
        render={({ field }) => (
          <div className="flex items-center justify-between rounded-card-md border border-border px-4 py-3">
            <div>
              <label htmlFor="isPublished" className="text-body-small-emphasis text-input-foreground">
                {t("publishedLabel")}
              </label>
              <p className="text-body-caption text-muted-foreground">{t("publishedDescription")}</p>
            </div>
            <Switch id="isPublished" checked={field.value} onCheckedChange={field.onChange} aria-label={t("publishedLabel")} />
          </div>
        )}
      />

      {errors.root?.message ? <FormMessage size="md">{errors.root.message}</FormMessage> : null}

      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={isSubmitting}>
          {editing ? t("saveChanges") : t("createEvent")}
        </Button>
        <Button asChild variant="outline" type="button">
          <Link href="/dashboard/events">{t("cancel")}</Link>
        </Button>
      </div>
    </form>
  );
}
