"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { Button, ConfirmSheet, useToast } from "@/src/presentation/design-system";

import { bankStatementsApi } from "./bank-statement-api";

/** Sign the statement off. Offered only when the proof balances; the server checks again in the same transaction. */
export function ReconcileButton({ statementId, ready }: { statementId: string; ready: boolean }) {
  const t = useTranslations("dashBank");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();

  function reconcile(): void {
    startTransition(async () => {
      try {
        await bankStatementsApi.reconcile(statementId);
        toast({ tone: "success", title: t("summary.reconciled") });
        router.refresh();
      } catch (err) {
        toast({ tone: "error", title: localizeApiError(err, tApiErrors, t("summary.reconcileError")) });
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" size="sm" loading={pending} disabled={!ready} onClick={() => setOpen(true)}>
        {t("summary.reconcile")}
      </Button>
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
