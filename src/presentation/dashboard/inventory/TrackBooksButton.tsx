"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { DashboardDialog } from "../DashboardDialog";

import { inventoryApi } from "./inventory-api";

/** Put every book for sale under stock, after saying what that does to the books. */
export function TrackBooksButton({ count }: { count: number }) {
  const t = useTranslations("dashInventory");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function submit(): void {
    setError(null);
    startTransition(async () => {
      try {
        const { tracked } = await inventoryApi.trackBooks();
        toast({ tone: "success", title: t("books.saved", { count: tracked }) });
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(localizeApiError(err, tApiErrors, t("books.error")));
      }
    });
  }

  return (
    <>
      <Button type="button" variant="secondary" size="control-sm" className="px-3" onClick={() => setOpen(true)}>
        {t("books.action")}
      </Button>
      <DashboardDialog
        open={open}
        onOpenChange={setOpen}
        title={t("books.confirmTitle", { count })}
        subtitle={t("books.confirmBody")}
        submitLabel={t("books.action")}
        pending={pending}
        onSubmit={submit}
        error={error}
      />
    </>
  );
}
