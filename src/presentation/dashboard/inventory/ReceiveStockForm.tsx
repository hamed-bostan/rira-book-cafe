"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useForm, useWatch, type Control, type UseFormRegister } from "react-hook-form";

import { EXPENSE_PAYMENT_CHOICES } from "@/src/contracts/expense-schema";
import { stockReceiptSchema, type StockReceiptFormInput } from "@/src/contracts/inventory-schema";
import type { Supplier } from "@/src/domain/entities/Expense";
import type { StockItem } from "@/src/domain/entities/Inventory";
import { Link, useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { cn } from "@/src/lib/utils";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Select } from "@/src/presentation/design-system/components/form/Select/Select";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { DashboardFormField } from "../DashboardFormField";
import { FIELD_INPUT, FIELD_LABEL } from "../fieldStyles";
import { FormAlert } from "../FormAlert";
import { PAGE_CARD, ROW_TEXT } from "../pageStyles";

import { inventoryApi } from "./inventory-api";
import { StockLinesFields, type StockLinesForm } from "./StockLinesFields";

/**
 * A delivery from a supplier. Each line's cost is before VAT; the invoice's VAT is
 * entered once. Saving brings the stock in, books the bill (owed or paid), and
 * updates the latest purchase prices the pricing advisor uses.
 */
export function ReceiveStockForm({
  items,
  suppliers,
  today,
}: {
  items: StockItem[];
  suppliers: Supplier[];
  today: string;
}) {
  const t = useTranslations("dashInventory");
  const tExpenses = useTranslations("dashExpenses");
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
  } = useForm<StockReceiptFormInput>({
    resolver: zodResolver(stockReceiptSchema, undefined, { raw: true }),
    defaultValues: {
      date: today,
      supplierId: "",
      description: "",
      lines: [{ ingredientId: "", quantity: "", cost: "" }],
      vatAmount: "",
      payment: "unpaid",
    },
  });
  const date = useWatch({ control, name: "date" });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await inventoryApi.receive(values);
      toast({ tone: "success", title: t("receive.saved") });
      router.push("/dashboard/inventory");
      router.refresh();
    } catch (error) {
      setError("root", { message: localizeApiError(error, tApiErrors, t("receive.error")) });
    }
  });

  return (
    <form onSubmit={onSubmit} className={cn(PAGE_CARD, "flex flex-col gap-5 p-5")} noValidate>
      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[12rem_minmax(0,1fr)]">
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
              inputClassName={FIELD_INPUT}
            />
          )}
        </DashboardFormField>
        <DashboardFormField label={tExpenses("form.supplierLabel")} error={fieldError(errors.supplierId?.message)}>
          {(field) => (
            <Select {...field} {...register("supplierId")} size="control-md" className="border-border-strong">
              <option value="">{tExpenses("form.noSupplier")}</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </Select>
          )}
        </DashboardFormField>
      </div>
      <DashboardFormField
        label={t("receive.descriptionLabel")}
        required
        error={fieldError(errors.description?.message)}
      >
        {(field) => (
          <Input
            {...field}
            {...register("description")}
            size="control-md"
            dir="auto"
            placeholder={t("receive.descriptionPlaceholder")}
            inputClassName={FIELD_INPUT}
          />
        )}
      </DashboardFormField>

      <StockLinesFields
        control={control as unknown as Control<StockLinesForm>}
        register={register as unknown as UseFormRegister<StockLinesForm>}
        errors={errors}
        items={items}
        costLabel={t("receive.costLabel")}
      />

      <DashboardFormField
        label={tExpenses("form.vatLabel")}
        hint={tExpenses("form.vatHint")}
        error={fieldError(errors.vatAmount?.message)}
      >
        {(field) => (
          <Input
            {...field}
            {...register("vatAmount")}
            size="control-md"
            inputMode="numeric"
            dir="ltr"
            className="max-w-48"
            inputClassName={cn(FIELD_INPUT, "tabular-nums")}
          />
        )}
      </DashboardFormField>

      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className={cn(FIELD_LABEL, "mb-2")}>{tExpenses("form.paymentLabel")}</legend>
        {EXPENSE_PAYMENT_CHOICES.map((choice) => (
          <label
            key={choice}
            className={cn(ROW_TEXT, "flex min-h-11 w-fit items-center gap-2 text-foreground sm:min-h-8")}
          >
            <input type="radio" value={choice} {...register("payment")} className="size-4 accent-primary" />
            {tExpenses(`form.payment.${choice}`)}
          </label>
        ))}
      </fieldset>

      {errors.root?.message ? <FormAlert>{errors.root.message}</FormAlert> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="control-md" className="px-4" loading={isSubmitting}>
          {t("receive.save")}
        </Button>
        <Button asChild variant="secondary" size="control-md" className="px-3">
          <Link href="/dashboard/inventory">{t("cancel")}</Link>
        </Button>
      </div>
    </form>
  );
}
