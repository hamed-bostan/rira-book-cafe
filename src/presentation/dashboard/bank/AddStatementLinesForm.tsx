"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";

import { statementLinesSchema, type StatementLinesInput } from "@/src/contracts/bank-schema";
import { useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { cn } from "@/src/lib/utils";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { FormAlert } from "../FormAlert";
import { PAGE_CARD } from "../pageStyles";

import { bankStatementsApi } from "./bank-statement-api";
import { StatementLinesFields } from "./StatementLinesFields";

type AddStatementLinesFormProps = {
  statementId: string;
  defaultDay: string;
  /** Closed, it keeps what was typed for when it opens again. */
  open: boolean;
  onClose: () => void;
};

/** More lines for an open statement — a second export, or a line that was missed. */
export function AddStatementLinesForm({ statementId, defaultDay, open, onClose }: AddStatementLinesFormProps) {
  const t = useTranslations("dashBank");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const router = useRouter();
  const { toast } = useToast();

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
      onClose();
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

  if (!open) return null;

  return (
    <form onSubmit={onSubmit} className={cn(PAGE_CARD, "flex flex-col gap-4 p-5")} noValidate>
      <h2 className="text-body-strong text-foreground">{t("addLines.heading")}</h2>
      <StatementLinesFields control={control} register={register} errors={errors} defaultDay={defaultDay} />
      {errors.root?.message ? <FormAlert>{errors.root.message}</FormAlert> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="control-md" className="px-4" loading={isSubmitting}>
          {t("addLines.submit")}
        </Button>
        <Button type="button" variant="secondary" size="control-md" className="px-3" onClick={onClose}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
