"use client";

import { MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuIconTrigger,
  DropdownMenuItem,
} from "@/src/presentation/design-system/components/DropdownMenu/DropdownMenu";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { DashboardDialog } from "../DashboardDialog";
import { DashboardField } from "../DashboardField";

import { journalEntriesApi } from "./accounting-api";

type JournalRowActionsProps = {
  entryId: string;
  number: number;
  /** Today on the cafe calendar — the day the reversal is booked. */
  today: string;
};

/**
 * A reversible entry's "⋯": "Reverse entry" asks why, then posts the opposite
 * lines today. The original stays in the journal, marked reversed. A reversal is
 * itself an entry, so there's no undo — reverse the reversal instead.
 */
export function JournalRowActions({ entryId, number, today }: JournalRowActionsProps) {
  const t = useTranslations("dashAccounting");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function reverse(): void {
    setError(null);
    startTransition(async () => {
      try {
        await journalEntriesApi.reverse(entryId, { date: today, reason });
        toast({ tone: "success", title: t("entry.reversed", { number }) });
        setOpen(false);
        setReason("");
      } catch (err) {
        setError(localizeApiError(err, tApiErrors, t("entry.reverseError")));
      }
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuIconTrigger appearance="secondary" aria-label={t("journal.moreActionsAria", { number })}>
          <Icon icon={MoreHorizontal} size="icon-md" />
        </DropdownMenuIconTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setOpen(true)}>{t("journal.reverse")}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DashboardDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setError(null);
        }}
        title={t("journal.reverseTitle", { number })}
        subtitle={t("journal.reverseSub")}
        submitLabel={t("journal.reverse")}
        blocked={reason.trim() === ""}
        pending={pending}
        onSubmit={reverse}
        error={error}
      >
        <DashboardField label={t("entry.reverseReason")} hint={t("journal.reverseReasonHint")}>
          <Input
            size="control-md"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            autoComplete="off"
            maxLength={200}
            placeholder={t("journal.reverseReasonPlaceholder")}
            dir="auto"
          />
        </DashboardField>
      </DashboardDialog>
    </>
  );
}
