"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";

import { employeeSchema, type EmployeeFormInput } from "@/src/contracts/payroll-schema";
import type { Employee } from "@/src/domain/entities/Payroll";
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
import { normalizeAmount } from "../expenses/expenseFormat";
import { FIELD_LABEL } from "../fieldStyles";

import { employeesApi } from "./payroll-api";

function toDefaults(employee?: Employee): EmployeeFormInput {
  return {
    name: employee?.name ?? "",
    position: employee?.position ?? "",
    phone: employee?.phone ?? "",
    monthlySalary: employee?.monthlySalary ? String(employee.monthlySalary) : "",
    isActive: employee?.isActive ?? true,
  };
}

/** Add someone to the payroll, or edit them (including switching them off). */
export function EmployeeDialog({ employee }: { employee?: Employee }) {
  const t = useTranslations("dashPayroll.staff");
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
  } = useForm<EmployeeFormInput>({
    resolver: zodResolver(employeeSchema, undefined, { raw: true }),
    defaultValues: toDefaults(employee),
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (employee) await employeesApi.update(employee.id, values);
      else await employeesApi.create(values);
      toast({ tone: "success", title: employee ? t("saved") : t("added") });
      setOpen(false);
      if (!employee) reset(toDefaults());
      router.refresh();
    } catch (error) {
      setError("root", { message: localizeApiError(error, tApiErrors, t("error")) });
    }
  });

  return (
    <>
      {employee ? (
        <Button
          type="button"
          variant="secondary"
          size="control-sm"
          className="px-3"
          onClick={() => setOpen(true)}
          aria-label={t("edit", { name: employee.name })}
        >
          {t("editShort")}
        </Button>
      ) : (
        <Button type="button" size="control-md" className="px-4" onClick={() => setOpen(true)}>
          <Icon icon={Plus} size="icon-md" className="me-2" />
          {t("new")}
        </Button>
      )}
      <DashboardDialog
        open={open}
        onOpenChange={setOpen}
        title={employee ? employee.name : t("new")}
        subtitle=""
        submitLabel={t("save")}
        pending={isSubmitting}
        onSubmit={() => void onSubmit()}
        error={errors.root?.message}
      >
        <DashboardFormField label={t("nameLabel")} required error={fieldError(errors.name?.message)}>
          {(field) => <Input {...field} {...register("name")} size="control-md" dir="auto" />}
        </DashboardFormField>
        <div className="grid grid-cols-2 gap-4">
          <DashboardFormField label={t("positionLabel")} error={fieldError(errors.position?.message)}>
            {(field) => <Input {...field} {...register("position")} size="control-md" dir="auto" />}
          </DashboardFormField>
          <DashboardFormField label={t("phoneLabel")} error={fieldError(errors.phone?.message)}>
            {(field) => <Input {...field} {...register("phone")} size="control-md" inputMode="tel" dir="ltr" />}
          </DashboardFormField>
        </div>
        <DashboardFormField
          label={t("salaryLabel")}
          hint={t("salaryHint")}
          error={fieldError(errors.monthlySalary?.message)}
        >
          {(field) => (
            <Input
              {...field}
              {...register("monthlySalary", { setValueAs: normalizeAmount })}
              size="control-md"
              inputMode="numeric"
              autoComplete="off"
              placeholder="0"
              dir="ltr"
            />
          )}
        </DashboardFormField>
        {employee ? (
          <Controller
            control={control}
            name="isActive"
            render={({ field }) => (
              <label className="flex min-h-11 items-center gap-3 sm:min-h-8">
                <Switch size="sm" checked={field.value} onCheckedChange={field.onChange} />
                <span className={FIELD_LABEL}>{t("activeLabel")}</span>
              </label>
            )}
          />
        ) : null}
      </DashboardDialog>
    </>
  );
}
