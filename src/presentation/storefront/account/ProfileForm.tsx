"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import * as React from "react";
import { useForm } from "react-hook-form";

import { profileUpdateSchema, type ProfileUpdateInput, type ProfileWire } from "@/src/contracts/profile-schema";
import { PLACEHOLDER_USER_NAME } from "@/src/domain/entities/User";
import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { Button, FormMessage, Input, TextField } from "@/src/presentation/design-system";

import { storefrontApi } from "../storefront-api";

/**
 * Name and email. The name is what staff call out for orders and see on bookings,
 * so a guest still on the sign-in placeholder is asked to set it.
 */
export function ProfileForm({ profile }: { profile: ProfileWire }) {
  const t = useTranslations("site");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const router = useRouter();
  const [saved, setSaved] = React.useState(false);
  const isPlaceholder = profile.name === PLACEHOLDER_USER_NAME;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProfileUpdateInput>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: { name: isPlaceholder ? "" : profile.name, email: profile.email ?? "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSaved(false);
    try {
      await storefrontApi.updateProfile(values);
      setSaved(true);
      router.refresh();
    } catch (error) {
      setError("root", { message: localizeApiError(error, tApiErrors, t("account.saveError")) });
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-card-lg border border-border p-4" noValidate>
      {isPlaceholder ? <p className="text-body-small text-warning-foreground">{t("account.setName")}</p> : null}
      <TextField label={t("account.name")} required error={formErrorMessage(tFormErrors, errors.name?.message)}>
        {(control) => <Input {...control} {...register("name")} dir="auto" autoComplete="name" />}
      </TextField>
      <TextField label={t("account.email")} error={formErrorMessage(tFormErrors, errors.email?.message)}>
        {(control) => <Input {...control} {...register("email")} type="email" dir="ltr" autoComplete="email" />}
      </TextField>
      <p className="text-body-caption text-muted-foreground">
        {t("account.phone")}: <span dir="ltr">{profile.phone}</span>
      </p>
      {errors.root?.message ? <FormMessage>{errors.root.message}</FormMessage> : null}
      {saved ? <p className="text-body-small text-success-foreground">{t("account.saved")}</p> : null}
      <Button type="submit" disabled={isSubmitting} className="self-start">
        {t("account.save")}
      </Button>
    </form>
  );
}
