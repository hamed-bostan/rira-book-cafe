"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import type { BookWaitlistEntry } from "@/src/domain/entities/BookWaitlist";
import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { bookLoansApi } from "../book-loans/book-loan-api";
import { DashboardDialog } from "../DashboardDialog";
import { MessageGuestButton } from "../guest-messages/MessageGuestButton";

import { LendHoldDialog } from "./LendHoldDialog";

type BookHoldActionsProps = {
  entry: Pick<BookWaitlistEntry, "id" | "productId" | "status" | "guestName" | "guestPhone">;
  /** The book's title, for the confirmations and toasts. */
  title: string;
  /** Who's told next, in their Messages, if this guest is skipped. */
  nextInLine: Pick<BookWaitlistEntry, "guestName"> | undefined;
  /** Today on the cafe calendar — "Lend now" runs the loan from here. */
  today: string;
};

/**
 * One hold's controls. The guest whose book is held for them: "Lend now" hands it
 * over (`LendHoldDialog` — length, deposit, note), "Skip" passes the copy to the
 * next in line. A guest still waiting can be taken off the line. Skipping and
 * removing ask first, in red. Each writes over the REST API and `router.refresh()`es.
 */
export function BookHoldActions({ entry, title, nextInLine, today }: BookHoldActionsProps) {
  const t = useTranslations("dashBookHolds");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();
  const [confirming, setConfirming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const ready = entry.status === "notified";
  if (!ready && entry.status !== "waiting") return null;

  function ask(): void {
    setError(null);
    setConfirming(true);
  }

  // Asked first; a failure stays in the dialog so it can be tried again.
  function drop(): void {
    setError(null);
    startTransition(async () => {
      try {
        await bookLoansApi.removeFromWaitlist(entry.id);
        toast({
          tone: "success",
          title: t("removedToast", { name: entry.guestName, title }),
          description: ready && nextInLine ? t("nextToldToast", { name: nextInLine.guestName }) : undefined,
        });
        setConfirming(false);
      } catch (err) {
        setError(localizeApiError(err, tApiErrors, t("actionError")));
      }
      router.refresh();
    });
  }

  return (
    <span className="ms-auto flex shrink-0 items-center gap-2">
      <MessageGuestButton
        appearance="icon"
        guest={{ name: entry.guestName, phone: entry.guestPhone }}
        about={{ kind: "bookHold", id: entry.id, label: title }}
      />
      {ready ? (
        <>
          <Button
            type="button"
            variant="ghost"
            size="control-md"
            disabled={pending}
            onClick={ask}
            className="px-3 font-medium text-muted-foreground hover:bg-muted hover:text-error-foreground"
          >
            {t("skip")}
          </Button>
          <LendHoldDialog entry={entry} title={title} today={today} disabled={pending} />
        </>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="control-md"
          iconOnly
          disabled={pending}
          aria-label={t("removeAria", { name: entry.guestName })}
          title={t("removeAria", { name: entry.guestName })}
          onClick={ask}
          className="text-muted-foreground hover:bg-muted hover:text-error-foreground"
        >
          <Icon icon={X} size="icon-md" />
        </Button>
      )}

      <DashboardDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={ready ? t("skipTitle", { name: entry.guestName }) : t("removeTitle", { name: entry.guestName })}
        subtitle={
          ready
            ? nextInLine
              ? t("skipNext", { name: nextInLine.guestName, title })
              : t("skipNobody", { title })
            : t("removeBody", { title })
        }
        submitLabel={ready ? t("skip") : t("remove")}
        pending={pending}
        onSubmit={drop}
        error={error}
        danger
      />
    </span>
  );
}
