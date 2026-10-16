"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { nextBookLoanStatuses, type BookLoan, type BookLoanStatus } from "@/src/domain/entities/BookLoan";
import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { Button, ConfirmSheet, FormMessage } from "@/src/presentation/design-system";

import { bookLoansApi } from "./book-loan-api";

type BookLoanActionsProps = {
  loan: Pick<BookLoan, "id" | "reference" | "status">;
};

/**
 * Close a loan: the book came back, or it's written off (behind a confirmation).
 * Each writes over the REST API and `router.refresh()`es; a 409 shows inline.
 */
export function BookLoanActions({ loan }: BookLoanActionsProps) {
  const t = useTranslations("dashBookLoans");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [confirmingLost, setConfirmingLost] = React.useState(false);

  const steps = nextBookLoanStatuses(loan.status);
  if (steps.length === 0) return null;

  function save(status: BookLoanStatus): void {
    setError(null);
    startTransition(async () => {
      try {
        await bookLoansApi.update(loan.id, { status });
      } catch (err) {
        setError(localizeApiError(err, tApiErrors, t("updateError")));
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {steps.map((status) => (
          <Button
            key={status}
            type="button"
            size="sm"
            variant={status === "lost" ? "outline" : "primary"}
            disabled={pending}
            onClick={() => (status === "lost" ? setConfirmingLost(true) : save(status))}
          >
            {t(`action.${status}`)}
          </Button>
        ))}
      </div>
      {error ? <FormMessage>{error}</FormMessage> : null}

      <ConfirmSheet
        open={confirmingLost}
        onOpenChange={setConfirmingLost}
        title={t("confirmLostTitle", { reference: loan.reference })}
        message={t("confirmLostMessage")}
        confirmLabel={t("action.lost")}
        cancelLabel={t("dialogCancel")}
        onConfirm={() => {
          setConfirmingLost(false);
          save("lost");
        }}
      />
    </div>
  );
}
