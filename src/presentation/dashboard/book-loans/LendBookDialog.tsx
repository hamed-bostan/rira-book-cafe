"use client";

import { CircleAlert, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { MAX_BORROWER_NAME_LENGTH, MAX_LOAN_NOTE_LENGTH } from "@/src/domain/entities/BookLoan";
import { shiftCafeDay } from "@/src/domain/entities/CafeTime";
import type { LendableBook } from "@/src/domain/repositories/IBookLoanRepository";
import { useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatCafeDayLong, formatCafeDayShort } from "@/src/lib/formatCafeDay";
import { formatNumber } from "@/src/lib/formatNumber";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { OverviewSegmented } from "@/src/presentation/dashboard/overview/OverviewSegmented";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { FormMessage } from "@/src/presentation/design-system/components/form/FormMessage/FormMessage";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Select } from "@/src/presentation/design-system/components/form/Select/Select";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { Modal, ModalContent } from "@/src/presentation/design-system/components/Modal/Modal";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { bookLoansApi } from "./book-loan-api";

type LendBookDialogProps = {
  books: LendableBook[];
  /** Books whose free copy is held for the guest at the front of the line: product id → their name. */
  heldFor: Readonly<Record<string, string>>;
  /** Today on the cafe calendar — loans run from here. */
  today: string;
};

const FIELDS = ["productId", "borrowerName", "borrowerPhone", "dueOn", "note"] as const;
/** The loan lengths the desk offers, in days. */
const LENGTHS = ["7", "14", "21"] as const;
type Length = (typeof LENGTHS)[number];
const DEFAULT_LENGTH: Length = "14";

/**
 * Record a book going out: which book (one with every copy out can't be picked —
 * that guest joins its line instead), who took it (they needn't have an account),
 * for how long, and an optional note. Lending a copy that's held for the guest at
 * the front of its line warns first. Writes over the REST API, then refreshes.
 */
export function LendBookDialog({ books, heldFor, today }: LendBookDialogProps) {
  const t = useTranslations("dashBookLoans");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();

  const free = (book: LendableBook): number => Math.max(book.copies - book.onLoan, 0);
  const firstFree = books.find((book) => free(book) > 0)?.id ?? "";

  const [open, setOpen] = React.useState(false);
  const [productId, setProductId] = React.useState(firstFree);
  const [borrowerName, setBorrowerName] = React.useState("");
  const [borrowerPhone, setBorrowerPhone] = React.useState("");
  const [length, setLength] = React.useState<Length>(DEFAULT_LENGTH);
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function openDialog(): void {
    setProductId(firstFree);
    setBorrowerName("");
    setBorrowerPhone("");
    setLength(DEFAULT_LENGTH);
    setNote("");
    setError(null);
    setOpen(true);
  }

  const dueOn = shiftCafeDay(today, Number(length));
  const book = books.find((candidate) => candidate.id === productId);
  const allOut = book !== undefined && free(book) < 1;
  const holder = heldFor[productId];
  const warning =
    !allOut && holder && borrowerName.trim().toLowerCase() !== holder.toLowerCase()
      ? t("heldForWarning", { name: holder })
      : null;
  const blocked = !book || allOut || !borrowerName.trim() || !borrowerPhone.trim();

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    if (blocked) return;
    setError(null);
    startTransition(async () => {
      try {
        const saved = await bookLoansApi.create({ productId, borrowerName, borrowerPhone, dueOn, note });
        toast({
          tone: "success",
          title: t("lentToast", {
            name: saved.borrowerName,
            reference: saved.reference,
            date: formatCafeDayShort(dueOn, locale),
          }),
        });
        setOpen(false);
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
      <Button type="button" className="gap-2 px-4" onClick={openDialog} disabled={books.length === 0}>
        <Icon icon={Plus} size="sm" />
        {t("lend")}
      </Button>

      <Modal open={open} onOpenChange={setOpen}>
        <ModalContent
          title={t("lendTitle")}
          className="flex max-h-[calc(100dvh-2rem)] max-w-md flex-col overflow-y-auto"
          titleClassName="text-start text-body-lead"
        >
          <p className="mt-1 text-body-default text-muted-foreground sm:text-body-small">{t("lendSub")}</p>
          <form onSubmit={submit} className="mt-5 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
              {t("book")}
              <Select value={productId} onChange={(event) => setProductId(event.target.value)} required>
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
            </label>
            <label className="flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
              {t("borrowerName")}
              <Input
                value={borrowerName}
                onChange={(event) => setBorrowerName(event.target.value)}
                maxLength={MAX_BORROWER_NAME_LENGTH}
                placeholder={t("namePlaceholder")}
                autoComplete="off"
                required
              />
            </label>
            <label className="flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
              {t("borrowerPhone")}
              <Input
                type="tel"
                inputMode="tel"
                value={borrowerPhone}
                onChange={(event) => setBorrowerPhone(event.target.value)}
                placeholder="0912 345 6789"
                autoComplete="off"
                dir="ltr"
                required
              />
              <span className="text-body-small font-normal text-muted-foreground sm:text-body-caption">
                {t("phoneHint")}
              </span>
            </label>
            <div className="flex flex-col gap-1.5">
              <span className="text-body-small-emphasis text-foreground">{t("dueBack")}</span>
              <OverviewSegmented
                label={t("loanLength")}
                value={length}
                onChange={setLength}
                options={LENGTHS.map((value) => ({
                  value,
                  label: t("days", { count: Number(value), formatted: formatNumber(Number(value), locale) }),
                }))}
              />
              <span className="text-body-small text-muted-foreground sm:text-body-caption">
                {t("dueOnDay", { date: formatCafeDayLong(dueOn, locale) })}
              </span>
            </div>
            <label className="flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
              {t("note")}
              <Input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={MAX_LOAN_NOTE_LENGTH}
                placeholder={t("notePlaceholder")}
                autoComplete="off"
              />
            </label>

            {allOut ? <FormMessage>{t("allOutError")}</FormMessage> : null}
            {warning ? (
              <p className="flex items-start gap-1.5 text-body-default font-medium text-pretty text-warning-foreground sm:text-body-small">
                <Icon icon={CircleAlert} size="sm" className="mt-0.5 shrink-0" />
                {warning}
              </p>
            ) : null}
            {error ? <FormMessage>{error}</FormMessage> : null}

            <div className="mt-1 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" size="sm" className="px-4" onClick={() => setOpen(false)}>
                {t("dialogCancel")}
              </Button>
              <Button type="submit" size="sm" className="px-4" loading={pending} disabled={blocked}>
                {t("lendSubmit")}
              </Button>
            </div>
          </form>
        </ModalContent>
      </Modal>
    </>
  );
}
