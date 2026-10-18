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
import { Button, FormMessage, Icon, Input, Modal, ModalContent, Select, TextField, useToast } from "@/src/presentation/design-system";

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
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <Icon icon={Plus} size="sm" className="me-1.5" />
        {t("accounts.new")}
      </Button>
      <Modal open={open} onOpenChange={setOpen}>
        <ModalContent title={t("accounts.new")} className="max-w-md">
          <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-4" noValidate>
            <TextField label={t("accounts.codeLabel")} required description={t("accounts.codeHint")} error={fieldError(errors.code?.message)}>
              {(control) => (
                <Input
                  {...control}
                  {...codeField}
                  onChange={(event) => {
                    void codeField.onChange(event);
                    if (/^\d/.test(event.target.value)) setValue("type", typeForCode(event.target.value));
                  }}
                  inputMode="numeric"
                  maxLength={4}
                  dir="ltr"
                  placeholder="6800"
                />
              )}
            </TextField>
            <TextField label={t("accounts.nameLabel")} required error={fieldError(errors.name?.message)}>
              {(control) => <Input {...control} {...register("name")} dir="ltr" />}
            </TextField>
            <TextField label={t("accounts.nameFaLabel")} required error={fieldError(errors.nameFa?.message)}>
              {(control) => <Input {...control} {...register("nameFa")} dir="rtl" />}
            </TextField>
            <TextField label={t("accounts.typeLabel")} error={fieldError(errors.type?.message)}>
              {(control) => (
                <Select {...control} {...register("type")}>
                  {ACCOUNT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {t(`accountType.${type}`)}
                    </option>
                  ))}
                </Select>
              )}
            </TextField>
            {errors.root?.message ? <FormMessage>{errors.root.message}</FormMessage> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" size="sm" loading={isSubmitting}>
                {t("accounts.create")}
              </Button>
            </div>
          </form>
        </ModalContent>
      </Modal>
    </>
  );
}
