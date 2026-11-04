"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

import { productFormSchema, type ProductFormInput } from "@/src/contracts/product-schema";
import type { Category } from "@/src/domain/entities/Category";
import { BOOK_AVAILABILITIES, PRODUCT_KINDS, type Product } from "@/src/domain/entities/Product";
import { DIETARY_TAGS } from "@/src/domain/entities/ProductFilters";
import type { ProductTranslationInput } from "@/src/domain/repositories/IProductRepository";
import { Link, useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { DashboardColumns } from "@/src/presentation/dashboard/DashboardColumns";
import { DashboardFormField } from "@/src/presentation/dashboard/DashboardFormField";
import { DashboardLanguageColumn } from "@/src/presentation/dashboard/DashboardLanguageColumn";
import { DashboardPageHeader } from "@/src/presentation/dashboard/DashboardPageHeader";
import { DashboardSection } from "@/src/presentation/dashboard/DashboardSection";
import { DashboardSwitchField } from "@/src/presentation/dashboard/DashboardSwitchField";
import {
  FIELD_GRID,
  FIELD_HINT,
  FIELD_INPUT,
  FIELD_LABEL,
  FIELD_PICKER,
  FIELD_TEXTAREA,
  LANGUAGE_GRID,
} from "@/src/presentation/dashboard/fieldStyles";
import { FormAlert } from "@/src/presentation/dashboard/FormAlert";
import { ControlledChoicePicker } from "@/src/presentation/dashboard/list";
import { OverviewSegmented } from "@/src/presentation/dashboard/overview/OverviewSegmented";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { ToggleChip } from "@/src/presentation/design-system/components/Chip/ToggleChip";
import { Field } from "@/src/presentation/design-system/components/form/Field/Field";
import { FormMessage } from "@/src/presentation/design-system/components/form/FormMessage/FormMessage";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { RequiredMark } from "@/src/presentation/design-system/components/form/shared/RequiredMark";
import { Textarea } from "@/src/presentation/design-system/components/form/Textarea/Textarea";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { productsApi } from "./product-api";
import { ProductImageUpload } from "./ProductImageUpload";

/** Fields the API can return targeted `fieldErrors` for. */
const FORM_FIELDS = [
  "kind",
  "name",
  "categoryId",
  "price",
  "originalPrice",
  "costPrice",
  "stockQuantity",
  "madeToOrder",
  "imageUrl",
  "badge",
  "unit",
  "description",
  "nutrition",
  "origin",
  "dietary",
  "taxExempt",
  "bookAuthor",
  "bookIsbn",
  "bookAvailability",
  "bookCopies",
] as const satisfies readonly (keyof ProductFormInput)[];

/** A dietary tag is a field, not a filter: it tints rather than fills once it's on. */
const DIETARY_CHIP =
  "h-11 gap-1.5 border px-3 text-body-default font-medium sm:h-8 sm:text-body-small data-[state=off]:border-border-strong data-[state=off]:text-foreground/80 data-[state=on]:border-accent-border data-[state=on]:bg-accent data-[state=on]:text-accent-foreground";

type ProductFormProps =
  | { mode: "create"; categories: Category[] }
  | {
      mode: "edit";
      categories: Category[];
      product: Product;
      translations: ProductTranslationInput[];
      /** The item's history, for the narrow column. */
      activity: React.ReactNode;
    };

/** Build the form's initial values, coercing the numeric/optional domain fields to the string controls. */
function toDefaults(product?: Product, translations?: ProductTranslationInput[]): ProductFormInput {
  const fa = translations?.find((translation) => translation.locale === "fa");
  return {
    // Drinks are the bulk of a cafe menu, so a new item starts as one.
    kind: product?.kind ?? "drink",
    name: product?.name ?? "",
    categoryId: product?.categoryId ?? "",
    price: product != null ? String(product.price) : "",
    originalPrice: product?.originalPrice != null ? String(product.originalPrice) : "",
    costPrice: product?.costPrice != null ? String(product.costPrice) : "",
    stockQuantity: product != null ? String(product.stockQuantity) : "",
    // Counted unless staff say otherwise, matching the column.
    madeToOrder: product?.madeToOrder ?? false,
    imageUrl: product?.imageUrl ?? "",
    isFeatured: product?.isFeatured ?? false,
    // A new product is live by default, matching the column — an operator who wants
    // to stage one unpublishes it deliberately.
    isPublished: product?.isPublished ?? true,
    badge: product?.badge ?? "",
    unit: product?.unit ?? "",
    description: product?.description ?? "",
    nutrition: product?.nutrition ?? "",
    origin: product?.origin ?? "",
    dietary: product?.dietary ?? [],
    // A new product is exempt by default, matching the column — an operator opts a
    // product *in* to VAT deliberately.
    taxExempt: product?.taxExempt ?? false,
    bookAuthor: product?.book?.author ?? "",
    bookIsbn: product?.book?.isbn ?? "",
    bookAvailability: product?.book?.availability ?? "sale",
    bookCopies: product?.book?.copies != null ? String(product.book.copies) : "",
    faName: fa?.name ?? "",
    faUnit: fa?.unit ?? "",
    faDescription: fa?.description ?? "",
    faNutrition: fa?.nutrition ?? "",
    faOrigin: fa?.origin ?? "",
  };
}

/**
 * Create/edit product form. React Hook Form + Zod (shared `productFormSchema`).
 * Numeric fields are authored as strings; the schema *validates* them but the
 * resolver runs in `raw` mode so the form keeps (and submits) the string input
 * shape — the route handler's schema is what coerces it to the numeric domain
 * model. Submits over the REST API via `productsApi` (Axios); on success it
 * navigates back to the list, and an `ApiError` surfaces inline — field-specific
 * messages on the offending fields, otherwise at the root.
 */
export function ProductForm(props: ProductFormProps) {
  const t = useTranslations("dashProducts");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  // Field errors arrive as `formErrors` keys — from the client resolver and the
  // API's `fieldErrors` alike — and resolve to copy here, at display time.
  const fieldError = (message?: string): string | undefined => formErrorMessage(tFormErrors, message);
  // Closed vocabulary stored as canonical English keys — the checkbox still submits
  // `tag`; only its label follows the admin's locale.
  const tDietary = useTranslations("dietary");
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
  } = useForm<ProductFormInput>({
    resolver: zodResolver(productFormSchema, undefined, { raw: true }),
    defaultValues: toDefaults(editing ? props.product : undefined, editing ? props.translations : undefined),
  });

  const dietaryLabelId = React.useId();
  const imageUrl = useWatch({ control, name: "imageUrl" });
  const kind = useWatch({ control, name: "kind" });
  const madeToOrder = useWatch({ control, name: "madeToOrder" });
  // A book Inventory counts: its copies are received, counted and written off
  // there, so the stock here is shown, not edited. Found by name in the stock list.
  const inventoryHref =
    props.mode === "edit" && props.product.inventoryTracked
      ? `/dashboard/inventory?q=${encodeURIComponent(props.product.name)}`
      : undefined;
  const stockInInventory = inventoryHref !== undefined;

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (editing) await productsApi.update(props.product.id, values);
      else await productsApi.create(values);
      toast({ tone: "success", title: t(editing ? "saved" : "created", { name: values.name.trim() }) });
      router.push("/dashboard/products");
      router.refresh();
    } catch (error) {
      if (!(error instanceof ApiError)) {
        setError("root", { message: t("formError") });
        return;
      }
      // Prefer field-level messages so they read in context; fall back to a single
      // root message when the API didn't scope the error.
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
        backHref="/dashboard/products"
        backLabel={t("backToProducts")}
        title={editing ? t("editHeading") : t("newProduct")}
        subtitle={editing ? t("editSubtitle", { name: props.product.name }) : t("createSubtitle")}
        actions={
          <>
            <Button asChild variant="secondary" size="control-md" className="px-3">
              <Link href="/dashboard/products">{t("cancel")}</Link>
            </Button>
            <Button type="submit" size="control-md" loading={isSubmitting}>
              {editing ? t("saveChanges") : t("createProduct")}
            </Button>
          </>
        }
        alert={errors.root?.message ? <FormAlert>{errors.root.message}</FormAlert> : null}
      />

      <DashboardColumns
        main={
          <>
            <DashboardSection title={t("sectionBasics")}>
              <div className="flex flex-col gap-1.5">
                <span className={FIELD_LABEL}>
                  {t("kindLabel")}
                  <RequiredMark />
                </span>
                <Controller
                  control={control}
                  name="kind"
                  render={({ field }) => (
                    <OverviewSegmented
                      label={t("kindLabel")}
                      value={field.value}
                      options={PRODUCT_KINDS.map((option) => ({ value: option, label: t(`kind.${option}`) }))}
                      onChange={field.onChange}
                      fill
                    />
                  )}
                />
                {errors.kind?.message ? <FormMessage>{fieldError(errors.kind.message)}</FormMessage> : null}
              </div>

              <DashboardFormField label={t("categoryLabel")} required error={fieldError(errors.categoryId?.message)}>
                {(wiring) => (
                  <Controller
                    control={control}
                    name="categoryId"
                    render={({ field }) => (
                      <ControlledChoicePicker
                        id={wiring.id}
                        ariaInvalid={wiring["aria-invalid"]}
                        ariaDescribedBy={wiring["aria-describedby"]}
                        label={t("categoryLabel")}
                        placeholder={t("selectCategory")}
                        value={field.value}
                        onValueChange={field.onChange}
                        isActive={false}
                        size="control-md"
                        triggerClassName={FIELD_PICKER}
                        options={props.categories.map((category) => ({ value: category.id, label: category.name }))}
                      />
                    )}
                  />
                )}
              </DashboardFormField>
            </DashboardSection>

            {/* The guest-facing copy is per-locale: the base row holds the source (English)
                text and the `fa` column its optional translation. Everything else (price,
                stock, image, category…) is locale-independent, so it lives once on the base row. */}
            <DashboardSection title={t("sectionText")} description={t("sectionTextHint")}>
              <div className={LANGUAGE_GRID}>
                <DashboardLanguageColumn label={t("localeTabBase")}>
                  <DashboardFormField label={t("nameLabel")} required error={fieldError(errors.name?.message)}>
                    {(wiring) => (
                      <Input
                        {...wiring}
                        {...register("name")}
                        size="control-md"
                        inputClassName={FIELD_INPUT}
                        dir="ltr"
                        placeholder={t("namePlaceholder")}
                      />
                    )}
                  </DashboardFormField>

                  <DashboardFormField
                    label={t("unitLabel")}
                    hint={t("unitDescription")}
                    error={fieldError(errors.unit?.message)}
                  >
                    {(wiring) => (
                      <Input
                        {...wiring}
                        {...register("unit")}
                        size="control-md"
                        inputClassName={FIELD_INPUT}
                        dir="ltr"
                        placeholder={t("unitPlaceholder")}
                      />
                    )}
                  </DashboardFormField>

                  <DashboardFormField
                    label={t("descriptionLabel")}
                    hint={t("descriptionHelp")}
                    error={fieldError(errors.description?.message)}
                  >
                    {(wiring) => (
                      <Textarea
                        {...wiring}
                        {...register("description")}
                        className={FIELD_TEXTAREA}
                        rows={4}
                        dir="ltr"
                        placeholder={t("descriptionPlaceholder")}
                      />
                    )}
                  </DashboardFormField>

                  <DashboardFormField
                    label={t("nutritionLabel")}
                    hint={t("nutritionHelp")}
                    error={fieldError(errors.nutrition?.message)}
                  >
                    {(wiring) => (
                      <Textarea
                        {...wiring}
                        {...register("nutrition")}
                        className={FIELD_TEXTAREA}
                        rows={4}
                        dir="ltr"
                        placeholder={t("nutritionPlaceholder")}
                      />
                    )}
                  </DashboardFormField>

                  <DashboardFormField
                    label={t("originLabel")}
                    hint={t("originHelp")}
                    error={fieldError(errors.origin?.message)}
                  >
                    {(wiring) => (
                      <Textarea
                        {...wiring}
                        {...register("origin")}
                        className={FIELD_TEXTAREA}
                        rows={4}
                        dir="ltr"
                        placeholder={t("originPlaceholder")}
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

                  <DashboardFormField
                    label={t("unitLabel")}
                    hint={t("unitDescription")}
                    error={fieldError(errors.faUnit?.message)}
                  >
                    {(wiring) => (
                      <Input
                        {...wiring}
                        {...register("faUnit")}
                        size="control-md"
                        inputClassName={FIELD_INPUT}
                        dir="rtl"
                        placeholder={t("faUnitPlaceholder")}
                      />
                    )}
                  </DashboardFormField>

                  <DashboardFormField
                    label={t("descriptionLabel")}
                    hint={t("descriptionHelp")}
                    error={fieldError(errors.faDescription?.message)}
                  >
                    {(wiring) => (
                      <Textarea
                        {...wiring}
                        {...register("faDescription")}
                        className={FIELD_TEXTAREA}
                        rows={4}
                        dir="rtl"
                        placeholder={t("faDescriptionPlaceholder")}
                      />
                    )}
                  </DashboardFormField>

                  <DashboardFormField
                    label={t("nutritionLabel")}
                    hint={t("nutritionHelp")}
                    error={fieldError(errors.faNutrition?.message)}
                  >
                    {(wiring) => (
                      <Textarea
                        {...wiring}
                        {...register("faNutrition")}
                        className={FIELD_TEXTAREA}
                        rows={4}
                        dir="rtl"
                        placeholder={t("faNutritionPlaceholder")}
                      />
                    )}
                  </DashboardFormField>

                  <DashboardFormField
                    label={t("originLabel")}
                    hint={t("originHelp")}
                    error={fieldError(errors.faOrigin?.message)}
                  >
                    {(wiring) => (
                      <Textarea
                        {...wiring}
                        {...register("faOrigin")}
                        className={FIELD_TEXTAREA}
                        rows={4}
                        dir="rtl"
                        placeholder={t("faOriginPlaceholder")}
                      />
                    )}
                  </DashboardFormField>
                </DashboardLanguageColumn>
              </div>
            </DashboardSection>

            {kind === "book" ? (
              <DashboardSection title={t("bookLegend")}>
                <div className={FIELD_GRID}>
                  <DashboardFormField
                    label={t("bookAuthorLabel")}
                    required
                    error={fieldError(errors.bookAuthor?.message)}
                  >
                    {(wiring) => (
                      <Input
                        {...wiring}
                        {...register("bookAuthor")}
                        size="control-md"
                        inputClassName={FIELD_INPUT}
                        dir="auto"
                        placeholder={t("bookAuthorPlaceholder")}
                      />
                    )}
                  </DashboardFormField>

                  <DashboardFormField
                    label={t("bookIsbnLabel")}
                    hint={t("bookIsbnDescription")}
                    error={fieldError(errors.bookIsbn?.message)}
                  >
                    {(wiring) => (
                      <Input
                        {...wiring}
                        {...register("bookIsbn")}
                        size="control-md"
                        inputClassName={FIELD_INPUT}
                        dir="ltr"
                        inputMode="numeric"
                        placeholder="978-600-..."
                      />
                    )}
                  </DashboardFormField>

                  <DashboardFormField
                    label={t("bookCopiesLabel")}
                    hint={t("bookCopiesDescription")}
                    error={fieldError(errors.bookCopies?.message)}
                  >
                    {(wiring) => (
                      <Input
                        {...wiring}
                        {...register("bookCopies")}
                        size="control-md"
                        inputClassName={FIELD_INPUT}
                        dir="ltr"
                        inputMode="numeric"
                        placeholder="1"
                      />
                    )}
                  </DashboardFormField>

                  <DashboardFormField
                    label={t("bookAvailabilityLabel")}
                    required
                    error={fieldError(errors.bookAvailability?.message)}
                  >
                    {(wiring) => (
                      <Controller
                        control={control}
                        name="bookAvailability"
                        render={({ field }) => (
                          <ControlledChoicePicker
                            id={wiring.id}
                            ariaInvalid={wiring["aria-invalid"]}
                            ariaDescribedBy={wiring["aria-describedby"]}
                            label={t("bookAvailabilityLabel")}
                            value={field.value}
                            onValueChange={(value) => field.onChange(value)}
                            isActive={false}
                            size="control-md"
                            triggerClassName={FIELD_PICKER}
                            options={BOOK_AVAILABILITIES.map((value) => ({
                              value,
                              label: t(`bookAvailability.${value}`),
                            }))}
                          />
                        )}
                      />
                    )}
                  </DashboardFormField>
                </div>
              </DashboardSection>
            ) : null}

            <DashboardSection title={t("priceLabel")}>
              <div className={FIELD_GRID}>
                <DashboardFormField
                  label={t("priceLabel")}
                  required
                  hint={t("priceDescription")}
                  error={fieldError(errors.price?.message)}
                >
                  {(wiring) => (
                    <Input
                      {...wiring}
                      {...register("price")}
                      size="control-md"
                      inputClassName={FIELD_INPUT}
                      inputMode="numeric"
                      placeholder={t("pricePlaceholder")}
                    />
                  )}
                </DashboardFormField>

                <DashboardFormField
                  label={t("originalPriceLabel")}
                  hint={t("originalPriceDescription")}
                  error={fieldError(errors.originalPrice?.message)}
                >
                  {(wiring) => (
                    <Input
                      {...wiring}
                      {...register("originalPrice")}
                      size="control-md"
                      inputClassName={FIELD_INPUT}
                      inputMode="numeric"
                      placeholder={t("pricePlaceholder")}
                    />
                  )}
                </DashboardFormField>

                <DashboardFormField
                  label={t("costPriceLabel")}
                  hint={t("costPriceDescription")}
                  error={fieldError(errors.costPrice?.message)}
                >
                  {(wiring) => (
                    <Input
                      {...wiring}
                      {...register("costPrice")}
                      size="control-md"
                      inputClassName={FIELD_INPUT}
                      inputMode="numeric"
                      placeholder={t("pricePlaceholder")}
                    />
                  )}
                </DashboardFormField>
              </div>
            </DashboardSection>

            <DashboardSection title={t("stockLabel")}>
              <Controller
                control={control}
                name="madeToOrder"
                render={({ field }) => (
                  <DashboardSwitchField
                    label={t("madeToOrderLabel")}
                    hint={t("madeToOrderDescription")}
                    ariaLabel={t("madeToOrderAria")}
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />

              {/* A made-to-order item isn't counted: no stock to enter, and the saved count
                  is left as it is. The value stays in the form, so switching back restores it. */}
              {madeToOrder ? null : (
                <div className={FIELD_GRID}>
                  <DashboardFormField
                    label={t("stockLabel")}
                    required={!stockInInventory}
                    hint={
                      inventoryHref
                        ? t.rich("stockInInventory", {
                            link: (chunks) => (
                              <Link
                                href={inventoryHref}
                                className="font-medium text-primary underline underline-offset-4 hover:text-primary-hover"
                              >
                                {chunks}
                              </Link>
                            ),
                          })
                        : t("stockDescription")
                    }
                    error={fieldError(errors.stockQuantity?.message)}
                  >
                    {(wiring) => (
                      // A book Inventory counts shows its copies here, but they
                      // change only there: the API leaves this field out of the save.
                      <Input
                        {...wiring}
                        {...register("stockQuantity")}
                        readOnly={stockInInventory}
                        size="control-md"
                        inputClassName={FIELD_INPUT}
                        inputMode="numeric"
                        placeholder={t("stockPlaceholder")}
                      />
                    )}
                  </DashboardFormField>
                </div>
              )}
            </DashboardSection>
          </>
        }
        side={
          <>
            <DashboardSection
              title={
                <>
                  {t("imageLabel")}
                  <RequiredMark />
                </>
              }
            >
              <Field error={fieldError(errors.imageUrl?.message)}>
                {({ id, ariaDescribedBy, ariaInvalid }) => (
                  <>
                    <label htmlFor={id} className="sr-only">
                      {t("imageLabel")}
                    </label>
                    <ProductImageUpload
                      id={id}
                      value={imageUrl}
                      onChange={(url) => setValue("imageUrl", url, { shouldValidate: true })}
                      aria-invalid={ariaInvalid}
                      aria-describedby={ariaDescribedBy}
                    />
                  </>
                )}
              </Field>
              {/* Keeps imageUrl registered (set imperatively by ProductImageUpload) so it's tracked + submitted. */}
              <input type="hidden" {...register("imageUrl")} />
            </DashboardSection>

            <DashboardSection title={t("sectionOnMenu")}>
              <DashboardFormField
                label={t("badgeLabel")}
                hint={t("badgeDescription")}
                error={fieldError(errors.badge?.message)}
              >
                {(wiring) => (
                  <Input
                    {...wiring}
                    {...register("badge")}
                    size="control-md"
                    inputClassName={FIELD_INPUT}
                    dir="ltr"
                    placeholder={t("badgePlaceholder")}
                  />
                )}
              </DashboardFormField>

              <Controller
                control={control}
                name="dietary"
                render={({ field }) => (
                  <div role="group" aria-labelledby={dietaryLabelId} className="flex flex-col gap-1.5">
                    <span id={dietaryLabelId} className={FIELD_LABEL}>
                      {t("dietaryLegend")}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {DIETARY_TAGS.map((tag) => {
                        const checked = field.value?.includes(tag) ?? false;
                        return (
                          <ToggleChip
                            key={tag}
                            className={DIETARY_CHIP}
                            pressed={checked}
                            onPressedChange={(pressed) =>
                              field.onChange(
                                pressed
                                  ? [...(field.value ?? []), tag]
                                  : (field.value ?? []).filter((item: string) => item !== tag),
                              )
                            }
                          >
                            {checked ? <Icon icon={Check} size="sm" strokeWidth={2} /> : null}
                            {tDietary(tag)}
                          </ToggleChip>
                        );
                      })}
                    </div>
                    <p className={FIELD_HINT}>{t("dietaryDescription")}</p>
                  </div>
                )}
              />

              <Controller
                control={control}
                name="isFeatured"
                render={({ field }) => (
                  <DashboardSwitchField
                    label={t("featuredLabel")}
                    hint={t("featuredDescription")}
                    ariaLabel={t("featuredAria")}
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />

              <Controller
                control={control}
                name="isPublished"
                render={({ field }) => (
                  <DashboardSwitchField
                    label={t("publishedLabel")}
                    hint={t("publishedDescription")}
                    ariaLabel={t("publishedAria")}
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />

              <Controller
                control={control}
                name="taxExempt"
                render={({ field }) => (
                  <DashboardSwitchField
                    label={t("taxExemptLabel")}
                    hint={t("taxExemptDescription")}
                    ariaLabel={t("taxExemptAria")}
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
