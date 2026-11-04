"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";

import { cafeTableSchema, type CafeTableFormInput } from "@/src/contracts/cafe-table-schema";
import { MAX_TABLE_SEATS, type CafeTable } from "@/src/domain/entities/CafeTable";
import { useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { DashboardDialog } from "../DashboardDialog";
import { DashboardFormField } from "../DashboardFormField";
import { DashboardSwitchField } from "../DashboardSwitchField";
import { FIELD_GRID, FIELD_INPUT } from "../fieldStyles";

import { cafeTablesApi } from "./cafe-table-api";

const FIELDS = ["label", "seats", "area"] as const satisfies readonly (keyof CafeTableFormInput)[];

function toDefaults(table?: CafeTable): CafeTableFormInput {
  return {
    label: table?.label ?? "",
    seats: table ? String(table.seats) : "",
    area: table?.area ?? "",
    isActive: table?.isActive ?? true,
  };
}

type CafeTableDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The table being edited; absent to add one at the end of the floor. */
  table?: CafeTable;
};

/**
 * Add a table, or change one: its label (what bookings and the pickers call it),
 * seats, area, and whether it's in use. A new label is carried onto the table's
 * bookings and event holds. Mounted fresh each time it opens.
 */
export function CafeTableDialog({ open, onOpenChange, table }: CafeTableDialogProps) {
  const t = useTranslations("dashSettings.tables");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const fieldError = (message?: string): string | undefined => formErrorMessage(tFormErrors, message);
  const router = useRouter();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<CafeTableFormInput>({
    resolver: zodResolver(cafeTableSchema, undefined, { raw: true }),
    defaultValues: toDefaults(table),
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const saved = table ? await cafeTablesApi.update(table.id, values) : await cafeTablesApi.create(values);
      toast({
        tone: "success",
        title: table ? t("savedToast", { label: saved.label }) : t("addedToast", { label: saved.label }),
      });
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      let applied = false;
      if (error instanceof ApiError) {
        for (const field of FIELDS) {
          const message = error.fieldErrors?.[field];
          if (message) {
            setError(field, { message: field === "label" && message === "alreadyTaken" ? "tableLabelTaken" : message });
            applied = true;
          }
        }
      }
      if (!applied) setError("root", { message: localizeApiError(error, tApiErrors, t("saveError")) });
    }
  });

  return (
    <DashboardDialog
      open={open}
      onOpenChange={onOpenChange}
      title={table ? t("editTitle", { label: table.label }) : t("addTitle")}
      subtitle={table ? t("editSubtitle") : t("addSubtitle")}
      submitLabel={table ? t("save") : t("add")}
      blocked={Boolean(table) && !isDirty}
      pending={isSubmitting}
      onSubmit={() => void onSubmit()}
      error={errors.root?.message}
    >
      <div className={FIELD_GRID}>
        <DashboardFormField label={t("label")} hint={t("labelHint")} required error={fieldError(errors.label?.message)}>
          {(wiring) => (
            <Input {...wiring} {...register("label")} size="control-md" inputClassName={FIELD_INPUT} dir="auto" />
          )}
        </DashboardFormField>
        <DashboardFormField
          label={t("seats")}
          hint={t("seatsHint", { max: MAX_TABLE_SEATS })}
          required
          error={fieldError(errors.seats?.message)}
        >
          {(wiring) => (
            <Input
              {...wiring}
              {...register("seats")}
              size="control-md"
              inputClassName={FIELD_INPUT}
              inputMode="numeric"
              dir="ltr"
            />
          )}
        </DashboardFormField>
      </div>
      <DashboardFormField label={t("area")} hint={t("areaHint")} error={fieldError(errors.area?.message)}>
        {(wiring) => (
          <Input {...wiring} {...register("area")} size="control-md" inputClassName={FIELD_INPUT} dir="auto" />
        )}
      </DashboardFormField>
      <Controller
        control={control}
        name="isActive"
        render={({ field }) => (
          <DashboardSwitchField
            label={t("inUse")}
            hint={t("inUseHint")}
            checked={field.value}
            onCheckedChange={field.onChange}
          />
        )}
      />
    </DashboardDialog>
  );
}
