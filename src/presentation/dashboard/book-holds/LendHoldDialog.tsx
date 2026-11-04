"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import type { BookWaitlistEntry } from "@/src/domain/entities/BookWaitlist";
import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatCafeDayShort } from "@/src/lib/formatCafeDay";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { bookLoansApi } from "../book-loans/book-loan-api";
import { LoanTermsFields } from "../book-loans/LoanTermsFields";
import { LOAN_TERMS_FIELDS, useLoanTerms } from "../book-loans/useLoanTerms";
import { DashboardDialog } from "../DashboardDialog";

type LendHoldDialogProps = {
  entry: Pick<BookWaitlistEntry, "id" | "guestName">;
  /** The book's title, for the dialog and the toast. */
  title: string;
  /** Today on the cafe calendar — the loan runs from here. */
  today: string;
  /** Another of the hold's actions is running: wait for it. */
  disabled?: boolean;
};

/**
 * "Lend now" for a guest whose book is held for them — told it's back, or who
 * borrowed it from the site: they're at the counter, so staff hand it over on the
 * terms the Lend dialog takes (`LoanTermsFields`) — how long, an optional deposit,
 * a note. The loan is the hold's guest's, and their hold closes as borrowed.
 * Writes over the REST API and `router.refresh()`es; a failure stays in the dialog.
 */
export function LendHoldDialog({ entry, title, today, disabled = false }: LendHoldDialogProps) {
  const t = useTranslations("dashBookHolds");
  const tLoans = useTranslations("dashBookLoans");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const terms = useLoanTerms(today);
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function openDialog(): void {
    terms.reset();
    setError(null);
    setOpen(true);
  }

  function submit(): void {
    setError(null);
    startTransition(async () => {
      try {
        const loan = await bookLoansApi.lendHold(entry.id, terms.values());
        toast({
          tone: "success",
          title: t("lentToast", {
            title,
            name: entry.guestName,
            reference: loan.reference,
            date: formatCafeDayShort(cafeDayOf(new Date(loan.dueAt)), locale),
          }),
        });
        setOpen(false);
        router.refresh();
      } catch (err) {
        if (err instanceof ApiError) {
          const field = LOAN_TERMS_FIELDS.map((name) => err.fieldErrors?.[name]).find(Boolean);
          if (field) {
            setError(formErrorMessage(tFormErrors, field) ?? field);
            return;
          }
        }
        setError(localizeApiError(err, tApiErrors, t("actionError")));
        router.refresh();
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="control-md"
        className="px-3"
        disabled={disabled}
        onClick={openDialog}
      >
        {t("lendNow")}
      </Button>

      <DashboardDialog
        open={open}
        onOpenChange={setOpen}
        title={t("lendNowTitle", { name: entry.guestName })}
        subtitle={t("lendNowSub", { title })}
        submitLabel={tLoans("lendSubmit")}
        pending={pending}
        onSubmit={submit}
        error={error}
      >
        <LoanTermsFields terms={terms} />
      </DashboardDialog>
    </>
  );
}
