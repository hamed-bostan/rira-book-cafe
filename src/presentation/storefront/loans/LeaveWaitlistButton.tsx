"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { storefrontApi } from "../storefront-api";

type LeaveWaitlistButtonProps = {
  entryId: string;
  /** The book is held for them to collect: giving it up cancels the hold rather than leaving a line. */
  ready: boolean;
};

/** Leave a book's line, or cancel a hold that's ready, from the guest's loans page. */
export function LeaveWaitlistButton({ entryId, ready }: LeaveWaitlistButtonProps) {
  const t = useTranslations("site");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();

  function leave(): void {
    startTransition(async () => {
      try {
        await storefrontApi.leaveBookWaitlist(entryId);
        toast({ tone: "success", title: ready ? t("waitlist.cancelled") : t("waitlist.left") });
      } catch (err) {
        toast({ tone: "error", title: localizeApiError(err, tApiErrors, t("waitlist.error")) });
      }
      router.refresh();
    });
  }

  return (
    <Button type="button" size="sm" variant="outline" loading={pending} onClick={leave}>
      {ready ? t("waitlist.cancel") : t("waitlist.leave")}
    </Button>
  );
}
