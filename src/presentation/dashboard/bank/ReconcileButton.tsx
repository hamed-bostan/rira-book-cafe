"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { Button, ConfirmSheet, FormMessage } from "@/src/presentation/design-system";

import { bankStatementsApi } from "./bank-statement-api";

/** Sign the statement off. Offered only when the proof balances; the server checks again in the same transaction. */
export function ReconcileButton({ statementId, ready }: { statementId: string; ready: boolean }) {
  const t = useTranslations("dashBank");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function reconcile(): void {
    setError(null);
    startTransition(async () => {
      try {
        await bankStatementsApi.reconcile(statementId);
        router.refresh();
      } catch (err) {
        setError(localizeApiError(err, tApiErrors, t("summary.reconcileError")));
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" size="sm" disabled={!ready || pending} onClick={() => setOpen(true)}>
        {t("summary.reconcile")}
      </Button>
      {error ? <FormMessage>{error}</FormMessage> : null}
      <ConfirmSheet
        open={open}
        onOpenChange={setOpen}
        title={t("summary.confirmTitle")}
        message={t("summary.confirmMessage")}
        confirmLabel={t("summary.reconcile")}
        onConfirm={reconcile}
      />
    </div>
  );
}
