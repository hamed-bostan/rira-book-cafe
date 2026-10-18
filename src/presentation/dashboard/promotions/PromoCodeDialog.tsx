"use client";

import { Pencil, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import type { PromoCodeFormInput } from "@/src/contracts/promotion-schema";
import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import {
  MAX_PROMO_DESCRIPTION_LENGTH,
  normalizePromoCode,
  PROMO_KINDS,
  type PromoCode,
  type PromoKind,
} from "@/src/domain/entities/Promotion";
import { useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { FormMessage } from "@/src/presentation/design-system/components/form/FormMessage/FormMessage";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Select } from "@/src/presentation/design-system/components/form/Select/Select";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { Modal, ModalContent } from "@/src/presentation/design-system/components/Modal/Modal";
import { Switch } from "@/src/presentation/design-system/components/Switch/Switch";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { promotionsApi } from "./promotion-api";

type PromoCodeDialogProps = {
  /** The code to edit; omit to create one. */
  promo?: PromoCode;
};

const FIELDS = [
  "code",
  "description",
  "kind",
  "value",
  "maxDiscount",
  "minSubtotal",
  "startsOn",
  "endsOn",
  "usageLimit",
  "perGuestLimit",
] as const;

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
 * Create or edit a promo code: the code, how much it takes off, and its limits.
 * Writes over the REST API, then `router.refresh()`es the list.
 */
export function PromoCodeDialog({ promo }: PromoCodeDialogProps) {
  const t = useTranslations("dashPromotions");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const router = useRouter();
  const { toast } = useToast();

  const [open, setOpen] = React.useState(false);
  const [values, setValues] = React.useState<PromoCodeFormInput>(() => initialValues(promo));
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function set<K extends keyof PromoCodeFormInput>(key: K, value: PromoCodeFormInput[K]): void {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function openDialog(): void {
    setValues(initialValues(promo));
    setError(null);
    setOpen(true);
  }

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        if (promo) await promotionsApi.updatePromoCode(promo.id, values);
        else await promotionsApi.createPromoCode(values);
        setOpen(false);
        toast({ tone: "success", title: t("codeSaved", { code: normalizePromoCode(values.code) }) });
        router.refresh();
      } catch (err) {
        if (err instanceof ApiError) {
          const field = FIELDS.find((name) => err.fieldErrors?.[name]);
          const message = field ? err.fieldErrors?.[field] : undefined;
          if (field && message) {
            setError(`${t(`field.${field}`)}: ${formErrorMessage(tFormErrors, message) ?? message}`);
            return;
          }
        }
        setError(localizeApiError(err, tApiErrors, t("saveError")));
      }
    });
  }

  const text = (field: (typeof FIELDS)[number], props: React.ComponentProps<typeof Input> = {}) => (
    <label className="flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
      {t(`field.${field}`)}
      <Input value={values[field]} onChange={(event) => set(field, event.target.value)} autoComplete="off" {...props} />
    </label>
  );

  return (
    <>
      {promo ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          iconOnly
          aria-label={t("editAria", { code: promo.code })}
          onClick={openDialog}
        >
          <Icon icon={Pencil} size="xs" />
        </Button>
      ) : (
        <Button type="button" size="sm" onClick={openDialog}>
          <Icon icon={Plus} size="sm" className="me-1" />
          {t("newCode")}
        </Button>
      )}

      <Modal open={open} onOpenChange={setOpen}>
        <ModalContent title={promo ? t("editTitle", { code: promo.code }) : t("newTitle")}>
          <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {text("code", { dir: "ltr", required: true, maxLength: 20, placeholder: "WELCOME10" })}
              <label className="flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
                {t("field.kind")}
                <Select value={values.kind} onChange={(event) => set("kind", event.target.value as PromoKind)}>
                  {PROMO_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {t(`kind.${kind}`)}
                    </option>
                  ))}
                </Select>
              </label>
            </div>
            {text("description", { maxLength: MAX_PROMO_DESCRIPTION_LENGTH, placeholder: t("descriptionPlaceholder") })}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {text("value", {
                inputMode: "numeric",
                dir: "ltr",
                required: true,
                placeholder: values.kind === "percent" ? "10" : "50000",
              })}
              {values.kind === "percent"
                ? text("maxDiscount", { inputMode: "numeric", dir: "ltr", placeholder: t("optional") })
                : null}
              {text("minSubtotal", { inputMode: "numeric", dir: "ltr", placeholder: t("optional") })}
              {text("usageLimit", { inputMode: "numeric", dir: "ltr", placeholder: t("unlimited") })}
              {text("perGuestLimit", { inputMode: "numeric", dir: "ltr", placeholder: t("unlimited") })}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {text("startsOn", { type: "date", dir: "ltr" })}
              {text("endsOn", { type: "date", dir: "ltr" })}
            </div>
            <label className="flex items-center justify-between gap-3 text-body-small-emphasis text-foreground">
              {t("field.isActive")}
              <Switch checked={values.isActive} onCheckedChange={(checked) => set("isActive", checked)} />
            </label>
            {error ? <FormMessage>{error}</FormMessage> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" size="sm" loading={pending}>
                {pending ? t("saving") : t("save")}
              </Button>
            </div>
          </form>
        </ModalContent>
      </Modal>
    </>
  );
}
