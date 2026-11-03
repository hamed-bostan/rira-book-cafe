"use client";

import { CircleAlert, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import {
  LOAN_DEPOSIT_METHODS,
  MAX_BORROWER_NAME_LENGTH,
  MAX_LOAN_NOTE_LENGTH,
  type LoanDepositMethod,
} from "@/src/domain/entities/BookLoan";
import { holdsSkippedByLoan, type BookWaitlistEntry } from "@/src/domain/entities/BookWaitlist";
import { shiftCafeDay } from "@/src/domain/entities/CafeTime";
import { normalizePhone } from "@/src/domain/entities/Phone";
import type { LendableBook } from "@/src/domain/repositories/IBookLoanRepository";
import { useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatCafeDayLong, formatCafeDayShort } from "@/src/lib/formatCafeDay";
import { formatNumber } from "@/src/lib/formatNumber";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { normalizeAmount } from "@/src/presentation/dashboard/expenses/expenseFormat";
import { OverviewSegmented } from "@/src/presentation/dashboard/overview/OverviewSegmented";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Select } from "@/src/presentation/design-system/components/form/Select/Select";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { DashboardDialog } from "../DashboardDialog";
import { DashboardField } from "../DashboardField";
import { FIELD_GRID, FIELD_HINT, FIELD_LABEL } from "../fieldStyles";

import { bookLoansApi } from "./book-loan-api";

/** A guest told a copy is back, whom it's held for. */
export type HeldCopy = Pick<BookWaitlistEntry, "guestName" | "guestPhone" | "userId">;

type LendBookDialogProps = {
  books: LendableBook[];
  /** Books with copies held for guests who were told: product id → those guests, told longest ago first. */
  heldFor: Readonly<Record<string, readonly HeldCopy[]>>;
  /** Today on the cafe calendar — loans run from here. */
  today: string;
};

const FIELDS = ["productId", "borrowerName", "borrowerPhone", "dueOn", "note"] as const;
/** The loan lengths the desk offers, in days. */
const LENGTHS = ["7", "14", "21"] as const;
type Length = (typeof LENGTHS)[number];
const DEFAULT_LENGTH: Length = "14";
/** Where a recorded loan shows: the On loan tab, with no search hiding it. */
const LOANS_HREF = "/dashboard/book-loans";

/**
 * Record a book going out: which book (one with every copy out can't be lent —
 * that guest joins its line instead, and the dialog says so), who took it (they
 * needn't have an account), for how long, and an optional note. Lending a copy
 * that's held for a guest who was told it's back warns first — the loan skips
 * them. Writes over the REST API, then shows the On loan tab.
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
  const [borrowerName, setBorrowerName] = React.useState("");
  const [borrowerPhone, setBorrowerPhone] = React.useState("");
  const [length, setLength] = React.useState<Length>(DEFAULT_LENGTH);
  const [note, setNote] = React.useState("");
  const [depositAmount, setDepositAmount] = React.useState("");
  const [depositMethod, setDepositMethod] = React.useState<LoanDepositMethod>("cash");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function openDialog(): void {
    setProductId(firstBook);
    setBorrowerName("");
    setBorrowerPhone("");
    setLength(DEFAULT_LENGTH);
    setNote("");
    setDepositAmount("");
    setDepositMethod("cash");
    setError(null);
    setOpen(true);
  }

  const dueOn = shiftCafeDay(today, Number(length));
  const book = books.find((candidate) => candidate.id === productId);
  const allOut = book !== undefined && free(book) < 1;
  // The guest this loan would skip, by the server's own rule: a copy held for
  // someone told it's back, going to a different phone.
  const skipped =
    book && !allOut
      ? holdsSkippedByLoan(free(book), heldFor[productId] ?? [], { phone: normalizePhone(borrowerPhone) })
      : [];
  const warning = skipped.length > 0 ? t("heldForWarning", { name: skipped[0].guestName }) : null;
  const blocked = !book || allOut || !borrowerName.trim() || !borrowerPhone.trim();

  function submit(): void {
    setError(null);
    startTransition(async () => {
      try {
        const deposit = normalizeAmount(depositAmount);
        const saved = await bookLoansApi.create({
          productId,
          borrowerName,
          borrowerPhone,
          dueOn,
          note,
          depositAmount: deposit,
          depositMethod: deposit ? depositMethod : undefined,
        });
        toast({
          tone: "success",
          title: t("lentToast", {
            name: saved.borrowerName,
            reference: saved.reference,
            date: formatCafeDayShort(dueOn, locale),
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
        <DashboardField label={t("borrowerName")}>
          <Input
            size="control-md"
            value={borrowerName}
            onChange={(event) => setBorrowerName(event.target.value)}
            maxLength={MAX_BORROWER_NAME_LENGTH}
            placeholder={t("namePlaceholder")}
            autoComplete="off"
          />
        </DashboardField>
        <DashboardField label={t("borrowerPhone")} hint={t("phoneHint")}>
          <Input
            size="control-md"
            type="tel"
            inputMode="tel"
            value={borrowerPhone}
            onChange={(event) => setBorrowerPhone(event.target.value)}
            placeholder="0912 345 6789"
            autoComplete="off"
            dir="ltr"
          />
        </DashboardField>
        <div className="flex flex-col gap-1.5">
          <span className={FIELD_LABEL}>{t("dueBack")}</span>
          <OverviewSegmented
            label={t("loanLength")}
            value={length}
            onChange={setLength}
            fill
            options={LENGTHS.map((value) => ({
              value,
              label: t("days", { count: Number(value), formatted: formatNumber(Number(value), locale) }),
            }))}
          />
          <span className={FIELD_HINT}>{t("dueOnDay", { date: formatCafeDayLong(dueOn, locale) })}</span>
        </div>
        <div className={FIELD_GRID}>
          <DashboardField label={t("depositLabel")} hint={t("depositHint")}>
            <Input
              size="control-md"
              value={depositAmount}
              onChange={(event) => setDepositAmount(event.target.value)}
              autoComplete="off"
              inputMode="numeric"
              placeholder="0"
              dir="ltr"
            />
          </DashboardField>
          {depositAmount.trim() ? (
            <DashboardField label={t("depositMethodLabel")}>
              <Select
                size="control-md"
                value={depositMethod}
                onChange={(event) => setDepositMethod(event.target.value as LoanDepositMethod)}
              >
                {LOAN_DEPOSIT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {t(`depositMethod.${method}`)}
                  </option>
                ))}
              </Select>
            </DashboardField>
          ) : null}
        </div>
        <DashboardField label={t("note")}>
          <Input
            size="control-md"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={MAX_LOAN_NOTE_LENGTH}
            placeholder={t("notePlaceholder")}
            autoComplete="off"
          />
        </DashboardField>
      </DashboardDialog>
    </>
  );
}
