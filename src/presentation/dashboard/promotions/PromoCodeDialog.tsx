"use client";

import { useTranslations } from "next-intl";
import * as React from "react";
import { flattenError } from "zod/mini";

import { promoCodeFormSchema, type PromoCodeFormInput } from "@/src/contracts/promotion-schema";
import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import {
  MAX_PROMO_CODE_LENGTH,
  MAX_PROMO_DESCRIPTION_LENGTH,
  normalizePromoCode,
  PROMO_KINDS,
  type PromoCode,
} from "@/src/domain/entities/Promotion";
import { useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { cn } from "@/src/lib/utils";
import { DashboardDialog } from "@/src/presentation/dashboard/DashboardDialog";
import { DashboardField } from "@/src/presentation/dashboard/DashboardField";
import { FIELD_GRID, FIELD_HINT, FIELD_LABEL } from "@/src/presentation/dashboard/fieldStyles";
import { OverviewSegmented } from "@/src/presentation/dashboard/overview/OverviewSegmented";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Switch } from "@/src/presentation/design-system/components/Switch/Switch";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { PromoScopePicker, type PromoScopeOption } from "./PromoScopePicker";
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
  "categoryIds",
  "productIds",
  "description",
] as const;
type Field = (typeof FIELDS)[number];

/** Optional limits, typed as whole numbers. */
type LimitField = "maxDiscount" | "minSubtotal" | "perGuestLimit" | "usageLimit";

/** Who and what the code is for, beyond its limits. */
type ScopeField = "productIds" | "categoryIds" | "firstOrderOnly";

/** The menu's items and categories a code can be limited to. */
export type PromoScopeOptions = { products: PromoScopeOption[]; categories: PromoScopeOption[] };

/** Fields whose message says nothing about which field it is ("Enter a whole number…"), so it's prefixed with the label. */
const NAMED: ReadonlySet<Field> = new Set([
  "maxDiscount",
  "minSubtotal",
  "perGuestLimit",
  "usageLimit",
  "startsOn",
  "endsOn",
  "categoryIds",
  "productIds",
  "description",
]);

type PromoCodeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The code to edit; omit to create one. */
  promo?: PromoCode;
  /** Every code already in use, to catch a clash before saving. */
  takenCodes: readonly string[];
  /** Today on the cafe calendar — a code can't be set to end before it. */
  today: string;
  /** The menu's items and categories, to limit the code to. */
  scope: PromoScopeOptions;
};

/** A code's stored window back to the inclusive cafe days the form shows. */
function initialValues(promo?: PromoCode): PromoCodeFormInput & Required<Pick<PromoCodeFormInput, ScopeField>> {
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
    productIds: promo?.productIds ?? [],
    categoryIds: promo?.categoryIds ?? [],
    firstOrderOnly: promo?.firstOrderOnly ?? false,
  };
}

/**
 * Create or edit a promo code, in a dialog: the code, percent or amount off (a
 * percentage can be capped), the limits — a minimum order, uses per guest and in
 * all, the days it runs — what it covers (some categories and/or items: their lines
 * alone are discounted and count toward the minimum), whether it's for a guest's
 * first order only, who it's for, and whether it's on. Checks itself as it's
 * filled in with the same schema the API re-validates with, so Save stays off
 * until the code would be accepted; a code that already ended has to get a new end
 * date. Writes over the REST API, then `router.refresh()`es.
 *
 * Controlled, so a row's ⋯ menu can open it. It holds what's typed, so callers
 * give it a fresh `key` each time it opens — it always starts from the code as saved.
 */
