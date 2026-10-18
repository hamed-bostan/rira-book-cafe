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
import { Button, FormMessage, Input, Select, TextField, useToast } from "@/src/presentation/design-system";

import { inventoryApi } from "./inventory-api";
import { StockLinesFields, type StockLinesForm } from "./StockLinesFields";

/**
 * A delivery from a supplier. Each line's cost is before VAT; the invoice's VAT is
 * entered once. Saving brings the stock in, books the bill (owed or paid), and
 * updates the latest purchase prices the pricing advisor uses.
 */
export function ReceiveStockForm({ items, suppliers, today }: { items: StockItem[]; suppliers: Supplier[]; today: string }) {
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
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField label={t("dateLabel")} required description={date ? formatCafeDayMedium(date, locale) : undefined} error={fieldError(errors.date?.message)}>
          {(controlProps) => <Input {...controlProps} {...register("date")} type="date" max={today} dir="ltr" />}
        </TextField>
        <TextField label={tExpenses("form.supplierLabel")} error={fieldError(errors.supplierId?.message)}>
          {(controlProps) => (
            <Select {...controlProps} {...register("supplierId")}>
              <option value="">{tExpenses("form.noSupplier")}</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </Select>
          )}
        </TextField>
      </div>
      <TextField label={t("receive.descriptionLabel")} required error={fieldError(errors.description?.message)}>
        {(controlProps) => <Input {...controlProps} {...register("description")} dir="auto" placeholder={t("receive.descriptionPlaceholder")} />}
      </TextField>

      <StockLinesFields
        control={control as unknown as Control<StockLinesForm>}
        register={register as unknown as UseFormRegister<StockLinesForm>}
        errors={errors}
        items={items}
        costLabel={t("receive.costLabel")}
      />

      <TextField label={tExpenses("form.vatLabel")} description={tExpenses("form.vatHint")} error={fieldError(errors.vatAmount?.message)}>
        {(controlProps) => <Input {...controlProps} {...register("vatAmount")} inputMode="numeric" dir="ltr" className="max-w-48" />}
      </TextField>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-body-small-emphasis text-input-foreground">{tExpenses("form.paymentLabel")}</legend>
        <div className="flex flex-wrap gap-2">
          {EXPENSE_PAYMENT_CHOICES.map((choice) => (
            <label key={choice} className="flex cursor-pointer items-center gap-2 rounded-card-md border border-border px-3 py-2 text-body-small has-[:checked]:border-primary has-[:checked]:bg-accent">
              <input type="radio" value={choice} {...register("payment")} className="accent-primary" />
              {tExpenses(`form.payment.${choice}`)}
            </label>
          ))}
        </div>
      </fieldset>

      {errors.root?.message ? <FormMessage size="md">{errors.root.message}</FormMessage> : null}
      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={isSubmitting}>
          {t("receive.save")}
        </Button>
        <Button asChild variant="outline" type="button">
          <Link href="/dashboard/inventory">{t("cancel")}</Link>
        </Button>
      </div>
    </form>
  );
}
