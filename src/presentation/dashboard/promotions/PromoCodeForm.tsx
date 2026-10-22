"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { promoCodeFormSchema, type PromoCodeFormInput } from "@/src/contracts/promotion-schema";
import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import {
  MAX_PROMO_DESCRIPTION_LENGTH,
  normalizePromoCode,
  PROMO_KINDS,
  type PromoCode,
} from "@/src/domain/entities/Promotion";
import { useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { OverviewSegmented } from "@/src/presentation/dashboard/overview/OverviewSegmented";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { FormMessage } from "@/src/presentation/design-system/components/form/FormMessage/FormMessage";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Switch } from "@/src/presentation/design-system/components/Switch/Switch";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { promotionsApi } from "./promotion-api";

/** The form's fields in the order a problem with them is reported. */
const FIELDS = [
  "code",
  "kind",
  "value",
  "maxDiscount",
  "minSubtotal",
  "perGuestLimit",
  "usageLimit",
  "startsOn",
  "endsOn",
  "description",
] as const;
type Field = (typeof FIELDS)[number];

/** Optional limits, typed as whole numbers. */
type LimitField = "maxDiscount" | "minSubtotal" | "perGuestLimit" | "usageLimit";

/** Fields whose message says nothing about which field it is ("Enter a whole number…"), so it's prefixed with the label. */
const NAMED: ReadonlySet<Field> = new Set([
  "maxDiscount",
  "minSubtotal",
  "perGuestLimit",
  "usageLimit",
  "startsOn",
  "endsOn",
  "description",
]);

type PromoCodeFormProps = {
  /** The code to edit; omit to create one. */
  promo?: PromoCode;
  /** Every code already in use, to catch a clash before saving. */
  takenCodes: readonly string[];
  /** Today on the cafe calendar — a code can't be set to end before it. */
  today: string;
  /** Saved: the dialog closes. */
  onDone: () => void;
  onCancel: () => void;
};

/** A code's stored window back to the inclusive cafe days the form shows. */
function initialValues(promo?: PromoCode): PromoCodeFormInput {
  return {
    code: promo?.code ?? "",
    description: promo?.description ?? "",
    kind: promo?.kind ?? "percent",
    value: promo ? String(promo.value) : "",
    maxDiscount: promo?.maxDiscount !== undefined ? String(promo.maxDiscount) : "",
    minSubtotal: promo?.minSubtotal ? String(promo.minSubtotal) : "",
    startsOn: promo?.startsAt ? cafeDayOf(new Date(promo.startsAt)) : "",
    // Stored as the instant the last day ends, so step back into that day.
    endsOn: promo?.endsAt ? cafeDayOf(new Date(new Date(promo.endsAt).getTime() - 1)) : "",
    usageLimit: promo?.usageLimit !== undefined ? String(promo.usageLimit) : "",
    perGuestLimit: promo?.perGuestLimit !== undefined ? String(promo.perGuestLimit) : "",
    isActive: promo?.isActive ?? true,
  };
}

/**
 * The fields of a promo code: the code, percent or amount off (a percentage can
 * be capped), the limits — a minimum order, uses per guest and in all, the days
 * it runs — who it's for, and whether it's on. Checks itself as it's filled in
 * with the same schema the API re-validates with, so Save stays off until the
 * code would be accepted; a code that already ended has to get a new end date.
 * Writes over the REST API, then `router.refresh()`es.
 */
