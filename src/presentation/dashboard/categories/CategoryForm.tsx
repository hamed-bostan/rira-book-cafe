"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

import { categoryFormSchema, type CategoryFormInput } from "@/src/contracts/category-schema";
import type { Category } from "@/src/domain/entities/Category";
import type { CategoryTranslationInput } from "@/src/domain/repositories/ICategoryRepository";
import { Link, useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { slugify } from "@/src/lib/slugify";
import { Button, Field, FormMessage, Input, RequiredMark, Switch, Tabs, TabsContent, TabsList, TabsTrigger, TextField, useToast } from "@/src/presentation/design-system";

import { categoriesApi } from "./category-api";
import { IconUpload } from "./IconUpload";

/** Fields the API can return targeted `fieldErrors` for. */
const FORM_FIELDS = ["name", "slug", "iconUrl"] as const;

type CategoryFormProps =
  | { mode: "create" }
  | { mode: "edit"; category: Category; translations: CategoryTranslationInput[] };

/**
 * Create/edit category form. React Hook Form + Zod (shared `categoryFormSchema`).
 * The DS fields aren't `forwardRef`, so RHF's `register` is spread onto `Input`
 * via `TextField`'s render-prop. Submits over the REST API via `categoriesApi`
 * (Axios); on success it navigates back to the list, and an `ApiError` surfaces
 * inline — field-specific messages on the offending fields, otherwise at the root.
 */
export function CategoryForm(props: CategoryFormProps) {
  const t = useTranslations("dashCategories");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  // Field errors arrive as `formErrors` keys — from the client resolver and the
  // API's `fieldErrors` alike — and resolve to copy here, at display time.
  const fieldError = (message?: string): string | undefined => formErrorMessage(tFormErrors, message);
  const editing = props.mode === "edit";
  const router = useRouter();
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    setValue,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormInput>({
    resolver: zodResolver(categoryFormSchema, undefined, { raw: true }),
    defaultValues:
      props.mode === "edit"
        ? {
            name: props.category.name,
            slug: props.category.slug,
            iconUrl: props.category.iconUrl,
            isActive: props.category.isActive,
            faName: props.translations.find((translation) => translation.locale === "fa")?.name ?? "",
          }
        : { name: "", slug: "", iconUrl: "", isActive: true, faName: "" },
  });

  // Mirror the name into the slug until the user edits the slug directly (and
  // never auto-overwrite an existing slug when editing).
  const [slugLocked, setSlugLocked] = React.useState(editing);
  const iconUrl = useWatch({ control, name: "iconUrl" });

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (editing) await categoriesApi.update(props.category.id, values);
      else await categoriesApi.create(values);
      toast({ tone: "success", title: editing ? t("savedToast") : t("createdToast") });
      router.push("/dashboard/categories");
    } catch (error) {
      if (!(error instanceof ApiError)) {
        setError("root", { message: t("formError") });
        return;
      }
      // Prefer field-level messages (e.g. a taken slug) so they read in context;
      // fall back to a single root message when the API didn't scope the error.
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
      {/* The name is per-locale: the base row holds the source (English) name and the
          `fa` tab its optional translation. Both panels stay mounted (`forceMount`) so
          switching tabs never drops a value or hides a server-side field error. */}
      <Tabs defaultValue="base">
        <TabsList>
          <TabsTrigger value="base">{t("localeTabBase")}</TabsTrigger>
          <TabsTrigger value="fa">{t("localeTabFa")}</TabsTrigger>
        </TabsList>

        <TabsContent value="base" forceMount className="flex flex-col gap-5 pt-4 data-[state=inactive]:hidden">
          <p className="text-body-caption text-muted-foreground">{t("baseTabDescription")}</p>

          <TextField label={t("nameLabel")} required error={fieldError(errors.name?.message)}>
            {(control) => (
              <Input
                {...control}
                {...register("name", {
                  onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                    if (!slugLocked) setValue("slug", slugify(event.target.value), { shouldValidate: true });
                  },
                })}
                dir="ltr"
                placeholder={t("namePlaceholder")}
              />
            )}
          </TextField>
        </TabsContent>

        <TabsContent value="fa" forceMount className="flex flex-col gap-5 pt-4 data-[state=inactive]:hidden">
          <p className="text-body-caption text-muted-foreground">{t("translationDescription")}</p>

          <TextField label={t("nameLabel")} error={fieldError(errors.faName?.message)}>
            {(control) => <Input {...control} {...register("faName")} dir="rtl" placeholder={t("faNamePlaceholder")} />}
          </TextField>
        </TabsContent>
      </Tabs>

      <TextField
        label={t("slugLabel")}
        required
        description={t("slugDescription")}
        error={fieldError(errors.slug?.message)}
      >
        {(control) => (
          <Input
            {...control}
            {...register("slug", { onChange: () => setSlugLocked(true) })}
            dir="ltr"
            placeholder={t("slugPlaceholder")}
          />
        )}
      </TextField>

      <Field error={fieldError(errors.iconUrl?.message)}>
        {({ id, ariaDescribedBy, ariaInvalid }) => (
          <>
            <label htmlFor={id} className="text-body-small-emphasis text-input-foreground">
              {t("iconLabel")}
              <RequiredMark />
            </label>
            <IconUpload
              id={id}
              value={iconUrl}
              onChange={(url) => setValue("iconUrl", url, { shouldValidate: true })}
              aria-invalid={ariaInvalid}
              aria-describedby={ariaDescribedBy}
            />
          </>
        )}
      </Field>
      {/* Keeps iconUrl registered (set imperatively by IconUpload) so it's tracked + submitted. */}
      <input type="hidden" {...register("iconUrl")} />

      <Controller
        control={control}
        name="isActive"
        render={({ field }) => (
          <div className="flex items-center justify-between rounded-card-md border border-border px-4 py-3">
            <div>
              <label htmlFor="isActive" className="text-body-small-emphasis text-input-foreground">
                {t("activeLabel")}
              </label>
              <p className="text-body-caption text-muted-foreground">{t("activeDescription")}</p>
            </div>
            <Switch
              id="isActive"
              checked={field.value}
              onCheckedChange={field.onChange}
              aria-label={t("activeAria")}
            />
          </div>
        )}
      />

      {errors.root?.message && (
        <FormMessage size="md">{errors.root.message}</FormMessage>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={isSubmitting}>
          {editing ? t("saveChanges") : t("createCategory")}
        </Button>
        <Button asChild variant="outline" type="button">
          <Link href="/dashboard/categories">{t("cancel")}</Link>
        </Button>
      </div>
    </form>
  );
}
