"use client";

import { Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { DEFAULT_LOAN_DAYS, MAX_BORROWER_NAME_LENGTH, MAX_LOAN_DAYS, MAX_LOAN_NOTE_LENGTH } from "@/src/domain/entities/BookLoan";
import { shiftCafeDay } from "@/src/domain/entities/CafeTime";
import type { LendableBook } from "@/src/domain/repositories/IBookLoanRepository";
import { useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatNumber } from "@/src/lib/formatNumber";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { Button, FormMessage, Icon, Input, Modal, ModalContent, Select, Textarea } from "@/src/presentation/design-system";

import { bookLoansApi } from "./book-loan-api";

type LendBookDialogProps = {
  books: LendableBook[];
  /** Today on the cafe calendar — the earliest due day, and where the default is counted from. */
  today: string;
};

const FIELDS = ["productId", "borrowerName", "borrowerPhone", "dueOn", "note"] as const;

/**
 * Record a book going out: which book, who took it (name and phone — they needn't
 * have an account), when it's due back, and an optional note. Writes over the REST
 * API, then `router.refresh()`es the list.
 */
export function LendBookDialog({ books, today }: LendBookDialogProps) {
  const t = useTranslations("dashBookLoans");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const locale = useLocale();
  const router = useRouter();

  const [open, setOpen] = React.useState(false);
  const [productId, setProductId] = React.useState("");
  const [borrowerName, setBorrowerName] = React.useState("");
  const [borrowerPhone, setBorrowerPhone] = React.useState("");
  const [dueOn, setDueOn] = React.useState(shiftCafeDay(today, DEFAULT_LOAN_DAYS));
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function reset(): void {
    setProductId("");
    setBorrowerName("");
    setBorrowerPhone("");
    setDueOn(shiftCafeDay(today, DEFAULT_LOAN_DAYS));
    setNote("");
    setError(null);
  }

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await bookLoansApi.create({ productId, borrowerName, borrowerPhone, dueOn, note });
        setOpen(false);
        reset();
        router.refresh();
      } catch (err) {
        if (err instanceof ApiError) {
          const field = FIELDS.map((name) => err.fieldErrors?.[name]).find(Boolean);
          if (field) {
            setError(formErrorMessage(tFormErrors, field) ?? field);
            return;
          }
          // Domain validation (due date out of range) arrives as a plain message.
          if (err.status === 400 && err.message) {
            setError(err.message);
            return;
          }
        }
        setError(localizeApiError(err, tApiErrors, t("lendError")));
      }
    });
  }

  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)} disabled={books.length === 0}>
        <Icon icon={Plus} size="sm" className="me-1" />
        {t("lend")}
      </Button>

      <Modal open={open} onOpenChange={setOpen}>
        <ModalContent title={t("lendTitle")}>
          <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
              {t("book")}
              <Select value={productId} onChange={(event) => setProductId(event.target.value)} required>
                <option value="" disabled>
                  {t("pickBook")}
                </option>
                {books.map((book) => (
                  <option key={book.id} value={book.id}>
                    {book.author ? `${book.title} — ${book.author}` : book.title}
                    {book.onLoan > 0 ? ` (${t("copiesOut", { count: book.onLoan, formatted: formatNumber(book.onLoan, locale) })})` : ""}
                  </option>
                ))}
              </Select>
            </label>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
                {t("borrowerName")}
                <Input
                  value={borrowerName}
                  onChange={(event) => setBorrowerName(event.target.value)}
                  maxLength={MAX_BORROWER_NAME_LENGTH}
                  required
                  autoComplete="off"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
                {t("borrowerPhone")}
                <Input
                  type="tel"
                  inputMode="tel"
                  value={borrowerPhone}
                  onChange={(event) => setBorrowerPhone(event.target.value)}
                  placeholder="0912…"
                  required
                  dir="ltr"
                  autoComplete="off"
                />
              </label>
            </div>
            <label className="flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
              {t("dueOn")}
              <Input
                type="date"
                value={dueOn}
                min={today}
                max={shiftCafeDay(today, MAX_LOAN_DAYS)}
                onChange={(event) => setDueOn(event.target.value)}
                required
                dir="ltr"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
              {t("note")}
              <Textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={MAX_LOAN_NOTE_LENGTH}
                rows={2}
                placeholder={t("notePlaceholder")}
              />
            </label>
            <p className="text-body-caption text-muted-foreground">{t("phoneHint")}</p>
            {error ? <FormMessage>{error}</FormMessage> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                {t("dialogCancel")}
              </Button>
              <Button type="submit" size="sm" disabled={pending || !productId}>
                {pending ? t("lending") : t("lendSubmit")}
              </Button>
            </div>
          </form>
        </ModalContent>
      </Modal>
    </>
  );
}
