"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { bookLoansApi } from "./book-loan-api";

/** Take a guest off a book's line. */
export function RemoveWaitlistEntryButton({ entryId, guestName }: { entryId: string; guestName: string }) {
  const t = useTranslations("dashBookLoans");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const { toast } = useToast();

  function remove(): void {
    startTransition(async () => {
      try {
        await bookLoansApi.removeFromWaitlist(entryId);
        toast({ tone: "success", title: t("waitlistRemoved", { name: guestName }) });
      } catch (err) {
        toast({ tone: "error", title: localizeApiError(err, tApiErrors, t("updateError")) });
      }
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      iconOnly
      aria-label={t("waitlistRemoveAria", { name: guestName })}
      loading={pending}
      onClick={remove}
    >
      <Icon icon={X} size="xs" />
    </Button>
  );
}
