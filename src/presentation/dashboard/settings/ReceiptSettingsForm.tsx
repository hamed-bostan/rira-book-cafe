"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import * as React from "react";
import { useForm } from "react-hook-form";

import { receiptSettingsSchema, type ReceiptSettingsFormInput } from "@/src/contracts/cafe-settings-schema";
import { MAX_RECEIPT_HEADER_LINES, type ReceiptSettings } from "@/src/domain/entities/CafeSettings";
import { useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { DashboardFormField } from "@/src/presentation/dashboard/DashboardFormField";
import { DashboardLanguageColumn } from "@/src/presentation/dashboard/DashboardLanguageColumn";
import { DashboardSection } from "@/src/presentation/dashboard/DashboardSection";
import { FIELD_TEXTAREA, LANGUAGE_GRID } from "@/src/presentation/dashboard/fieldStyles";
import { FormAlert } from "@/src/presentation/dashboard/FormAlert";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Textarea } from "@/src/presentation/design-system/components/form/Textarea/Textarea";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { cafeSettingsApi } from "./cafe-settings-api";

const FIELDS = [
  "header",
  "headerFa",
  "footer",
  "footerFa",
] as const satisfies readonly (keyof ReceiptSettingsFormInput)[];

function toDefaults(receipt: ReceiptSettings): ReceiptSettingsFormInput {
  return {
    header: receipt.header ?? "",
    headerFa: receipt.headerFa ?? "",
    footer: receipt.footer ?? "",
    footerFa: receipt.footerFa ?? "",
  };
}

/**
 * What every receipt says besides the order: a few lines under the cafe's name
 * (a slogan, a tax number) and a note at the foot, in each language. A receipt
 * prints the reader's language, or the other one where theirs is blank; with no
 * note it thanks the guest.
 */
export function ReceiptSettingsForm({ receipt }: { receipt: ReceiptSettings }) {
  const t = useTranslations("dashSettings");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const fieldError = (message?: string): string | undefined => formErrorMessage(tFormErrors, message);
  const router = useRouter();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ReceiptSettingsFormInput>({
    resolver: zodResolver(receiptSettingsSchema, undefined, { raw: true }),
    defaultValues: toDefaults(receipt),
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const saved = await cafeSettingsApi.updateReceipt(values);
      reset(toDefaults(saved.receipt));
      toast({ tone: "success", title: t("receipt.saved") });
      router.refresh();
    } catch (error) {
      let applied = false;
      if (error instanceof ApiError) {
        for (const field of FIELDS) {
          const message = error.fieldErrors?.[field];
          if (message) {
            setError(field, { message });
            applied = true;
          }
        }
      }
      if (!applied) setError("root", { message: localizeApiError(error, tApiErrors, t("saveError")) });
    }
  });

  const headerHint = t("receipt.headerHint", { lines: MAX_RECEIPT_HEADER_LINES });

  return (
    <form onSubmit={onSubmit} noValidate aria-label={t("receipt.heading")}>
      <DashboardSection title={t("receipt.heading")} description={t("receipt.description")}>
        <div className={LANGUAGE_GRID}>
          <DashboardLanguageColumn label={t("languageEn")}>
            <DashboardFormField
              label={t("receipt.header")}
              hint={headerHint}
              error={fieldError(errors.header?.message)}
            >
              {(wiring) => (
                <Textarea {...wiring} {...register("header")} className={FIELD_TEXTAREA} dir="auto" rows={3} />
              )}
            </DashboardFormField>
            <DashboardFormField label={t("receipt.footer")} error={fieldError(errors.footer?.message)}>
              {(wiring) => (
                <Textarea
                  {...wiring}
                  {...register("footer")}
                  className={FIELD_TEXTAREA}
                  dir="auto"
                  rows={2}
                  placeholder={t("receipt.footerPlaceholder")}
                />
              )}
            </DashboardFormField>
          </DashboardLanguageColumn>
          <DashboardLanguageColumn label={t("languageFa")}>
            <DashboardFormField
              label={t("receipt.header")}
              hint={headerHint}
              error={fieldError(errors.headerFa?.message)}
            >
              {(wiring) => (
                <Textarea {...wiring} {...register("headerFa")} className={FIELD_TEXTAREA} dir="rtl" rows={3} />
              )}
            </DashboardFormField>
            <DashboardFormField label={t("receipt.footer")} error={fieldError(errors.footerFa?.message)}>
              {(wiring) => (
                <Textarea {...wiring} {...register("footerFa")} className={FIELD_TEXTAREA} dir="rtl" rows={2} />
              )}
            </DashboardFormField>
          </DashboardLanguageColumn>
        </div>

        {errors.root?.message ? <FormAlert>{errors.root.message}</FormAlert> : null}
        <Button type="submit" size="control-md" className="w-fit px-4" loading={isSubmitting} disabled={!isDirty}>
          {t("receipt.save")}
        </Button>
      </DashboardSection>
    </form>
  );
}
