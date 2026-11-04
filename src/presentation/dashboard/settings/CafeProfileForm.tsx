"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { useForm, useWatch } from "react-hook-form";

import { cafeProfileSchema, type CafeProfileFormInput } from "@/src/contracts/cafe-settings-schema";
import { mapUrl, type CafeProfile } from "@/src/domain/entities/CafeSettings";
import { useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { cn } from "@/src/lib/utils";
import { DashboardFormField } from "@/src/presentation/dashboard/DashboardFormField";
import { DashboardLanguageColumn } from "@/src/presentation/dashboard/DashboardLanguageColumn";
import { DashboardSection } from "@/src/presentation/dashboard/DashboardSection";
import {
  FIELD_GRID,
  FIELD_INPUT,
  FIELD_TEXTAREA,
  LANGUAGE_GRID,
  TEXT_ACTION,
} from "@/src/presentation/dashboard/fieldStyles";
import { FormAlert } from "@/src/presentation/dashboard/FormAlert";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Textarea } from "@/src/presentation/design-system/components/form/Textarea/Textarea";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { cafeSettingsApi } from "./cafe-settings-api";

const FIELDS = [
  "name",
  "nameFa",
  "address",
  "addressFa",
  "phone",
  "instagram",
  "website",
  "latitude",
  "longitude",
] as const satisfies readonly (keyof CafeProfileFormInput)[];

const COORDINATE = /^-?\d{1,3}(\.\d+)?$/;

function toDefaults(profile: CafeProfile): CafeProfileFormInput {
  return {
    name: profile.name ?? "",
    nameFa: profile.nameFa ?? "",
    address: profile.address ?? "",
    addressFa: profile.addressFa ?? "",
    phone: profile.phone ?? "",
    instagram: profile.instagram ?? "",
    website: profile.website ?? "",
    latitude: profile.latitude !== undefined ? String(profile.latitude) : "",
    longitude: profile.longitude !== undefined ? String(profile.longitude) : "",
  };
}

/**
 * Who and where the cafe is: its name and address in both languages, phone,
 * Instagram, website and map position. The site's home page, structured data and
 * receipts read them; a blank field is left out there (the name falls back to the
 * site's own). The map position can be checked on OpenStreetMap before saving.
 */
export function CafeProfileForm({ profile }: { profile: CafeProfile }) {
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
  } = useForm<CafeProfileFormInput>({
    resolver: zodResolver(cafeProfileSchema, undefined, { raw: true }),
    defaultValues: toDefaults(profile),
  });

  const [latitude, longitude] = useWatch({ control, name: ["latitude", "longitude"] });
  const preview =
    COORDINATE.test(latitude.trim()) && COORDINATE.test(longitude.trim())
      ? mapUrl(Number(latitude), Number(longitude))
      : null;

  const onSubmit = handleSubmit(async (values) => {
    try {
      const saved = await cafeSettingsApi.updateProfile(values);
      reset(toDefaults(saved.profile));
      toast({ tone: "success", title: t("profile.saved") });
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

  return (
    <form onSubmit={onSubmit} noValidate aria-label={t("profile.heading")}>
      <DashboardSection title={t("profile.heading")} description={t("profile.description")}>
        <div className={LANGUAGE_GRID}>
          <DashboardLanguageColumn label={t("languageEn")}>
            <DashboardFormField
              label={t("profile.name")}
              hint={t("profile.nameHint")}
              error={fieldError(errors.name?.message)}
            >
              {(wiring) => (
                <Input {...wiring} {...register("name")} size="control-md" inputClassName={FIELD_INPUT} dir="auto" />
              )}
            </DashboardFormField>
            <DashboardFormField label={t("profile.address")} error={fieldError(errors.address?.message)}>
              {(wiring) => (
                <Textarea {...wiring} {...register("address")} className={FIELD_TEXTAREA} dir="auto" rows={3} />
              )}
            </DashboardFormField>
          </DashboardLanguageColumn>
          <DashboardLanguageColumn label={t("languageFa")}>
            <DashboardFormField label={t("profile.name")} error={fieldError(errors.nameFa?.message)}>
              {(wiring) => (
                <Input {...wiring} {...register("nameFa")} size="control-md" inputClassName={FIELD_INPUT} dir="rtl" />
              )}
            </DashboardFormField>
            <DashboardFormField label={t("profile.address")} error={fieldError(errors.addressFa?.message)}>
              {(wiring) => (
                <Textarea {...wiring} {...register("addressFa")} className={FIELD_TEXTAREA} dir="rtl" rows={3} />
              )}
            </DashboardFormField>
          </DashboardLanguageColumn>
        </div>

        <div className={FIELD_GRID}>
          <DashboardFormField label={t("profile.phone")} error={fieldError(errors.phone?.message)}>
            {(wiring) => (
              <Input
                {...wiring}
                {...register("phone")}
                size="control-md"
                inputClassName={FIELD_INPUT}
                type="tel"
                dir="ltr"
                placeholder="021 1234 5678"
              />
            )}
          </DashboardFormField>
          <DashboardFormField
            label={t("profile.instagram")}
            hint={t("profile.instagramHint")}
            error={fieldError(errors.instagram?.message)}
          >
            {(wiring) => (
              <Input
                {...wiring}
                {...register("instagram")}
                size="control-md"
                inputClassName={FIELD_INPUT}
                dir="ltr"
                placeholder="rira.cafe"
              />
            )}
          </DashboardFormField>
          <DashboardFormField label={t("profile.website")} error={fieldError(errors.website?.message)}>
            {(wiring) => (
              <Input
                {...wiring}
                {...register("website")}
                size="control-md"
                inputClassName={FIELD_INPUT}
                type="url"
                dir="ltr"
                placeholder="https://"
              />
            )}
          </DashboardFormField>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className={FIELD_GRID}>
            <DashboardFormField label={t("profile.latitude")} error={fieldError(errors.latitude?.message)}>
              {(wiring) => (
                <Input
                  {...wiring}
                  {...register("latitude")}
                  size="control-md"
                  inputClassName={FIELD_INPUT}
                  inputMode="decimal"
                  dir="ltr"
                  placeholder="35.6997"
                />
              )}
            </DashboardFormField>
            <DashboardFormField label={t("profile.longitude")} error={fieldError(errors.longitude?.message)}>
              {(wiring) => (
                <Input
                  {...wiring}
                  {...register("longitude")}
                  size="control-md"
                  inputClassName={FIELD_INPUT}
                  inputMode="decimal"
                  dir="ltr"
                  placeholder="51.3380"
                />
              )}
            </DashboardFormField>
          </div>
          {preview ? (
            <a
              href={preview}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                TEXT_ACTION,
                "flex w-fit items-center gap-1.5 text-primary hover:text-primary-hover",
                focusRing,
              )}
            >
              {t("profile.checkMap")}
              <Icon icon={ExternalLink} size="xs" />
            </a>
          ) : null}
        </div>

        {errors.root?.message ? <FormAlert>{errors.root.message}</FormAlert> : null}
        <Button type="submit" size="control-md" className="w-fit px-4" loading={isSubmitting} disabled={!isDirty}>
          {t("profile.save")}
        </Button>
      </DashboardSection>
    </form>
  );
}
