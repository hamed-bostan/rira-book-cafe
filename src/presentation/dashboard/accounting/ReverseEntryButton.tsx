"use client";

import { Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { Button, FormMessage, Icon, Input, Modal, ModalContent, Textarea } from "@/src/presentation/design-system";

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
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Icon icon={Undo2} size="sm" className="me-1.5" />
        {t("entry.reverse")}
      </Button>
      <Modal open={open} onOpenChange={setOpen}>
        <ModalContent title={t("entry.reverseTitle", { number })} className="max-w-md">
          <form
            className="mt-4 flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (date && reason.trim()) submit();
            }}
          >
            <p className="text-body-small text-muted-foreground">{t("entry.reverseDescription")}</p>
            <label className="flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
              {t("entry.reverseDate")}
              <Input type="date" value={date} min={entryDate} max={today} onChange={(event) => setDate(event.target.value)} dir="ltr" />
            </label>
            <label className="flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
              {t("entry.reverseReason")}
              <Textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} maxLength={200} dir="auto" />
            </label>
            {error ? <FormMessage>{error}</FormMessage> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" size="sm" disabled={pending || !date || !reason.trim()}>
                {t("entry.reverseConfirm")}
              </Button>
            </div>
          </form>
        </ModalContent>
      </Modal>
    </>
  );
}
