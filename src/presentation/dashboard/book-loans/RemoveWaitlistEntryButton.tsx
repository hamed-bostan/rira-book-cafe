"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { Button, FormMessage, Icon } from "@/src/presentation/design-system";

import { bookLoansApi } from "./book-loan-api";

/** Take a guest off a book's line. */
export function RemoveWaitlistEntryButton({ entryId, guestName }: { entryId: string; guestName: string }) {
  const t = useTranslations("dashBookLoans");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function remove(): void {
    setError(null);
    startTransition(async () => {
      try {
        await bookLoansApi.removeFromWaitlist(entryId);
      } catch (err) {
        setError(localizeApiError(err, tApiErrors, t("updateError")));
      }
      router.refresh();
    });
  }

  return (
    <span className="inline-flex items-center gap-1">
      <Button type="button" size="sm" variant="ghost" iconOnly aria-label={t("waitlistRemoveAria", { name: guestName })} disabled={pending} onClick={remove}>
        <Icon icon={X} size="xs" />
      </Button>
      {error ? <FormMessage>{error}</FormMessage> : null}
    </span>
  );
}
