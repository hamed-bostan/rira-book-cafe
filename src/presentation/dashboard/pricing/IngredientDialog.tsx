"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PenLine, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

import { ingredientSchema, type IngredientFormInput } from "@/src/contracts/pricing-schema";
import { INGREDIENT_UNITS, type Ingredient } from "@/src/domain/entities/Pricing";
import { useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { cn } from "@/src/lib/utils";
import { DashboardDialog } from "@/src/presentation/dashboard/DashboardDialog";
import { DashboardFormField } from "@/src/presentation/dashboard/DashboardFormField";
import { DashboardSwitchField } from "@/src/presentation/dashboard/DashboardSwitchField";
import { FIELD_HINT, FIELD_INPUT } from "@/src/presentation/dashboard/fieldStyles";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Select } from "@/src/presentation/design-system/components/form/Select/Select";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { ingredientsApi } from "./pricing-api";

const FIELDS = ["name", "unit", "purchasePrice", "purchaseQuantity"] as const;

function toDefaults(ingredient?: Ingredient): IngredientFormInput {
  return {
    name: ingredient?.name ?? "",
    unit: ingredient?.unit ?? "g",
    purchasePrice: ingredient ? String(ingredient.purchasePrice) : "",
    purchaseQuantity: ingredient ? String(ingredient.purchaseQuantity) : "",
    isActive: ingredient?.isActive ?? true,
  };
}

/** Add an ingredient, or edit one — a new purchase price re-costs every recipe using it. */
export function IngredientDialog({ ingredient }: { ingredient?: Ingredient }) {
  const t = useTranslations("dashPricing");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const fieldError = (message?: string): string | undefined => formErrorMessage(tFormErrors, message);
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);

  const {
    register,
    handleSubmit,
    control,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<IngredientFormInput>({
    resolver: zodResolver(ingredientSchema, undefined, { raw: true }),
    defaultValues: toDefaults(ingredient),
  });
  const unit = useWatch({ control, name: "unit" });

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (ingredient) await ingredientsApi.update(ingredient.id, values);
      else await ingredientsApi.create(values);
      setOpen(false);
      if (!ingredient) reset(toDefaults());
      toast({ tone: "success", title: t("ingredients.saved", { name: values.name.trim() }) });
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
      if (!applied) setError("root", { message: localizeApiError(error, tApiErrors, t("ingredients.error")) });
    }
  });

  return (
    <>
      {ingredient ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t("ingredients.edit", { name: ingredient.name })}
          title={t("ingredients.edit", { name: ingredient.name })}
          className={cn(
            "flex size-11 items-center justify-center rounded-button text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:size-8",
            focusRing,
          )}
        >
          <Icon icon={PenLine} size="icon-md" />
        </button>
      ) : (
        <Button type="button" variant="secondary" size="control-md" className="px-3" onClick={() => setOpen(true)}>
          <Icon icon={Plus} size="icon-md" className="me-2" />
          {t("ingredients.new")}
        </Button>
      )}
      <DashboardDialog
        open={open}
        onOpenChange={setOpen}
        title={ingredient ? ingredient.name : t("ingredients.new")}
        subtitle={null}
        submitLabel={t("save")}
        backLabel={t("cancel")}
        pending={isSubmitting}
        onSubmit={() => void onSubmit()}
        error={errors.root?.message}
      >
        <DashboardFormField label={t("ingredients.nameLabel")} required error={fieldError(errors.name?.message)}>
          {(wiring) => (
            <Input
              {...wiring}
              {...register("name")}
              size="control-md"
              inputClassName={FIELD_INPUT}
              dir="auto"
              placeholder={t("ingredients.namePlaceholder")}
            />
          )}
        </DashboardFormField>
        <DashboardFormField label={t("ingredients.unitLabel")} error={fieldError(errors.unit?.message)}>
          {(wiring) => (
            <Select {...wiring} {...register("unit")} size="control-md" className="border-border-strong">
              {INGREDIENT_UNITS.map((option) => (
                <option key={option} value={option}>
                  {t(`unitName.${option}`)}
                </option>
              ))}
            </Select>
          )}
        </DashboardFormField>
        <div className="grid grid-cols-2 gap-3">
          <DashboardFormField
            label={t("ingredients.priceLabel")}
            required
            error={fieldError(errors.purchasePrice?.message)}
          >
            {(wiring) => (
              <Input
                {...wiring}
                {...register("purchasePrice")}
                size="control-md"
                inputClassName={cn(FIELD_INPUT, "tabular-nums")}
                inputMode="numeric"
                dir="ltr"
                placeholder="1200000"
              />
            )}
          </DashboardFormField>
          <DashboardFormField
            label={t("ingredients.quantityLabel")}
            required
            error={fieldError(errors.purchaseQuantity?.message)}
          >
            {(wiring) => (
              // The field and its unit read left to right in both languages.
              <div dir="ltr">
                <Input
                  {...wiring}
                  {...register("purchaseQuantity")}
                  size="control-md"
                  inputClassName={cn(FIELD_INPUT, "pe-16 tabular-nums")}
                  inputMode="decimal"
                  placeholder="1000"
                  rightElement={<span className="pointer-events-none text-muted-foreground">{t(`unit.${unit}`)}</span>}
                />
              </div>
            )}
          </DashboardFormField>
        </div>
        <p className={FIELD_HINT}>{t("ingredients.priceHint")}</p>
        {ingredient ? (
          <Controller
            control={control}
            name="isActive"
            render={({ field }) => (
              <DashboardSwitchField
                label={t("ingredients.activeLabel")}
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
        ) : null}
      </DashboardDialog>
    </>
  );
}
