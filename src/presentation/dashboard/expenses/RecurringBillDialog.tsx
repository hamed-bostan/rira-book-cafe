"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";

import { recurringBillSchema, type RecurringBillFormInput } from "@/src/contracts/recurring-bill-schema";
import type { Supplier } from "@/src/domain/entities/Expense";
import type { Account } from "@/src/domain/entities/Ledger";
import { MAX_BILL_DAY, type RecurringBill } from "@/src/domain/entities/RecurringBill";
import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatNumber } from "@/src/lib/formatNumber";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { accountLabel } from "@/src/presentation/dashboard/accounting/accounting-format";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Select } from "@/src/presentation/design-system/components/form/Select/Select";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { Switch } from "@/src/presentation/design-system/components/Switch/Switch";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { DashboardDialog } from "../DashboardDialog";
import { DashboardFormField } from "../DashboardFormField";
import { FIELD_LABEL } from "../fieldStyles";

import { recurringBillsApi } from "./expense-api";
import { normalizeAmount } from "./expenseFormat";

type RecurringBillDialogProps = {
  bill?: RecurringBill;
  /** Accounts a bill can be booked to. */
  accounts: readonly Account[];
  /** Suppliers still bought from. */
  suppliers: readonly Supplier[];
};

const DAYS = Array.from({ length: MAX_BILL_DAY }, (_, index) => index + 1);

function toDefaults(bill?: RecurringBill): RecurringBillFormInput {
  return {
    description: bill?.description ?? "",
    accountCode: bill?.accountCode ?? "",
    supplierId: bill?.supplierId ?? "",
    amount: bill ? String(bill.amount) : "",
    vatAmount: bill?.vatAmount ? String(bill.vatAmount) : "",
    dayOfMonth: bill?.dayOfMonth ?? 1,
    isActive: bill?.isActive ?? true,
  };
}

/** Add a recurring bill, or edit one (including switching it off). */
export function RecurringBillDialog({ bill, accounts, suppliers }: RecurringBillDialogProps) {
  const t = useTranslations("dashExpenses");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const fieldError = (message?: string): string | undefined => formErrorMessage(tFormErrors, message);
  const locale = useLocale();
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
  } = useForm<RecurringBillFormInput>({
    resolver: zodResolver(recurringBillSchema, undefined, { raw: true }),
    defaultValues: toDefaults(bill),
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (bill) await recurringBillsApi.update(bill.id, values);
      else await recurringBillsApi.create(values);
      toast({ tone: "success", title: bill ? t("recurring.saved") : t("recurring.added") });
      setOpen(false);
      if (!bill) reset(toDefaults());
      router.refresh();
    } catch (error) {
      setError("root", { message: localizeApiError(error, tApiErrors, t("recurring.error")) });
    }
  });

  return (
    <>
      {bill ? (
        <Button
          type="button"
          variant="secondary"
          size="control-sm"
          className="px-3"
          onClick={() => setOpen(true)}
          aria-label={t("recurring.edit", { name: bill.description })}
        >
          {t("recurring.editShort")}
        </Button>
      ) : (
        <Button type="button" size="control-md" className="px-4" onClick={() => setOpen(true)}>
          <Icon icon={Plus} size="icon-md" className="me-2" />
          {t("recurring.new")}
        </Button>
      )}
      <DashboardDialog
        open={open}
        onOpenChange={setOpen}
        title={bill ? bill.description : t("recurring.new")}
        subtitle={bill ? "" : t("recurring.startsHint")}
        submitLabel={t("recurring.save")}
        backLabel={t("cancel")}
        pending={isSubmitting}
        onSubmit={() => void onSubmit()}
        error={errors.root?.message}
      >
        <DashboardFormField label={t("form.descriptionLabel")} required error={fieldError(errors.description?.message)}>
          {(field) => <Input {...field} {...register("description")} size="control-md" dir="auto" />}
        </DashboardFormField>

        <DashboardFormField
          label={t("form.accountLabel")}
          required
          hint={t("form.accountHint")}
          error={fieldError(errors.accountCode?.message)}
        >
          {(field) => (
            <Select {...field} {...register("accountCode")} size="control-md">
              <option value="">{t("form.accountPlaceholder")}</option>
              {accounts.map((account) => (
                <option key={account.code} value={account.code}>
                  {accountLabel(account, locale)}
                </option>
              ))}
            </Select>
          )}
        </DashboardFormField>

        <div className="grid grid-cols-2 gap-4">
          <DashboardFormField label={t("form.supplierLabel")} error={fieldError(errors.supplierId?.message)}>
            {(field) => (
              <Select {...field} {...register("supplierId")} size="control-md">
                <option value="">{t("form.noSupplier")}</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </Select>
            )}
          </DashboardFormField>
          <DashboardFormField
            label={t("recurring.dayLabel")}
            required
            hint={t("recurring.dayHint")}
            error={fieldError(errors.dayOfMonth?.message)}
          >
            {(field) => (
              <Select {...field} {...register("dayOfMonth", { valueAsNumber: true })} size="control-md">
                {DAYS.map((day) => (
                  <option key={day} value={day}>
                    {t("recurring.dayOption", { day: formatNumber(day, locale) })}
                  </option>
                ))}
              </Select>
            )}
          </DashboardFormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <DashboardFormField
            label={t("form.amountLabel")}
            required
            hint={t("recurring.amountHint")}
            error={fieldError(errors.amount?.message)}
          >
            {(field) => (
              <Input
                {...field}
                {...register("amount", { setValueAs: normalizeAmount })}
                size="control-md"
                inputMode="numeric"
                autoComplete="off"
                placeholder="0"
                dir="ltr"
              />
            )}
          </DashboardFormField>
          <DashboardFormField
            label={t("form.vatLabel")}
            hint={t("form.vatHint")}
            error={
              errors.vatAmount?.message === "vatTooHigh" ? t("form.vatTooHigh") : fieldError(errors.vatAmount?.message)
            }
          >
            {(field) => (
              <Input
                {...field}
                {...register("vatAmount", { setValueAs: normalizeAmount })}
                size="control-md"
                inputMode="numeric"
                autoComplete="off"
                placeholder="0"
                dir="ltr"
              />
            )}
          </DashboardFormField>
        </div>

        {bill ? (
          <Controller
            control={control}
            name="isActive"
            render={({ field }) => (
              <label className="flex min-h-11 items-center gap-3 sm:min-h-8">
                <Switch size="sm" checked={field.value} onCheckedChange={field.onChange} />
                <span className={FIELD_LABEL}>{t("recurring.activeLabel")}</span>
              </label>
            )}
          />
        ) : null}
      </DashboardDialog>
    </>
  );
}
