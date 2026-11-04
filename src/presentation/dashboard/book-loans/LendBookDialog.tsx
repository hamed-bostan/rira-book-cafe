"use client";

import { CircleAlert, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { holdsSkippedByLoan, type BookWaitlistEntry } from "@/src/domain/entities/BookWaitlist";
import { normalizePhone } from "@/src/domain/entities/Phone";
import type { LendableBook } from "@/src/domain/repositories/IBookLoanRepository";
import { useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatCafeDayShort } from "@/src/lib/formatCafeDay";
import { formatNumber } from "@/src/lib/formatNumber";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Select } from "@/src/presentation/design-system/components/form/Select/Select";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { DashboardDialog } from "../DashboardDialog";
import { DashboardField } from "../DashboardField";
import { GuestField, type GuestFieldValue } from "../guest-profiles/GuestField";

import { bookLoansApi } from "./book-loan-api";
import { LoanTermsFields } from "./LoanTermsFields";
import { LOAN_TERMS_FIELDS, useLoanTerms } from "./useLoanTerms";

/** A guest told a copy is back, whom it's held for. */
export type HeldCopy = Pick<BookWaitlistEntry, "guestName" | "guestPhone" | "userId">;

type LendBookDialogProps = {
  books: LendableBook[];
  /** Books with copies held for guests who were told: product id → those guests, told longest ago first. */
  heldFor: Readonly<Record<string, readonly HeldCopy[]>>;
  /** Today on the cafe calendar — loans run from here. */
  today: string;
};

const FIELDS = ["productId", "borrowerPhone", "borrowerName", ...LOAN_TERMS_FIELDS] as const;
/** Where a recorded loan shows: the On loan tab, with no search hiding it. */
const LOANS_HREF = "/dashboard/book-loans";

/**
 * Record a book going out: which book (one with every copy out can't be lent —
 * that guest joins its line instead, and the dialog says so), who took it — found
 * by phone, or given a profile with the loan (`GuestField`) — and its terms — for how long, an optional deposit and a note (`LoanTermsFields`, shared
 * with "Lend now" on Book holds). Lending a copy that's held for a guest warns
 * first — the loan skips them. Writes over the REST API, then shows the On loan tab.
 */
export function LendBookDialog({ books, heldFor, today }: LendBookDialogProps) {
  const t = useTranslations("dashBookLoans");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();

  const free = (book: LendableBook): number => Math.max(book.copies - book.onLoan, 0);
  // The first book with a copy on the shelf — or, with every copy of every book
  // out, the first book anyway, so the dialog says why nothing can be lent.
  const firstBook = (books.find((book) => free(book) > 0) ?? books[0])?.id ?? "";

  const [open, setOpen] = React.useState(false);
  const [productId, setProductId] = React.useState(firstBook);
  const [guest, setGuest] = React.useState<GuestFieldValue | null>(null);
  const terms = useLoanTerms(today);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function openDialog(): void {
    setProductId(firstBook);
    setGuest(null);
    terms.reset();
    setError(null);
    setOpen(true);
  }

  const book = books.find((candidate) => candidate.id === productId);
  const allOut = book !== undefined && free(book) < 1;
  // The guest this loan would skip, by the server's own rule: a copy held for
  // someone told it's back (or who borrowed it from the site), going to a different phone.
  const skipped =
    book && !allOut
      ? holdsSkippedByLoan(free(book), heldFor[productId] ?? [], { phone: normalizePhone(guest?.phone ?? "") })
      : [];
  const warning = skipped.length > 0 ? t("heldForWarning", { name: skipped[0].guestName }) : null;
  const blocked = !book || allOut || !guest;

  function submit(): void {
    if (!guest) return;
    setError(null);
    startTransition(async () => {
      try {
        const saved = await bookLoansApi.create({
          productId,
          borrowerPhone: guest.phone,
          borrowerName: guest.name,
          ...terms.values(),
        });
        toast({
          tone: "success",
          title: t("lentToast", {
            name: saved.borrowerName,
            reference: saved.reference,
            date: formatCafeDayShort(terms.dueOn, locale),
          }),
        });
        setOpen(false);
        router.push(LOANS_HREF);
        router.refresh();
      } catch (err) {
        if (err instanceof ApiError) {
          const field = FIELDS.map((name) => err.fieldErrors?.[name]).find(Boolean);
          if (field) {
            setError(formErrorMessage(tFormErrors, field) ?? field);
            return;
          }
          if (err.status === 400 && err.message) {
            setError(err.message);
            return;
          }
        }
        setError(localizeApiError(err, tApiErrors, t("lendError")));
        router.refresh();
      }
    });
  }

  return (
    <>
      <Button size="control-md" type="button" className="gap-2 px-4" onClick={openDialog} disabled={books.length === 0}>
        <Icon icon={Plus} size="icon-md" />
        {t("lend")}
      </Button>

      <DashboardDialog
        open={open}
        onOpenChange={setOpen}
        title={t("lendTitle")}
        subtitle={t("lendSub")}
        submitLabel={t("lendSubmit")}
        blocked={blocked}
        pending={pending}
        onSubmit={submit}
        error={allOut ? t("allOutError") : error}
        aside={
          warning ? (
            <p className="flex items-start gap-1.5 text-body-default font-medium text-pretty text-warning-foreground sm:text-body-small">
              <Icon icon={CircleAlert} size="icon-md" className="mt-0.5 shrink-0" />
              {warning}
            </p>
          ) : null
        }
      >
        <DashboardField label={t("book")}>
          <Select size="control-md" value={productId} onChange={(event) => setProductId(event.target.value)}>
            {books.map((option) => {
              const count = free(option);
              return (
                <option key={option.id} value={option.id} disabled={count < 1}>
                  {option.title} ·{" "}
                  {count > 0 ? t("onShelf", { count, formatted: formatNumber(count, locale) }) : t("allOut")}
                </option>
              );
            })}
          </Select>
        </DashboardField>
        <GuestField onChange={setGuest} disabled={pending} />
        <LoanTermsFields terms={terms} />
      </DashboardDialog>
    </>
  );
}