export function PromoCodeForm({ promo, takenCodes, today, onDone, onCancel }: PromoCodeFormProps) {
  const t = useTranslations("dashPromotions");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const router = useRouter();
  const { toast } = useToast();
  const activeId = React.useId();

  const [values, setValues] = React.useState<PromoCodeFormInput>(() => initialValues(promo));
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function set<K extends keyof PromoCodeFormInput>(key: K, value: PromoCodeFormInput[K]): void {
    setValues((current) => ({ ...current, [key]: value }));
    setServerError(null);
  }

  const label = (field: Field): string => (field === "value" ? t(`valueLabel.${values.kind}`) : t(`field.${field}`));

  const code = normalizePromoCode(values.code);
  // The two fields every code needs: while either is blank, Save just waits.
  const incomplete = code === "" || values.value.trim() === "";

  function firstProblem(): string | null {
    const parsed = promoCodeFormSchema.safeParse(values);
    const errors: Partial<Record<string, string[]>> = parsed.success ? {} : parsed.error.flatten().fieldErrors;
    for (const field of FIELDS) {
      const message = errors[field]?.[0];
      const blankRequired = (field === "code" && code === "") || (field === "value" && values.value.trim() === "");
      if (message && !blankRequired) {
        const text = formErrorMessage(tFormErrors, message) ?? message;
        return NAMED.has(field) ? `${label(field)}: ${text}` : text;
      }
      if (field === "code" && code !== "" && code !== promo?.code && takenCodes.includes(code)) {
        return t("codeTaken", { code });
      }
      if (field === "endsOn" && values.endsOn && values.endsOn < today) return t("endInPast");
    }
    return null;
  }

  const problem = firstProblem();
  const blocked = incomplete || problem !== null;

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    if (blocked) return;
    startTransition(async () => {
      try {
        const saved = promo
          ? await promotionsApi.updatePromoCode(promo.id, values)
          : await promotionsApi.createPromoCode(values);
        toast({
          tone: "success",
          title: promo ? t("codeSaved", { code: saved.code }) : t("created", { code: saved.code }),
        });
        onDone();
        router.refresh();
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.status === 409) {
            setServerError(t("codeTaken", { code }));
            return;
          }
          const field = FIELDS.find((name) => err.fieldErrors?.[name]);
          const message = field ? err.fieldErrors?.[field] : undefined;
          if (field && message) {
            setServerError(`${label(field)}: ${formErrorMessage(tFormErrors, message) ?? message}`);
            return;
          }
        }
        setServerError(localizeApiError(err, tApiErrors, t("saveError")));
      }
    });
  }

  const limit = (field: LimitField, placeholder: string): React.ReactNode => (
    <label className="flex min-w-0 flex-col gap-1.5 text-body-small-emphasis text-foreground">
      {t("optionalField", { label: label(field) })}
      <Input
        value={values[field]}
        onChange={(event) => set(field, event.target.value)}
        inputMode="numeric"
        dir="ltr"
        autoComplete="off"
        placeholder={placeholder}
      />
    </label>
  );

  const day = (field: "startsOn" | "endsOn", min?: string): React.ReactNode => (
    <label className="flex min-w-0 flex-col gap-1.5 text-body-small-emphasis text-foreground">
      {t("optionalField", { label: label(field) })}
      <Input
        type="date"
        value={values[field]}
        onChange={(event) => set(field, event.target.value)}
        min={min}
        dir="ltr"
      />
    </label>
  );

  const error = problem ?? serverError;

  return (
    <form onSubmit={submit} className="mt-5 flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-4">
        <label className="col-span-2 flex min-w-0 flex-col gap-1.5 text-body-small-emphasis text-foreground">
          {label("code")}
          <Input
            value={values.code}
            // Codes are stored upper-case without spaces — show them that way as they're typed.
            onChange={(event) => set("code", event.target.value.toUpperCase().replace(/\s/g, ""))}
            dir="ltr"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={20}
            placeholder={t("codePlaceholder")}
            required
          />
          <span className="text-body-small font-normal text-muted-foreground sm:text-body-caption">
            {t("codeHint")}
          </span>
        </label>

        <div className="col-span-2 flex flex-col gap-1.5">
          <span className="text-body-small-emphasis text-foreground">{label("kind")}</span>
          <OverviewSegmented
            label={label("kind")}
            value={values.kind}
            onChange={(kind) =>
              // A cap only means something on a percentage — don't keep a hidden one.
              setValues((current) => ({ ...current, kind, maxDiscount: kind === "percent" ? current.maxDiscount : "" }))
            }
            options={PROMO_KINDS.map((kind) => ({ value: kind, label: t(`kind.${kind}`) }))}
          />
        </div>

        <label className="flex min-w-0 flex-col gap-1.5 text-body-small-emphasis text-foreground">
          {label("value")}
          <Input
            value={values.value}
            onChange={(event) => set("value", event.target.value)}
            inputMode="numeric"
            dir="ltr"
            autoComplete="off"
            placeholder={values.kind === "percent" ? "10" : "30000"}
            required
          />
        </label>
        {values.kind === "percent" ? limit("maxDiscount", t("noCap")) : null}
        {limit("minSubtotal", t("anyOrder"))}
        {limit("perGuestLimit", t("noLimit"))}
        {limit("usageLimit", t("noLimit"))}

        <div className="col-span-2 grid grid-cols-2 gap-4">
          {day("startsOn")}
          {day("endsOn", today)}
        </div>

        <label className="col-span-2 flex min-w-0 flex-col gap-1.5 text-body-small-emphasis text-foreground">
          {t("optionalField", { label: label("description") })}
          <Input
            value={values.description}
            onChange={(event) => set("description", event.target.value)}
            maxLength={MAX_PROMO_DESCRIPTION_LENGTH}
            autoComplete="off"
            placeholder={t("descriptionPlaceholder")}
          />
        </label>

        <label htmlFor={activeId} className="col-span-2 flex min-h-11 cursor-pointer items-center gap-3 sm:min-h-8">
          <Switch
            id={activeId}
            size="sm"
            checked={values.isActive}
            onCheckedChange={(checked) => set("isActive", checked)}
          />
          <span className="flex flex-col">
            <span className="text-body-small-emphasis text-foreground">{t("field.isActive")}</span>
            <span className="text-body-small text-muted-foreground sm:text-body-caption">
              {values.isActive ? t("activeHintOn") : t("activeHintOff")}
            </span>
          </span>
        </label>
      </div>

      {error ? <FormMessage>{error}</FormMessage> : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" className="px-4" onClick={onCancel}>
          {t("back")}
        </Button>
        <Button type="submit" size="sm" className="px-4" loading={pending} disabled={blocked}>
          {promo ? t("saveChanges") : t("create")}
        </Button>
      </div>
    </form>
  );
}
