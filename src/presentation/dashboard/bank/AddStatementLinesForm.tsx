"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import * as React from "react";
import { useForm } from "react-hook-form";

import { statementLinesSchema, type StatementLinesInput } from "@/src/contracts/bank-schema";
import { useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { FormMessage } from "@/src/presentation/design-system/components/form/FormMessage/FormMessage";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { bankStatementsApi } from "./bank-statement-api";
import { StatementLinesFields } from "./StatementLinesFields";

/** More lines for an open statement — a second export, or a line that was missed. */
export function AddStatementLinesForm({ statementId, defaultDay }: { statementId: string; defaultDay: string }) {
  const t = useTranslations("dashBank");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
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
  } = useForm<StatementLinesInput>({
    resolver: zodResolver(statementLinesSchema, undefined, { raw: true }),
    defaultValues: { lines: [] },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await bankStatementsApi.addLines(statementId, values);
      toast({ tone: "success", title: t("addLines.added", { count: values.lines.length }) });
      reset({ lines: [] });
      setOpen(false);
      router.refresh();
    } catch (error) {
      const message = error instanceof ApiError ? error.fieldErrors?.lines : undefined;
      setError("root", {
        message: message
          ? (formErrorMessage(tFormErrors, message) ?? message)
          : localizeApiError(error, tApiErrors, t("addLines.error")),
      });
    }
  });

  if (!open) {
    return (
      <div>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
          {t("addLines.open")}
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-4 rounded-card-lg border border-border bg-background p-4 md:p-6"
      noValidate
    >
      <h2 className="text-body-lead text-foreground">{t("addLines.heading")}</h2>
      <StatementLinesFields control={control} register={register} errors={errors} defaultDay={defaultDay} />
      {errors.root?.message ? <FormMessage size="md">{errors.root.message}</FormMessage> : null}
      <div className="flex gap-3">
        <Button type="submit" size="sm" loading={isSubmitting}>
          {t("addLines.submit")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
