"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { useForm } from "react-hook-form";

import { ledgerAccountSchema, type LedgerAccountInput } from "@/src/contracts/accounting-schema";
import { ACCOUNT_TYPES, typeForCode } from "@/src/domain/entities/Ledger";
import { useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Select } from "@/src/presentation/design-system/components/form/Select/Select";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { DashboardDialog } from "../DashboardDialog";
import { DashboardFormField } from "../DashboardFormField";
import { FIELD_INPUT } from "../fieldStyles";

import { accountsApi } from "./accounting-api";

const FIELDS = ["code", "name", "nameFa", "type"] as const;

/**
 * Add an account to the chart. Typing the code picks the type its first digit
 * implies (1 assets … 5–9 expenses); the server holds the same rule.
 */
export function NewAccountButton() {
  const t = useTranslations("dashAccounting");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const fieldError = (message?: string): string | undefined => formErrorMessage(tFormErrors, message);
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LedgerAccountInput>({
    resolver: zodResolver(ledgerAccountSchema, undefined, { raw: true }),
    defaultValues: { code: "", name: "", nameFa: "", type: "expense" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await accountsApi.create(values);
      toast({ tone: "success", title: t("accounts.created", { code: values.code }) });
      setOpen(false);
      reset();
      router.refresh();
    } catch (error) {
      let applied = false;
      if (error instanceof ApiError) {
        for (const field of FIELDS) {
          const message = error.fieldErrors?.[field];
          if (message) {
            setError(field, { message });
            applied = true;
          }
        }
      }
      if (!applied) setError("root", { message: localizeApiError(error, tApiErrors, t("accounts.error")) });
    }
  });

  const codeField = register("code");

  return (
    <>
      <Button type="button" variant="secondary" size="control-md" className="px-3" onClick={() => setOpen(true)}>
        <Icon icon={Plus} size="icon-md" className="me-2" />
        {t("accounts.new")}
      </Button>
      <DashboardDialog
        open={open}
        onOpenChange={setOpen}
        title={t("accounts.new")}
        subtitle=""
        submitLabel={t("accounts.create")}
        backLabel={t("cancel")}
        pending={isSubmitting}
        onSubmit={() => void onSubmit()}
        error={errors.root?.message}
      >
        <DashboardFormField
          label={t("accounts.codeLabel")}
          required
          hint={t("accounts.codeHint")}
          error={fieldError(errors.code?.message)}
        >
          {(field) => (
            <Input
              {...field}
              {...codeField}
              onChange={(event) => {
                void codeField.onChange(event);
                if (/^\d/.test(event.target.value)) setValue("type", typeForCode(event.target.value));
              }}
              size="control-md"
              inputMode="numeric"
              maxLength={4}
              dir="ltr"
              placeholder="6800"
              inputClassName={FIELD_INPUT}
            />
          )}
        </DashboardFormField>
        <DashboardFormField label={t("accounts.nameLabel")} required error={fieldError(errors.name?.message)}>
          {(field) => (
            <Input {...field} {...register("name")} size="control-md" dir="ltr" inputClassName={FIELD_INPUT} />
          )}
        </DashboardFormField>
        <DashboardFormField label={t("accounts.nameFaLabel")} required error={fieldError(errors.nameFa?.message)}>
          {(field) => (
            <Input {...field} {...register("nameFa")} size="control-md" dir="rtl" inputClassName={FIELD_INPUT} />
          )}
        </DashboardFormField>
        <DashboardFormField label={t("accounts.typeLabel")} error={fieldError(errors.type?.message)}>
          {(field) => (
            <Select {...field} {...register("type")} size="control-md" className="border-border-strong">
              {ACCOUNT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`accountType.${type}`)}
                </option>
              ))}
            </Select>
          )}
        </DashboardFormField>
      </DashboardDialog>
    </>
  );
}
