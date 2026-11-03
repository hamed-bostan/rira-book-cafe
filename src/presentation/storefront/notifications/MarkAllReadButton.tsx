"use client";

import { CheckCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { storefrontApi } from "../storefront-api";

/**
 * "Mark all as read": everything in the guest's messages is read now, and the
 * page refreshes so the highlights and the header's badge clear. Unread messages
 * stay highlighted until the guest says so — a note from the cafe shouldn't go
 * quiet just because the page was opened. A failure leaves them unread to try again.
 */
export function MarkAllReadButton() {
  const t = useTranslations("site");
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function markAllRead(): void {
    startTransition(async () => {
      try {
        await storefrontApi.markNotificationsRead();
      } catch {
        return;
      }
      router.refresh();
    });
  }

  return (
    <Button type="button" variant="outline" size="sm" loading={pending} onClick={markAllRead}>
      <Icon icon={CheckCheck} size="sm" className="me-2" />
      {t("notifications.markAllRead")}
    </Button>
  );
}
