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
import { ConfirmSheet } from "@/src/presentation/design-system/components/Sheet/ConfirmSheet";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

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
 * (which asks first). Each writes over the REST API and `router.refresh()`es.
 */
export function BookLoanRowActions({ loan, firstInLine }: BookLoanRowActionsProps) {
  const t = useTranslations("dashBookLoans");
  const tApiErrors = useTranslations("apiErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();
  const [confirmLost, setConfirmLost] = React.useState(false);

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

  return (
    <div className="ms-auto flex shrink-0 items-center gap-2">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="px-3"
        loading={pending}
        onClick={() => run({ status: "returned" })}
      >
        {t("action.returned")}
      </Button>
      {loan.status === "out" ? (
        <DropdownMenu>
          <DropdownMenuIconTrigger disabled={pending} aria-label={t("moreActionsAria", { reference: loan.reference })}>
            <Icon icon={MoreHorizontal} size="xs" />
          </DropdownMenuIconTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => run({ extendDays: EXTEND_DAYS })}>
              {t("extend", { days: EXTEND_DAYS, formatted: formatNumber(EXTEND_DAYS, locale) })}
            </DropdownMenuItem>
            <DropdownMenuItem destructive onSelect={() => setConfirmLost(true)}>
              {t("markLost")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      <ConfirmSheet
        open={confirmLost}
        onOpenChange={setConfirmLost}
        title={t("confirmLostTitle", { reference: loan.reference })}
        message={t("confirmLostBody", { title: loan.bookTitle, name: loan.borrowerName })}
        confirmLabel={t("markLost")}
        cancelLabel={t("dialogCancel")}
        onConfirm={() => {
          setConfirmLost(false);
          run({ status: "lost" });
        }}
      />
    </div>
  );
}
