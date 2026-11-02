"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useFieldArray, useForm, useWatch } from "react-hook-form";

import { recipeSchema, type RecipeFormInput } from "@/src/contracts/pricing-schema";
import { ingredientUnitCost, MAX_RECIPE_LINES, type Ingredient, type RecipeLine } from "@/src/domain/entities/Pricing";
import { Link, useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatMoney } from "@/src/lib/formatMoney";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { cn } from "@/src/lib/utils";
import { FIELD_ERROR, FIELD_INPUT } from "@/src/presentation/dashboard/fieldStyles";
import { FormAlert } from "@/src/presentation/dashboard/FormAlert";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { FormMessage } from "@/src/presentation/design-system/components/form/FormMessage/FormMessage";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Select } from "@/src/presentation/design-system/components/form/Select/Select";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";
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
    <form
      onSubmit={onSubmit}
      className="flex min-w-0 flex-col gap-4 rounded-card-lg border border-border bg-background p-5 text-body-default shadow-xs sm:text-body-small"
      noValidate
    >
      {choices.length === 0 ? (
        <p className="text-muted-foreground">
          {t("recipe.noIngredients")}{" "}
          <Link
            href="/dashboard/pricing/ingredients"
            className="font-medium text-primary transition-colors hover:text-primary-hover hover:underline"
          >
            {t("tab.ingredients")}
          </Link>
        </p>
      ) : null}
      {fields.length === 0 ? <p className="text-muted-foreground">{t("recipe.empty")}</p> : null}

      {fields.length > 0 ? (
        <div className="flex min-w-0 flex-col gap-3">
          {fields.map((field, index) => {
            const ingredient = byId.get(watched[index]?.ingredientId ?? "");
            const lineErrors = errors.lines?.[index];
            return (
              <div
                key={field.id}
                className="grid grid-cols-[minmax(0,1fr)_2.75rem] items-center gap-x-3 gap-y-2 sm:grid-cols-[minmax(0,1fr)_2.25rem] md:grid-cols-[minmax(0,1fr)_10rem_2.25rem]"
              >
                <Select
                  {...register(`lines.${index}.ingredientId`)}
                  aria-label={t("recipe.ingredientLabel")}
                  size="control-md"
                  className="col-span-full border-border-strong md:col-span-1"
                >
                  <option value="">{t("recipe.ingredientPlaceholder")}</option>
                  {choices.map((choice) => (
                    <option key={choice.id} value={choice.id}>
                      {choice.name}
                    </option>
                  ))}
                </Select>
                {/* The amount and its unit read left to right in both languages. */}
                <div dir="ltr">
                  <Input
                    {...register(`lines.${index}.quantity`)}
                    inputMode="decimal"
                    aria-label={t("recipe.quantityLabel")}
                    size="control-md"
                    inputClassName={cn(FIELD_INPUT, "pe-16 text-end tabular-nums")}
                    rightElement={
                      <span className="pointer-events-none text-muted-foreground">
                        {ingredient ? t(`unit.${ingredient.unit}`) : ""}
                      </span>
                    }
                  />
                </div>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  aria-label={t("recipe.removeLine")}
                  title={t("recipe.removeLine")}
                  className={cn(
                    "flex size-11 items-center justify-center justify-self-end rounded-button text-muted-foreground transition-colors hover:bg-error hover:text-error-foreground sm:size-9",
                    focusRing,
                  )}
                >
                  <Icon icon={Trash} size="icon-md" />
                </button>
                {lineErrors?.ingredientId?.message ? (
                  <FormMessage className={cn(FIELD_ERROR, "col-span-full")}>
                    {fieldError(lineErrors.ingredientId.message)}
                  </FormMessage>
                ) : null}
                {lineErrors?.quantity?.message ? (
                  <FormMessage className={cn(FIELD_ERROR, "col-span-full")}>
                    {fieldError(lineErrors.quantity.message)}
                  </FormMessage>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="secondary"
          size="control-md"
          className="px-3"
          onClick={() => append({ ingredientId: "", quantity: "" })}
          disabled={fields.length >= MAX_RECIPE_LINES || choices.length === 0}
        >
          <Icon icon={Plus} size="icon-md" className="me-2" />
          {t("recipe.addLine")}
        </Button>
        <span className="font-semibold text-foreground tabular-nums">
          {t("recipe.total", { cost: formatMoney(Math.round(total), locale) })}
        </span>
      </div>

      {linesError ? <FormAlert>{fieldError(linesError)}</FormAlert> : null}
      {errors.root?.message ? <FormAlert>{errors.root.message}</FormAlert> : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="control-md" loading={isSubmitting}>
          {t("recipe.save")}
        </Button>
        <Button asChild variant="secondary" size="control-md" className="px-3">
          <Link href="/dashboard/pricing">{t("cancel")}</Link>
        </Button>
      </div>
    </form>
  );
}