export function PromoCodeDialog({ open, onOpenChange, promo, takenCodes, today, scope }: PromoCodeDialogProps) {
  const t = useTranslations("dashPromotions");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const router = useRouter();
  const { toast } = useToast();
  const activeId = React.useId();
  const firstOrderId = React.useId();

  const [values, setValues] = React.useState(() => initialValues(promo));
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function set<K extends keyof typeof values>(key: K, value: (typeof values)[K]): void {
    setValues((current) => ({ ...current, [key]: value }));
    setServerError(null);
  }

  const label = (field: Field): string => (field === "value" ? t(`valueLabel.${values.kind}`) : t(`field.${field}`));

  const code = normalizePromoCode(values.code);
  // The two fields every code needs: while either is blank, Save just waits.
  const incomplete = code === "" || values.value.trim() === "";

  function firstProblem(): string | null {
    const parsed = promoCodeFormSchema.safeParse(values);
    const errors: Partial<Record<string, string[]>> = parsed.success ? {} : flattenError(parsed.error).fieldErrors;
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

  function submit(): void {
    startTransition(async () => {
      try {
        const saved = promo
          ? await promotionsApi.updatePromoCode(promo.id, values)
          : await promotionsApi.createPromoCode(values);
        toast({
          tone: "success",
          title: promo ? t("codeSaved", { code: saved.code }) : t("created", { code: saved.code }),
        });
        onOpenChange(false);
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
    <DashboardField label={t("optionalField", { label: label(field) })}>
      <Input
        size="control-md"
        value={values[field]}
        onChange={(event) => set(field, event.target.value)}
        inputMode="numeric"
        dir="ltr"
        autoComplete="off"
        placeholder={placeholder}
      />
    </DashboardField>
  );

  const day = (field: "startsOn" | "endsOn", min?: string): React.ReactNode => (
    <DashboardField label={t("optionalField", { label: label(field) })}>
      <Input
        size="control-md"
        type="date"
        value={values[field]}
        onChange={(event) => set(field, event.target.value)}
        min={min}
        dir="ltr"
      />
    </DashboardField>
  );

  return (
    <DashboardDialog
      open={open}
      onOpenChange={onOpenChange}
      title={promo ? t("editTitle", { code: promo.code }) : t("newTitle")}
      subtitle={promo ? t("editSub") : t("newSub")}
      submitLabel={promo ? t("saveChanges") : t("create")}
      blocked={incomplete || problem !== null}
      pending={pending}
      onSubmit={submit}
      error={problem ?? serverError}
    >
      <div className={FIELD_GRID}>
        <DashboardField label={label("code")} hint={t("codeHint")} className="col-span-full">
          <Input
            size="control-md"
            value={values.code}
            // Codes are stored upper-case without spaces — show them that way as they're typed.
            onChange={(event) => set("code", event.target.value.toUpperCase().replace(/\s/g, ""))}
            dir="ltr"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={MAX_PROMO_CODE_LENGTH}
            placeholder={t("codePlaceholder")}
            required
          />
        </DashboardField>

        {/* Not a <label>: it would hand a click on its text to the first segment. */}
        <div className="col-span-full flex flex-col gap-1.5">
          <span className={FIELD_LABEL}>{label("kind")}</span>
          <OverviewSegmented
            fill
            label={label("kind")}
            value={values.kind}
            onChange={(kind) =>
              // A cap only means something on a percentage — don't keep a hidden one.
              setValues((current) => ({ ...current, kind, maxDiscount: kind === "percent" ? current.maxDiscount : "" }))
            }
            options={PROMO_KINDS.map((kind) => ({ value: kind, label: t(`kind.${kind}`) }))}
          />
        </div>

        <DashboardField label={label("value")}>
          <Input
            size="control-md"
            value={values.value}
            onChange={(event) => set("value", event.target.value)}
            inputMode="numeric"
            dir="ltr"
            autoComplete="off"
            placeholder={values.kind === "percent" ? "10" : "30000"}
            required
          />
        </DashboardField>
        {values.kind === "percent" ? limit("maxDiscount", t("noCap")) : null}
        {limit("minSubtotal", t("anyOrder"))}
        {limit("perGuestLimit", t("noLimit"))}
        {limit("usageLimit", t("noLimit"))}

        <div className={cn("col-span-full", FIELD_GRID)}>
          {day("startsOn")}
          {day("endsOn", today)}
        </div>

        <div className={cn("col-span-full", FIELD_GRID)}>
          <PromoScopePicker
            label={t("optionalField", { label: t("field.categoryIds") })}
            hint={t("scopeCategoriesHint")}
            options={scope.categories}
            selected={values.categoryIds}
            onChange={(ids) => set("categoryIds", ids)}
          />
          <PromoScopePicker
            label={t("optionalField", { label: t("field.productIds") })}
            hint={t("scopeProductsHint")}
            options={scope.products}
            selected={values.productIds}
            onChange={(ids) => set("productIds", ids)}
          />
        </div>

        <label
          htmlFor={firstOrderId}
          className="col-span-full flex min-h-11 cursor-pointer items-center gap-3 sm:min-h-8"
        >
          <Switch
            id={firstOrderId}
            size="sm"
            checked={values.firstOrderOnly}
            onCheckedChange={(checked) => set("firstOrderOnly", checked)}
          />
          <span className="flex flex-col">
            <span className={FIELD_LABEL}>{t("field.firstOrderOnly")}</span>
            <span className={FIELD_HINT}>{t("firstOrderHint")}</span>
          </span>
        </label>

        <DashboardField label={t("optionalField", { label: label("description") })} className="col-span-full">
          <Input
            size="control-md"
            value={values.description}
            onChange={(event) => set("description", event.target.value)}
            maxLength={MAX_PROMO_DESCRIPTION_LENGTH}
            autoComplete="off"
            placeholder={t("descriptionPlaceholder")}
          />
        </DashboardField>

        <label htmlFor={activeId} className="col-span-full flex min-h-11 cursor-pointer items-center gap-3 sm:min-h-8">
          <Switch
            id={activeId}
            size="sm"
            checked={values.isActive}
            onCheckedChange={(checked) => set("isActive", checked)}
          />
          <span className="flex flex-col">
            <span className={FIELD_LABEL}>{t("field.isActive")}</span>
            <span className={FIELD_HINT}>{values.isActive ? t("activeHintOn") : t("activeHintOff")}</span>
          </span>
        </label>
      </div>
    </DashboardDialog>
  );
}
