"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";

import { supplierSchema, type SupplierFormInput } from "@/src/contracts/expense-schema";
import type { Supplier } from "@/src/domain/entities/Expense";
import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { Switch } from "@/src/presentation/design-system/components/Switch/Switch";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { DashboardDialog } from "../DashboardDialog";
import { DashboardFormField } from "../DashboardFormField";
import { FIELD_INPUT, FIELD_LABEL } from "../fieldStyles";

import { suppliersApi } from "./expense-api";

function toDefaults(supplier?: Supplier): SupplierFormInput {
  return {
    name: supplier?.name ?? "",
    phone: supplier?.phone ?? "",
    note: supplier?.note ?? "",
    isActive: supplier?.isActive ?? true,
  };
}

/** Add a supplier, or edit one (including switching it off). */
export function SupplierDialog({ supplier }: { supplier?: Supplier }) {
  const t = useTranslations("dashExpenses");
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
  } = useForm<SupplierFormInput>({
    resolver: zodResolver(supplierSchema, undefined, { raw: true }),
    defaultValues: toDefaults(supplier),
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (supplier) await suppliersApi.update(supplier.id, values);
      else await suppliersApi.create(values);
      toast({ tone: "success", title: supplier ? t("suppliers.saved") : t("suppliers.added") });
      setOpen(false);
      if (!supplier) reset(toDefaults());
      router.refresh();
    } catch (error) {
      setError("root", { message: localizeApiError(error, tApiErrors, t("suppliers.error")) });
    }
  });

  return (
    <>
      {supplier ? (
        <Button
          type="button"
          variant="secondary"
          size="control-sm"
          className="px-3"
          onClick={() => setOpen(true)}
          aria-label={t("suppliers.edit", { name: supplier.name })}
        >
          {t("suppliers.editShort")}
        </Button>
      ) : (
        <Button type="button" size="control-md" className="px-4" onClick={() => setOpen(true)}>
          <Icon icon={Plus} size="icon-md" className="me-2" />
          {t("suppliers.new")}
        </Button>
      )}
      <DashboardDialog
        open={open}
        onOpenChange={setOpen}
        title={supplier ? supplier.name : t("suppliers.new")}
        subtitle=""
        submitLabel={t("suppliers.save")}
        backLabel={t("cancel")}
        pending={isSubmitting}
        onSubmit={() => void onSubmit()}
        error={errors.root?.message}
      >
        <DashboardFormField label={t("suppliers.nameLabel")} required error={fieldError(errors.name?.message)}>
          {(field) => (
            <Input {...field} {...register("name")} size="control-md" dir="auto" inputClassName={FIELD_INPUT} />
          )}
        </DashboardFormField>
        <DashboardFormField label={t("suppliers.phoneLabel")} error={fieldError(errors.phone?.message)}>
          {(field) => (
            <Input
              {...field}
              {...register("phone")}
              size="control-md"
              inputMode="tel"
              dir="ltr"
              inputClassName={FIELD_INPUT}
            />
          )}
        </DashboardFormField>
        <DashboardFormField label={t("suppliers.noteLabel")} error={fieldError(errors.note?.message)}>
          {(field) => (
            <Input {...field} {...register("note")} size="control-md" dir="auto" inputClassName={FIELD_INPUT} />
          )}
        </DashboardFormField>
        {supplier ? (
          <Controller
            control={control}
            name="isActive"
            render={({ field }) => (
              <label className="flex min-h-11 items-center gap-3 sm:min-h-8">
                <Switch size="sm" checked={field.value} onCheckedChange={field.onChange} />
                <span className={FIELD_LABEL}>{t("suppliers.activeLabel")}</span>
              </label>
            )}
          />
        ) : null}
      </DashboardDialog>
    </>
  );
}
