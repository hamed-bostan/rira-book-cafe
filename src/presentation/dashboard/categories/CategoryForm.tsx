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
import { DashboardColumns } from "@/src/presentation/dashboard/DashboardColumns";
import { DashboardFormField } from "@/src/presentation/dashboard/DashboardFormField";
import { DashboardLanguageColumn } from "@/src/presentation/dashboard/DashboardLanguageColumn";
import { DashboardPageHeader } from "@/src/presentation/dashboard/DashboardPageHeader";
import { DashboardSection } from "@/src/presentation/dashboard/DashboardSection";
import { DashboardSwitchField } from "@/src/presentation/dashboard/DashboardSwitchField";
import { FIELD_GRID, FIELD_INPUT, FIELD_PICKER, LANGUAGE_GRID } from "@/src/presentation/dashboard/fieldStyles";
import { FormAlert } from "@/src/presentation/dashboard/FormAlert";
import { ControlledChoicePicker } from "@/src/presentation/dashboard/list";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Field } from "@/src/presentation/design-system/components/form/Field/Field";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { RequiredMark } from "@/src/presentation/design-system/components/form/shared/RequiredMark";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { categoriesApi } from "./category-api";
import { IconUpload } from "./IconUpload";

/** Fields the API can return targeted `fieldErrors` for. */
const FORM_FIELDS = ["name", "slug", "iconUrl", "parentId"] as const;

/** A category this one may sit under: a top-level one other than itself. */
export type ParentOption = Pick<Category, "id" | "name">;

type CategoryFormProps = {
  /** The top-level categories it can be filed under (itself left out). */
  parents: ParentOption[];
} & (
  | { mode: "create" }
  | {
      mode: "edit";
      category: Category;
      translations: CategoryTranslationInput[];
      /**
       * It holds subcategories of its own, so it stays top-level — the parent
       * picker is shown, but locked, with the reason.
       */
      hasSubcategories: boolean;
      /** The category's history, for the narrow column. */
      activity: React.ReactNode;
    }
);

/**
 * Create/edit category form. React Hook Form + Zod (shared `categoryFormSchema`).
 * RHF's `register` is spread onto `Input` via `DashboardFormField`'s render-prop.
 * Submits over the REST API via `categoriesApi` (Axios); on success it navigates
 * back to the list, and an `ApiError` surfaces inline — field-specific messages on
 * the offending fields, otherwise at the root.
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
            parentId: props.category.parentId ?? "",
            faName: props.translations.find((translation) => translation.locale === "fa")?.name ?? "",
          }
        : { name: "", slug: "", iconUrl: "", isActive: true, parentId: "", faName: "" },
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
      router.refresh();
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
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <DashboardPageHeader
        backHref="/dashboard/categories"
        backLabel={t("backToCategories")}
        title={editing ? t("editHeading") : t("newCategory")}
        subtitle={editing ? t("editSubtitle", { name: props.category.name }) : t("createSubtitle")}
        actions={
          <>
            <Button asChild variant="secondary" size="control-md" className="px-3">
              <Link href="/dashboard/categories">{t("cancel")}</Link>
            </Button>
            <Button type="submit" size="control-md" loading={isSubmitting}>
              {editing ? t("saveChanges") : t("createCategory")}
            </Button>
          </>
        }
        alert={errors.root?.message ? <FormAlert>{errors.root.message}</FormAlert> : null}
      />

      <DashboardColumns
        main={
          /* The name is per-locale: the base row holds the source (English) name and the
             `fa` column its optional translation. */
          <DashboardSection title={t("nameLabel")} description={t("sectionNameHint")}>
            <div className={LANGUAGE_GRID}>
              <DashboardLanguageColumn label={t("localeTabBase")}>
                <DashboardFormField label={t("nameLabel")} required error={fieldError(errors.name?.message)}>
                  {(wiring) => (
                    <Input
                      {...wiring}
                      {...register("name", {
                        onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                          if (!slugLocked) setValue("slug", slugify(event.target.value), { shouldValidate: true });
                        },
                      })}
                      size="control-md"
                      inputClassName={FIELD_INPUT}
                      dir="ltr"
                      placeholder={t("namePlaceholder")}
                    />
                  )}
                </DashboardFormField>
              </DashboardLanguageColumn>

              <DashboardLanguageColumn label={t("localeTabFa")}>
                <DashboardFormField label={t("nameLabel")} error={fieldError(errors.faName?.message)}>
                  {(wiring) => (
                    <Input
                      {...wiring}
                      {...register("faName")}
                      size="control-md"
                      inputClassName={FIELD_INPUT}
                      dir="rtl"
                      placeholder={t("faNamePlaceholder")}
                    />
                  )}
                </DashboardFormField>
              </DashboardLanguageColumn>
            </div>

            <div className={FIELD_GRID}>
              <DashboardFormField
                label={t("slugLabel")}
                required
                hint={t("slugDescription")}
                error={fieldError(errors.slug?.message)}
              >
                {(wiring) => (
                  <Input
                    {...wiring}
                    {...register("slug", { onChange: () => setSlugLocked(true) })}
                    size="control-md"
                    inputClassName={FIELD_INPUT}
                    dir="ltr"
                    placeholder={t("slugPlaceholder")}
                  />
                )}
              </DashboardFormField>
            </div>
          </DashboardSection>
        }
        side={
          <>
            <DashboardSection
              title={
                <>
                  {t("iconLabel")}
                  <RequiredMark />
                </>
              }
            >
              <Field error={fieldError(errors.iconUrl?.message)}>
                {({ id, ariaDescribedBy, ariaInvalid }) => (
                  <>
                    <label htmlFor={id} className="sr-only">
                      {t("iconLabel")}
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
            </DashboardSection>

            {/* One level: a top-level category, or under one. A category with
                subcategories of its own stays top-level. */}
            <DashboardSection title={t("parentLabel")} description={t("parentHint")}>
              <DashboardFormField
                label={t("parentLabel")}
                hint={props.mode === "edit" && props.hasSubcategories ? t("parentLockedHint") : undefined}
                error={fieldError(errors.parentId?.message)}
              >
                {(wiring) => (
                  <Controller
                    control={control}
                    name="parentId"
                    render={({ field }) => (
                      <ControlledChoicePicker
                        id={wiring.id}
                        ariaInvalid={wiring["aria-invalid"]}
                        ariaDescribedBy={wiring["aria-describedby"]}
                        label={t("parentLabel")}
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                        isActive={false}
                        disabled={props.mode === "edit" && props.hasSubcategories}
                        size="control-md"
                        triggerClassName={FIELD_PICKER}
                        options={[
                          { value: "", label: t("parentNone") },
                          ...props.parents.map((parent) => ({ value: parent.id, label: parent.name })),
                        ]}
                      />
                    )}
                  />
                )}
              </DashboardFormField>
            </DashboardSection>

            <DashboardSection title={t("sectionVisibility")}>
              <Controller
                control={control}
                name="isActive"
                render={({ field }) => (
                  <DashboardSwitchField
                    label={t("activeLabel")}
                    hint={t("activeDescription")}
                    ariaLabel={t("activeAria")}
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
