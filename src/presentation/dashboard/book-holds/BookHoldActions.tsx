"use client";

import { X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { DEFAULT_LOAN_DAYS } from "@/src/domain/entities/BookLoan";
import type { BookWaitlistEntry } from "@/src/domain/entities/BookWaitlist";
import { cafeDayOf, shiftCafeDay } from "@/src/domain/entities/CafeTime";
import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatCafeDayShort } from "@/src/lib/formatCafeDay";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { ConfirmSheet } from "@/src/presentation/design-system/components/Sheet/ConfirmSheet";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { bookLoansApi } from "../book-loans/book-loan-api";

type BookHoldActionsProps = {
  entry: Pick<BookWaitlistEntry, "id" | "productId" | "status" | "guestName" | "guestPhone">;
  /** The book's title, for the confirmations and toasts. */
  title: string;
  /** Who's told next if this guest is skipped. */
  nextInLine: string | undefined;
  /** Today on the cafe calendar — "Lend now" runs the standard length from here. */
  today: string;
};

/**
 * One hold's controls. The guest who was told the book is back: "Lend now" records
 * the loan for them (the standard length), "Skip" passes the copy to the next in
 * line. A guest still waiting can be taken off the line. Skipping and removing ask
 * first. Each writes over the REST API and `router.refresh()`es.
 */
export function BookHoldActions({ entry, title, nextInLine, today }: BookHoldActionsProps) {
  const t = useTranslations("dashBookHolds");
  const tApiErrors = useTranslations("apiErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();
  const [confirming, setConfirming] = React.useState(false);

  const ready = entry.status === "notified";
  if (!ready && entry.status !== "waiting") return null;

  function lend(): void {
    startTransition(async () => {
      try {
        const loan = await bookLoansApi.create({
          productId: entry.productId,
          borrowerName: entry.guestName,
          borrowerPhone: entry.guestPhone,
          dueOn: shiftCafeDay(today, DEFAULT_LOAN_DAYS),
        });
        toast({
          tone: "success",
          title: t("lentToast", {
            title,
            name: entry.guestName,
            reference: loan.reference,
            date: formatCafeDayShort(cafeDayOf(new Date(loan.dueAt)), locale),
          }),
        });
      } catch (err) {
        toast({ tone: "error", title: localizeApiError(err, tApiErrors, t("actionError")) });
      }
      router.refresh();
    });
  }

  function drop(): void {
    startTransition(async () => {
      try {
        await bookLoansApi.removeFromWaitlist(entry.id);
        toast({
          tone: "success",
          title: t("removedToast", { name: entry.guestName, title }),
          description: ready && nextInLine ? t("nextToldToast", { name: nextInLine }) : undefined,
        });
      } catch (err) {
        toast({ tone: "error", title: localizeApiError(err, tApiErrors, t("actionError")) });
      }
      router.refresh();
    });
  }

  return (
    <span className="ms-auto flex shrink-0 items-center gap-2">
      {ready ? (
        <>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => setConfirming(true)}
            className="px-3 font-medium text-muted-foreground hover:bg-muted hover:text-error-foreground"
          >
            {t("skip")}
          </Button>
          <Button type="button" variant="secondary" size="sm" className="px-3" loading={pending} onClick={lend}>
            {t("lendNow")}
          </Button>
        </>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          iconOnly
          disabled={pending}
          aria-label={t("removeAria", { name: entry.guestName })}
          title={t("removeAria", { name: entry.guestName })}
          onClick={() => setConfirming(true)}
          className="text-muted-foreground hover:bg-muted hover:text-error-foreground"
        >
          <Icon icon={X} size="sm" />
        </Button>
      )}

      <ConfirmSheet
        open={confirming}
        onOpenChange={setConfirming}
        title={ready ? t("skipTitle", { name: entry.guestName }) : t("removeTitle", { name: entry.guestName })}
        message={
          ready
            ? nextInLine
              ? t("skipNext", { name: nextInLine, title })
              : t("skipNobody", { title })
            : t("removeBody", { title })
        }
        confirmLabel={ready ? t("skip") : t("remove")}
        cancelLabel={t("back")}
        onConfirm={() => {
          setConfirming(false);
          drop();
        }}
      />
    </span>
  );
}
