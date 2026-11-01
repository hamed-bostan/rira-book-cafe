"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useForm, useWatch, type Control, type UseFormRegister } from "react-hook-form";

import { openingStockSchema, type OpeningStockFormInput } from "@/src/contracts/inventory-schema";
import type { StockItem } from "@/src/domain/entities/Inventory";
import { Link, useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { cn } from "@/src/lib/utils";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { DashboardFormField } from "../DashboardFormField";
import { FIELD_INPUT } from "../fieldStyles";
import { FormAlert } from "../FormAlert";
import { PAGE_CARD } from "../pageStyles";

import { inventoryApi } from "./inventory-api";
import { StockLinesFields, type StockLinesForm } from "./StockLinesFields";

/**
 * Stock already on the shelves when tracking starts, at what it's worth — brought
 * into the books against the owner's capital.
 */
export function OpeningStockForm({ items, today }: { items: StockItem[]; today: string }) {
  const t = useTranslations("dashInventory");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const fieldError = (message?: string): string | undefined => formErrorMessage(tFormErrors, message);
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<OpeningStockFormInput>({
    resolver: zodResolver(openingStockSchema, undefined, { raw: true }),
    defaultValues: { date: today, lines: [{ ingredientId: "", quantity: "", cost: "" }] },
  });
  const date = useWatch({ control, name: "date" });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await inventoryApi.recordOpening(values);
      toast({ tone: "success", title: t("opening.saved") });
      router.push("/dashboard/inventory");
      router.refresh();
    } catch (error) {
      setError("root", { message: localizeApiError(error, tApiErrors, t("opening.error")) });
    }
  });

  return (
    <form onSubmit={onSubmit} className={cn(PAGE_CARD, "flex flex-col gap-5 p-5")} noValidate>
      <DashboardFormField
        label={t("dateLabel")}
        required
        hint={date ? formatCafeDayMedium(date, locale) : undefined}
        error={fieldError(errors.date?.message)}
      >
        {(field) => (
          <Input
            {...field}
            {...register("date")}
            size="control-md"
            type="date"
            max={today}
            dir="ltr"
            className="max-w-48"
            inputClassName={FIELD_INPUT}
          />
        )}
      </DashboardFormField>
      <StockLinesFields
        control={control as unknown as Control<StockLinesForm>}
        register={register as unknown as UseFormRegister<StockLinesForm>}
        errors={errors}
        items={items}
        costLabel={t("opening.costLabel")}
      />
      {errors.root?.message ? <FormAlert>{errors.root.message}</FormAlert> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="control-md" className="px-4" loading={isSubmitting}>
          {t("opening.save")}
        </Button>
        <Button asChild variant="secondary" size="control-md" className="px-3">
          <Link href="/dashboard/inventory">{t("cancel")}</Link>
        </Button>
      </div>
    </form>
  );
}
