"use client";

import { BellRing } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import type { BookWaitlistStatus } from "@/src/domain/entities/BookWaitlist";
import { Link, useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatNumber } from "@/src/lib/formatNumber";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { storefrontApi } from "../storefront-api";

type BookWaitlistPanelProps = {
  productId: string;
  status: BookWaitlistStatus;
  signedIn: boolean;
};

/**
 * For a book that's out on loan: how many copies are out and how long the line
 * is, and a button to get in line (or leave it). The guest at the front is told
 * on their account when a copy comes back.
 */
export function BookWaitlistPanel({ productId, status, signedIn }: BookWaitlistPanelProps) {
  const t = useTranslations("site");
  const tApiErrors = useTranslations("apiErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();

  const entry = status.entry;
  if (status.onLoan === 0 && !entry) return null;

  /** Joins or leaves the line; `success` is toasted when the refreshed panel doesn't make the outcome obvious. */
  function run(action: () => Promise<unknown>, success?: string): void {
    startTransition(async () => {
      try {
        await action();
        if (success) toast({ tone: "success", title: success });
      } catch (err) {
        toast({ tone: "error", title: localizeApiError(err, tApiErrors, t("waitlist.error")) });
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-card-md border border-border px-4 py-3">
      <p className="flex items-start gap-2 text-body-small text-foreground">
        <Icon icon={BellRing} size="xs" className="mt-0.5 shrink-0 text-primary" />
        <span>
          {t("waitlist.onLoan", { count: status.onLoan, formatted: formatNumber(status.onLoan, locale) })}{" "}
          {status.queueLength > 0
            ? t("waitlist.inLine", { count: status.queueLength, formatted: formatNumber(status.queueLength, locale) })
            : null}
        </span>
      </p>

      {entry ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-body-small-strong text-primary">
            {entry.status === "notified"
              ? t("waitlist.yourTurn")
              : t("waitlist.position", { position: formatNumber(status.position ?? 1, locale) })}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            loading={pending}
            onClick={() => run(() => storefrontApi.leaveBookWaitlist(entry.id), t("waitlist.left"))}
          >
            {t("waitlist.leave")}
          </Button>
        </div>
      ) : signedIn ? (
        <Button
          type="button"
          size="sm"
          className="self-start"
          loading={pending}
          onClick={() => run(() => storefrontApi.joinBookWaitlist(productId))}
        >
          {t("waitlist.join")}
        </Button>
      ) : (
        <Link
          href={`/login?callbackUrl=${encodeURIComponent(`/menu/${productId}`)}`}
          className="text-body-small-emphasis text-primary underline-offset-4 hover:underline"
        >
          {t("waitlist.signIn")}
        </Link>
      )}
    </div>
  );
}
