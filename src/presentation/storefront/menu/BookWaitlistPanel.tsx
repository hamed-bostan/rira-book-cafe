"use client";

import { BellRing, BookOpen } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { HOLD_PICKUP_DAYS, type BookWaitlistStatus } from "@/src/domain/entities/BookWaitlist";
import { Link, useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatNumber } from "@/src/lib/formatNumber";
import { formatOrderDate } from "@/src/lib/formatOrderDate";
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
 * A book's lending on its page. With a copy on the shelf that nobody holds or
 * waits for (`canBorrow`), the guest borrows it: it's held at the counter for them
 * to collect. With every copy out or held (`canJoin`), how many are out and how
 * long the line is, and a button to get in line — the guest at the front is told
 * when a copy comes back. Once they hold it or are in line, their place, and a way
 * to give it up. Signed out, a link to sign in instead.
 */
export function BookWaitlistPanel({ productId, status, signedIn }: BookWaitlistPanelProps) {
  const t = useTranslations("site");
  const tApiErrors = useTranslations("apiErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();

  const entry = status.entry;
  const ready = entry?.status === "notified";

  /** Borrows, joins or leaves; `success` is toasted when the refreshed panel doesn't make the outcome obvious. */
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

  const signInLink = (label: string): React.ReactNode => (
    <Link
      href={`/login?callbackUrl=${encodeURIComponent(`/menu/${productId}`)}`}
      className="text-body-small-emphasis text-primary underline-offset-4 hover:underline"
    >
      {label}
    </Link>
  );

  return (
    <div className="flex flex-col gap-3 rounded-card-md border border-border px-4 py-3">
      {/* A copy to borrow, or what's out and how long the line is — nothing once a copy is
          held for them, or with every copy lost and nobody waiting. */}
      {ready ? null : !entry && status.canBorrow ? (
        <p className="flex items-start gap-2 text-body-small text-foreground">
          <Icon icon={BookOpen} size="xs" className="mt-0.5 shrink-0 text-primary" />
          <span>
            {t("waitlist.onShelf")}{" "}
            {t("waitlist.borrowHint", { days: HOLD_PICKUP_DAYS, formatted: formatNumber(HOLD_PICKUP_DAYS, locale) })}
          </span>
        </p>
      ) : status.onLoan > 0 || status.queueLength > 0 ? (
        <p className="flex items-start gap-2 text-body-small text-foreground">
          <Icon icon={BellRing} size="xs" className="mt-0.5 shrink-0 text-primary" />
          <span>
            {status.onLoan > 0
              ? `${t("waitlist.onLoan", { count: status.onLoan, formatted: formatNumber(status.onLoan, locale) })} `
              : null}
            {status.queueLength > 0
              ? t("waitlist.inLine", {
                  count: status.queueLength,
                  formatted: formatNumber(status.queueLength, locale),
                })
              : null}
          </span>
        </p>
      ) : null}

      {entry ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex min-w-0 flex-col">
            <span className="text-body-small-strong text-primary">
              {ready
                ? t("waitlist.yourTurn")
                : t("waitlist.position", { position: formatNumber(status.position ?? 1, locale) })}
            </span>
            {ready && entry.pickupBy ? (
              <span className="text-body-caption text-muted-foreground">
                {t("waitlist.collectBy", { date: formatOrderDate(entry.pickupBy, locale) })}
              </span>
            ) : null}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            loading={pending}
            onClick={() =>
              run(() => storefrontApi.leaveBookWaitlist(entry.id), ready ? t("waitlist.cancelled") : t("waitlist.left"))
            }
          >
            {ready ? t("waitlist.cancel") : t("waitlist.leave")}
          </Button>
        </div>
      ) : status.canBorrow ? (
        signedIn ? (
          <Button
            type="button"
            size="sm"
            className="self-start"
            loading={pending}
            onClick={() => run(() => storefrontApi.borrowBook(productId))}
          >
            {t("waitlist.borrow")}
          </Button>
        ) : (
          signInLink(t("waitlist.signInToBorrow"))
        )
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
        signInLink(t("waitlist.signIn"))
      )}
    </div>
  );
}
