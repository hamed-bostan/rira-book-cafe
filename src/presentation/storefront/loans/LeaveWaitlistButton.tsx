"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { storefrontApi } from "../storefront-api";

/** Leave a book's line from the guest's loans page. */
export function LeaveWaitlistButton({ entryId }: { entryId: string }) {
  const t = useTranslations("site");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();

  function leave(): void {
    startTransition(async () => {
      try {
        await storefrontApi.leaveBookWaitlist(entryId);
        toast({ tone: "success", title: t("waitlist.left") });
      } catch (err) {
        toast({ tone: "error", title: localizeApiError(err, tApiErrors, t("waitlist.error")) });
      }
      router.refresh();
    });
  }

  return (
    <Button type="button" size="sm" variant="outline" loading={pending} onClick={leave}>
      {t("waitlist.leave")}
    </Button>
  );
}
