"use client";

import { MoreHorizontal } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import type { BookLoan, BookLoanStatus } from "@/src/domain/entities/BookLoan";
import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatCafeDayShort } from "@/src/lib/formatCafeDay";
import { formatNumber } from "@/src/lib/formatNumber";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuIconTrigger,
  DropdownMenuItem,
} from "@/src/presentation/design-system/components/DropdownMenu/DropdownMenu";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { DashboardDialog } from "../DashboardDialog";

import { bookLoansApi } from "./book-loan-api";

/** How much more time "Extend" gives. */
const EXTEND_DAYS = 7;

type BookLoanRowActionsProps = {
  loan: Pick<BookLoan, "id" | "reference" | "status" | "bookTitle" | "borrowerName">;
  /** Told the copy is theirs when it comes back — named in the toast. */
  firstInLine: string | undefined;
};

/**
 * A loan's controls: "Returned" (for a book that's out, or turned up after being
 * written off), and behind "⋯" for one that's out, "Extend 7 days" and "Mark lost"
 * (which asks first, in red). Each writes over the REST API and `router.refresh()`es.
 */
export function BookLoanRowActions({ loan, firstInLine }: BookLoanRowActionsProps) {
  const t = useTranslations("dashBookLoans");
  const tApiErrors = useTranslations("apiErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();
  const [confirmLost, setConfirmLost] = React.useState(false);
  const [lostError, setLostError] = React.useState<string | null>(null);

  function run(change: { status: BookLoanStatus } | { extendDays: number }): void {
    startTransition(async () => {
      try {
        const saved = await bookLoansApi.update(loan.id, change);
        if ("extendDays" in change) {
          toast({
            tone: "success",
            title: t("extendedToast", {
              reference: loan.reference,
              date: formatCafeDayShort(cafeDayOf(new Date(saved.dueAt)), locale),
            }),
          });
        } else {
          toast({
            tone: "success",
            title: t(`updated.${change.status}`, { reference: loan.reference }),
            description:
              change.status === "returned" && firstInLine
                ? t("firstInLineTold", { name: firstInLine, title: loan.bookTitle })
                : undefined,
          });
        }
      } catch (err) {
        toast({ tone: "error", title: localizeApiError(err, tApiErrors, t("updateError")) });
      }
      router.refresh();
    });
  }

  // Asked first; a failure stays in the dialog so it can be tried again.
  function markLost(): void {
    setLostError(null);
    startTransition(async () => {
      try {
        await bookLoansApi.update(loan.id, { status: "lost" });
        toast({ tone: "success", title: t("updated.lost", { reference: loan.reference }) });
        setConfirmLost(false);
      } catch (err) {
        setLostError(localizeApiError(err, tApiErrors, t("updateError")));
      }
      router.refresh();
    });
  }

  return (
    <div className="ms-auto flex shrink-0 items-center gap-2">
      <Button
        type="button"
        variant="secondary"
        size="control-md"
        className="px-3"
        loading={pending}
        onClick={() => run({ status: "returned" })}
      >
        {t("action.returned")}
      </Button>
      {loan.status === "out" ? (
        <DropdownMenu>
          <DropdownMenuIconTrigger
            appearance="secondary"
            disabled={pending}
            aria-label={t("moreActionsAria", { reference: loan.reference })}
          >
            <Icon icon={MoreHorizontal} size="sm" className="sm:size-4" />
          </DropdownMenuIconTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => run({ extendDays: EXTEND_DAYS })}>
              {t("extend", { days: EXTEND_DAYS, formatted: formatNumber(EXTEND_DAYS, locale) })}
            </DropdownMenuItem>
            <DropdownMenuItem
              destructive
              onSelect={() => {
                setLostError(null);
                setConfirmLost(true);
              }}
            >
              {t("markLost")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      <DashboardDialog
        open={confirmLost}
        onOpenChange={setConfirmLost}
        title={t("confirmLostTitle", { reference: loan.reference })}
        subtitle={t("confirmLostBody", { title: loan.bookTitle, name: loan.borrowerName })}
        submitLabel={t("markLost")}
        pending={pending}
        onSubmit={markLost}
        error={lostError}
        danger
      />
    </div>
  );
}
