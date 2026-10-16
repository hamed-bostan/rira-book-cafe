"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";

import { ingredientSchema, type IngredientFormInput } from "@/src/contracts/pricing-schema";
import { INGREDIENT_UNITS, type Ingredient } from "@/src/domain/entities/Pricing";
import { useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { Button, FormMessage, Icon, Input, Modal, ModalContent, Select, Switch, TextField } from "@/src/presentation/design-system";

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

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (ingredient) await ingredientsApi.update(ingredient.id, values);
      else await ingredientsApi.create(values);
      setOpen(false);
      if (!ingredient) reset(toDefaults());
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
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(true)} aria-label={t("ingredients.edit", { name: ingredient.name })}>
          <Icon icon={Pencil} size="sm" />
        </Button>
      ) : (
        <Button type="button" size="sm" onClick={() => setOpen(true)}>
          <Icon icon={Plus} size="sm" className="me-1.5" />
          {t("ingredients.new")}
        </Button>
      )}
      <Modal open={open} onOpenChange={setOpen}>
        <ModalContent title={ingredient ? ingredient.name : t("ingredients.new")} className="max-w-md">
          <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-4" noValidate>
            <TextField label={t("ingredients.nameLabel")} required error={fieldError(errors.name?.message)}>
              {(control) => <Input {...control} {...register("name")} dir="auto" placeholder={t("ingredients.namePlaceholder")} />}
            </TextField>
            <TextField label={t("ingredients.unitLabel")} error={fieldError(errors.unit?.message)}>
              {(control) => (
                <Select {...control} {...register("unit")}>
                  {INGREDIENT_UNITS.map((unit) => (
                    <option key={unit} value={unit}>
                      {t(`unitName.${unit}`)}
                    </option>
                  ))}
                </Select>
              )}
            </TextField>
            <div className="grid grid-cols-2 gap-3">
              <TextField label={t("ingredients.priceLabel")} required error={fieldError(errors.purchasePrice?.message)}>
                {(control) => <Input {...control} {...register("purchasePrice")} inputMode="numeric" dir="ltr" placeholder="1200000" />}
              </TextField>
              <TextField label={t("ingredients.quantityLabel")} required error={fieldError(errors.purchaseQuantity?.message)}>
                {(control) => <Input {...control} {...register("purchaseQuantity")} inputMode="decimal" dir="ltr" placeholder="1000" />}
              </TextField>
            </div>
            <p className="-mt-2 text-body-caption text-muted-foreground">{t("ingredients.priceHint")}</p>
            {ingredient ? (
              <Controller
                control={control}
                name="isActive"
                render={({ field }) => (
                  <label className="flex items-center justify-between gap-3 text-body-small-emphasis text-foreground">
                    {t("ingredients.activeLabel")}
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </label>
                )}
              />
            ) : null}
            {errors.root?.message ? <FormMessage>{errors.root.message}</FormMessage> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {t("save")}
              </Button>
            </div>
          </form>
        </ModalContent>
      </Modal>
    </>
  );
}
