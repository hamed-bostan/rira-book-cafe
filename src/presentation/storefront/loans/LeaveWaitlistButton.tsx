"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { Button, FormMessage } from "@/src/presentation/design-system";

import { storefrontApi } from "../storefront-api";

/** Leave a book's line from the guest's loans page. */
export function LeaveWaitlistButton({ entryId }: { entryId: string }) {
  const t = useTranslations("site");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function leave(): void {
    setError(null);
    startTransition(async () => {
      try {
        await storefrontApi.leaveBookWaitlist(entryId);
      } catch (err) {
        setError(localizeApiError(err, tApiErrors, t("waitlist.error")));
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={leave}>
        {t("waitlist.leave")}
      </Button>
      {error ? <FormMessage>{error}</FormMessage> : null}
    </div>
  );
}
