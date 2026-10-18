"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ListPlus, Plus, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useFieldArray, useForm, useWatch } from "react-hook-form";

import { recipeSchema, type RecipeFormInput } from "@/src/contracts/pricing-schema";
import { ingredientUnitCost, MAX_RECIPE_LINES, type Ingredient, type RecipeLine } from "@/src/domain/entities/Pricing";
import { Link, useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatMoney } from "@/src/lib/formatMoney";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { EmptyState } from "@/src/presentation/design-system/components/EmptyState/EmptyState";
import { FormMessage } from "@/src/presentation/design-system/components/form/FormMessage/FormMessage";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Select } from "@/src/presentation/design-system/components/form/Select/Select";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { recipesApi } from "./pricing-api";

type RecipeFormProps = {
  productId: string;
  lines: RecipeLine[];
  ingredients: Ingredient[];
};

/**
 * What goes into one serving of an item. The running total is the item's
 * ingredient cost; saving makes it the item's cost price, which every order then
 * snapshots for the books.
 */
export function RecipeForm({ productId, lines, ingredients }: RecipeFormProps) {
  const t = useTranslations("dashPricing");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const fieldError = (message?: string): string | undefined => formErrorMessage(tFormErrors, message);
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const byId = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
  // Inactive ingredients stay pickable only where a recipe already uses them.
  const used = new Set(lines.map((line) => line.ingredientId));
  const choices = ingredients.filter((ingredient) => ingredient.isActive || used.has(ingredient.id));

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RecipeFormInput>({
    resolver: zodResolver(recipeSchema, undefined, { raw: true }),
    defaultValues: {
      lines: lines.map((line) => ({ ingredientId: line.ingredientId, quantity: String(line.quantity) })),
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });
  const watched = useWatch({ control, name: "lines" });

  const total = watched.reduce((sum, line) => {
    const ingredient = byId.get(line.ingredientId);
    const quantity = Number(line.quantity);
    return ingredient && quantity > 0 ? sum + ingredientUnitCost(ingredient) * quantity : sum;
  }, 0);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await recipesApi.save(productId, values);
      toast({ tone: "success", title: t("recipe.saved") });
      router.push("/dashboard/pricing");
      router.refresh();
    } catch (error) {
      setError("root", { message: localizeApiError(error, tApiErrors, t("recipe.error")) });
    }
  });

  const linesError = errors.lines?.root?.message ?? errors.lines?.message;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {fields.length === 0 ? <EmptyState icon={ListPlus} title={t("recipe.empty")} className="py-8" /> : null}
      {fields.map((field, index) => {
        const ingredient = byId.get(watched[index]?.ingredientId ?? "");
        const lineErrors = errors.lines?.[index];
        return (
          <div key={field.id} className="grid grid-cols-[minmax(0,1fr)_7rem_auto] items-start gap-2">
            <div className="flex flex-col gap-1">
              <Select
                {...register(`lines.${index}.ingredientId`)}
                aria-label={t("recipe.ingredientLabel")}
                className="h-10"
              >
                <option value="">{t("recipe.ingredientPlaceholder")}</option>
                {choices.map((choice) => (
                  <option key={choice.id} value={choice.id}>
                    {choice.name}
                  </option>
                ))}
              </Select>
              {lineErrors?.ingredientId?.message ? (
                <FormMessage>{fieldError(lineErrors.ingredientId.message)}</FormMessage>
              ) : null}
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                <Input
                  {...register(`lines.${index}.quantity`)}
                  inputMode="decimal"
                  aria-label={t("recipe.quantityLabel")}
                  className="h-10"
                  dir="ltr"
                />
                <span className="text-body-caption text-muted-foreground">
                  {ingredient ? t(`unit.${ingredient.unit}`) : ""}
                </span>
              </div>
              {lineErrors?.quantity?.message ? (
                <FormMessage>{fieldError(lineErrors.quantity.message)}</FormMessage>
              ) : null}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-10"
              onClick={() => remove(index)}
              aria-label={t("recipe.removeLine")}
            >
              <Icon icon={X} size="sm" />
            </Button>
          </div>
        );
      })}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ ingredientId: "", quantity: "" })}
          disabled={fields.length >= MAX_RECIPE_LINES || choices.length === 0}
        >
          <Icon icon={Plus} size="sm" className="me-1.5" />
          {t("recipe.addLine")}
        </Button>
        <p className="text-body-small-emphasis text-foreground">
          {t("recipe.total", { cost: formatMoney(Math.round(total), locale) })}
        </p>
      </div>
      {choices.length === 0 ? (
        <p className="text-body-small text-muted-foreground">
          {t("recipe.noIngredients")}{" "}
          <Link href="/dashboard/pricing/ingredients" className="font-medium text-primary underline underline-offset-4">
            {t("tab.ingredients")}
          </Link>
        </p>
      ) : null}
      {linesError ? <FormMessage>{fieldError(linesError)}</FormMessage> : null}
      {errors.root?.message ? <FormMessage size="md">{errors.root.message}</FormMessage> : null}

      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={isSubmitting}>
          {t("recipe.save")}
        </Button>
        <Button asChild variant="outline" type="button">
          <Link href="/dashboard/pricing">{t("cancel")}</Link>
        </Button>
      </div>
    </form>
  );
}
