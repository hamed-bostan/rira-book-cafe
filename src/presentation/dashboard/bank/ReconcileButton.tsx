"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { DashboardDialog } from "../DashboardDialog";

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
    <>
      <Button
        type="button"
        size="control-md"
        className="w-full"
        loading={pending}
        disabled={!ready}
        onClick={() => setOpen(true)}
      >
        {t("summary.reconcile")}
      </Button>
      <DashboardDialog
        open={open}
        onOpenChange={setOpen}
        title={t("summary.confirmTitle")}
        subtitle={t("summary.confirmMessage")}
        submitLabel={t("summary.reconcile")}
        pending={false}
        onSubmit={() => {
          reconcile();
          setOpen(false);
        }}
      />
    </>
  );
}
