"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";

import type { ProfileWire } from "@/src/contracts/profile-response-schema";
import { profileUpdateSchema, type ProfileUpdateInput } from "@/src/contracts/profile-schema";
import { PLACEHOLDER_USER_NAME } from "@/src/domain/entities/User";
import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { FormMessage } from "@/src/presentation/design-system/components/form/FormMessage/FormMessage";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { TextField } from "@/src/presentation/design-system/components/form/TextField/TextField";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

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
  const { toast } = useToast();
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
    try {
      await storefrontApi.updateProfile(values);
      toast({ tone: "success", title: t("account.saved") });
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
      <Button type="submit" loading={isSubmitting} className="self-start">
        {t("account.save")}
      </Button>
    </form>
  );
}
