"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";

import { supplierSchema, type SupplierFormInput } from "@/src/contracts/expense-schema";
import type { Supplier } from "@/src/domain/entities/Expense";
import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { Button, FormMessage, Icon, Input, Modal, ModalContent, Switch, TextField } from "@/src/presentation/design-system";

import { suppliersApi } from "./expense-api";

function toDefaults(supplier?: Supplier): SupplierFormInput {
  return { name: supplier?.name ?? "", phone: supplier?.phone ?? "", note: supplier?.note ?? "", isActive: supplier?.isActive ?? true };
}

/** Add a supplier, or edit one (including switching it off). */
export function SupplierDialog({ supplier }: { supplier?: Supplier }) {
  const t = useTranslations("dashExpenses");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const fieldError = (message?: string): string | undefined => formErrorMessage(tFormErrors, message);
  const router = useRouter();
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
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(true)} aria-label={t("suppliers.edit", { name: supplier.name })}>
          <Icon icon={Pencil} size="sm" />
        </Button>
      ) : (
        <Button type="button" size="sm" onClick={() => setOpen(true)}>
          <Icon icon={Plus} size="sm" className="me-1.5" />
          {t("suppliers.new")}
        </Button>
      )}
      <Modal open={open} onOpenChange={setOpen}>
        <ModalContent title={supplier ? supplier.name : t("suppliers.new")} className="max-w-md">
          <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-4" noValidate>
            <TextField label={t("suppliers.nameLabel")} required error={fieldError(errors.name?.message)}>
              {(controlProps) => <Input {...controlProps} {...register("name")} dir="auto" />}
            </TextField>
            <TextField label={t("suppliers.phoneLabel")} error={fieldError(errors.phone?.message)}>
              {(controlProps) => <Input {...controlProps} {...register("phone")} inputMode="tel" dir="ltr" />}
            </TextField>
            <TextField label={t("suppliers.noteLabel")} error={fieldError(errors.note?.message)}>
              {(controlProps) => <Input {...controlProps} {...register("note")} dir="auto" />}
            </TextField>
            {supplier ? (
              <Controller
                control={control}
                name="isActive"
                render={({ field }) => (
                  <label className="flex items-center justify-between gap-3 text-body-small-emphasis text-foreground">
                    {t("suppliers.activeLabel")}
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </label>
                )}
              />
            ) : null}
            {errors.root?.message ? <FormMessage>{errors.root.message}</FormMessage> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {t("suppliers.save")}
              </Button>
            </div>
          </form>
        </ModalContent>
      </Modal>
    </>
  );
}
