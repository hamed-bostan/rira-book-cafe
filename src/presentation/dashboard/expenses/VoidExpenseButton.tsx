"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { Button, FormMessage, Modal, ModalContent, Textarea } from "@/src/presentation/design-system";

import { expensesApi } from "./expense-api";

/** Void an expense entered by mistake: its entries are reversed today; the record stays. */
export function VoidExpenseButton({ id, number }: { id: string; number: number }) {
  const t = useTranslations("dashExpenses");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function submit(): void {
    setError(null);
    startTransition(async () => {
      try {
        await expensesApi.void(id, reason);
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(localizeApiError(err, tApiErrors, t("detail.voidError")));
      }
    });
  }

  return (
    <>
      <Button type="button" size="sm" variant="outline" className="text-destructive" onClick={() => setOpen(true)}>
        {t("detail.void")}
      </Button>
      <Modal open={open} onOpenChange={setOpen}>
        <ModalContent title={t("detail.voidTitle", { number })} className="max-w-md">
          <form
            className="mt-4 flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <p className="text-body-small text-muted-foreground">{t("detail.voidMessage")}</p>
            <label className="flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
              {t("detail.voidReason")}
              <Textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} maxLength={200} dir="auto" />
            </label>
            {error ? <FormMessage>{error}</FormMessage> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" size="sm" disabled={pending}>
                {t("detail.voidConfirm")}
              </Button>
            </div>
          </form>
        </ModalContent>
      </Modal>
    </>
  );
}
