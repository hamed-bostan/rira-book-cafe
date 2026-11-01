"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { DashboardDialog } from "../DashboardDialog";
import { DashboardField } from "../DashboardField";
import { FIELD_INPUT } from "../fieldStyles";

import { journalEntriesApi } from "./accounting-api";

type ReverseEntryButtonProps = { entryId: string; number: number; entryDate: string; today: string };

/**
 * Reverse a manual entry: posts its mirror image on the chosen day (between the
 * entry's own date and today), with the reason on the record. Opens the reversal
 * once it's posted.
 */
export function ReverseEntryButton({ entryId, number, entryDate, today }: ReverseEntryButtonProps) {
  const t = useTranslations("dashAccounting");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [date, setDate] = React.useState(today);
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function submit(): void {
    setError(null);
    startTransition(async () => {
      try {
        const reversal = await journalEntriesApi.reverse(entryId, { date, reason });
        toast({ tone: "success", title: t("entry.reversed", { number }) });
        setOpen(false);
        router.push(`/dashboard/accounting/journal/${reversal.id}`);
        router.refresh();
      } catch (err) {
        setError(localizeApiError(err, tApiErrors, t("entry.reverseError")));
      }
    });
  }

  return (
    <>
      <Button type="button" variant="secondary" size="control-md" className="px-3" onClick={() => setOpen(true)}>
        {t("entry.reverse")}
      </Button>
      <DashboardDialog
        open={open}
        onOpenChange={setOpen}
        title={t("entry.reverseTitle", { number })}
        subtitle={t("entry.reverseDescription")}
        submitLabel={t("entry.reverseConfirm")}
        backLabel={t("cancel")}
        blocked={!date || !reason.trim()}
        pending={pending}
        onSubmit={submit}
        error={error}
      >
        <DashboardField label={t("entry.reverseDate")}>
          <Input
            size="control-md"
            type="date"
            value={date}
            min={entryDate}
            max={today}
            onChange={(event) => setDate(event.target.value)}
            dir="ltr"
            inputClassName={FIELD_INPUT}
          />
        </DashboardField>
        <DashboardField label={t("entry.reverseReason")} hint={t("journal.reverseReasonHint")}>
          <Input
            size="control-md"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            autoComplete="off"
            maxLength={200}
            placeholder={t("journal.reverseReasonPlaceholder")}
            dir="auto"
            inputClassName={FIELD_INPUT}
          />
        </DashboardField>
      </DashboardDialog>
    </>
  );
}
