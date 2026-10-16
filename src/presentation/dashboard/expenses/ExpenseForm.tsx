"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useForm, useWatch } from "react-hook-form";

import { EXPENSE_PAYMENT_CHOICES, expenseSchema, type ExpenseFormInput } from "@/src/contracts/expense-schema";
import type { Supplier } from "@/src/domain/entities/Expense";
import type { Account } from "@/src/domain/entities/Ledger";
import { Link, useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";
import { formatMoney } from "@/src/lib/formatMoney";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { accountLabel } from "@/src/presentation/dashboard/accounting/accounting-format";
import { Button, FormMessage, Input, Select, TextField } from "@/src/presentation/design-system";

import { expensesApi } from "./expense-api";

const FORM_FIELDS = ["date", "supplierId", "accountCode", "description", "amount", "vatAmount", "payment"] as const satisfies readonly (keyof ExpenseFormInput)[];

type ExpenseFormProps = {
  /** Accounts an expense can be booked to (expense, stock, equipment). */
  accounts: Account[];
  suppliers: Supplier[];
  today: string;
};

/**
 * Record a bill or purchase: when, from whom, booked to which account, the total
 * with the invoice's VAT, and whether it's paid now or owed. The server books it.
 */
export function ExpenseForm({ accounts, suppliers, today }: ExpenseFormProps) {
  const t = useTranslations("dashExpenses");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const fieldError = (message?: string): string | undefined => formErrorMessage(tFormErrors, message);
  const locale = useLocale();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseFormInput>({
    resolver: zodResolver(expenseSchema, undefined, { raw: true }),
    defaultValues: { date: today, supplierId: "", accountCode: "", description: "", amount: "", vatAmount: "", payment: "unpaid" },
  });
  const [date, amount, vatAmount] = useWatch({ control, name: ["date", "amount", "vatAmount"] });
  const total = /^\d+$/.test(amount.trim()) ? Number(amount) : 0;
  const vat = /^\d+$/.test(vatAmount.trim()) ? Number(vatAmount) : 0;

  const onSubmit = handleSubmit(async (values) => {
    try {
      const expense = await expensesApi.create(values);
      router.push(`/dashboard/expenses/${expense.id}`);
      router.refresh();
    } catch (error) {
      let applied = false;
      if (error instanceof ApiError) {
        for (const field of FORM_FIELDS) {
          const message = error.fieldErrors?.[field];
          if (message) {
            setError(field, { message });
            applied = true;
          }
        }
      }
      if (!applied) setError("root", { message: localizeApiError(error, tApiErrors, t("form.error")) });
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField label={t("form.dateLabel")} required description={date ? formatCafeDayMedium(date, locale) : undefined} error={fieldError(errors.date?.message)}>
          {(control) => <Input {...control} {...register("date")} type="date" max={today} dir="ltr" />}
        </TextField>
        <TextField label={t("form.supplierLabel")} error={fieldError(errors.supplierId?.message)}>
          {(control) => (
            <Select {...control} {...register("supplierId")}>
              <option value="">{t("form.noSupplier")}</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </Select>
          )}
        </TextField>
      </div>

      <TextField label={t("form.accountLabel")} required description={t("form.accountHint")} error={fieldError(errors.accountCode?.message)}>
        {(control) => (
          <Select {...control} {...register("accountCode")}>
            <option value="">{t("form.accountPlaceholder")}</option>
            {accounts.map((account) => (
              <option key={account.code} value={account.code}>
                {accountLabel(account, locale)}
              </option>
            ))}
          </Select>
        )}
      </TextField>

      <TextField label={t("form.descriptionLabel")} required error={fieldError(errors.description?.message)}>
        {(control) => <Input {...control} {...register("description")} dir="auto" placeholder={t("form.descriptionPlaceholder")} />}
      </TextField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField label={t("form.amountLabel")} required error={fieldError(errors.amount?.message)}>
          {(control) => <Input {...control} {...register("amount")} inputMode="numeric" dir="ltr" />}
        </TextField>
        <TextField label={t("form.vatLabel")} description={t("form.vatHint")} error={fieldError(errors.vatAmount?.message)}>
          {(control) => <Input {...control} {...register("vatAmount")} inputMode="numeric" dir="ltr" />}
        </TextField>
      </div>
      {total > 0 ? (
        <p className="-mt-2 text-body-caption text-muted-foreground">
          {t("form.breakdown", { net: formatMoney(Math.max(total - vat, 0), locale), vat: formatMoney(vat, locale), total: formatMoney(total, locale) })}
        </p>
      ) : null}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-body-small-emphasis text-input-foreground">{t("form.paymentLabel")}</legend>
        <div className="flex flex-wrap gap-2">
          {EXPENSE_PAYMENT_CHOICES.map((choice) => (
            <label key={choice} className="flex cursor-pointer items-center gap-2 rounded-card-md border border-border px-3 py-2 text-body-small has-[:checked]:border-primary has-[:checked]:bg-accent">
              <input type="radio" value={choice} {...register("payment")} className="accent-primary" />
              {t(`form.payment.${choice}`)}
            </label>
          ))}
        </div>
        {errors.payment?.message ? <FormMessage>{fieldError(errors.payment.message)}</FormMessage> : null}
      </fieldset>

      {errors.root?.message ? <FormMessage size="md">{errors.root.message}</FormMessage> : null}

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isSubmitting}>
          {t("form.save")}
        </Button>
        <Button asChild variant="outline" type="button">
          <Link href="/dashboard/expenses">{t("cancel")}</Link>
        </Button>
      </div>
    </form>
  );
}
