"use client";

import { Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { MAX_BORROWER_NAME_LENGTH } from "@/src/domain/entities/BookLoan";
import { useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatNumber } from "@/src/lib/formatNumber";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Select } from "@/src/presentation/design-system/components/form/Select/Select";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { bookLoansApi } from "../book-loans/book-loan-api";
import { DashboardDialog } from "../DashboardDialog";
import { DashboardField } from "../DashboardField";
import { FIELD_HINT } from "../fieldStyles";

type HoldableBook = {
  id: string;
  title: string;
  /** Copies free on the shelf. */
  free: number;
  /** Guests already in its line. */
  inLine: number;
};

type AddHoldDialogProps = {
  books: readonly HoldableBook[];
};

const FIELDS = ["productId", "guestName", "guestPhone"] as const;
/** Where a new hold shows: the Open tab. */
const OPEN_HOLDS_HREF = "/dashboard/book-holds";

/**
 * "Add a hold" for a guest who asks at the counter or by phone. A book with a copy
 * free and nobody waiting can't be picked — lend it instead. Says up front which
 * place in line they'll take. Writes over the REST API, then shows the Open tab.
 */
export function AddHoldDialog({ books }: AddHoldDialogProps) {
  const t = useTranslations("dashBookHolds");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();

  const onShelf = (book: HoldableBook): boolean => book.free > 0 && book.inLine === 0;
  const firstHoldable = (books.find((book) => book.free < 1) ?? books.find((book) => !onShelf(book)))?.id ?? "";

  const [open, setOpen] = React.useState(false);
  const [productId, setProductId] = React.useState(firstHoldable);
  const [guestName, setGuestName] = React.useState("");
  const [guestPhone, setGuestPhone] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function openDialog(): void {
    setProductId(firstHoldable);
    setGuestName("");
    setGuestPhone("");
    setError(null);
    setOpen(true);
  }

  const book = books.find((candidate) => candidate.id === productId);
  const blocked = !book || onShelf(book) || !guestName.trim() || !guestPhone.trim();

  function submit(): void {
    if (!book) return;
    setError(null);
    startTransition(async () => {
      try {
        await bookLoansApi.addHold({ productId, guestName, guestPhone });
        toast({ tone: "success", title: t("addedToast", { name: guestName.trim(), title: book.title }) });
        setOpen(false);
        router.push(OPEN_HOLDS_HREF);
        router.refresh();
      } catch (err) {
        if (err instanceof ApiError) {
          const field = FIELDS.map((name) => err.fieldErrors?.[name]).find(Boolean);
          if (field) {
            setError(formErrorMessage(tFormErrors, field) ?? field);
            return;
          }
        }
        setError(localizeApiError(err, tApiErrors, t("actionError")));
        router.refresh();
      }
    });
  }

  return (
    <>
      <Button size="control-md" type="button" className="gap-2 px-4" onClick={openDialog} disabled={books.length === 0}>
        <Icon icon={Plus} size="icon-md" />
        {t("addHold")}
      </Button>

      <DashboardDialog
        open={open}
        onOpenChange={setOpen}
        title={t("addHold")}
        subtitle={t("addHoldSub")}
        submitLabel={t("addToLine")}
        blocked={blocked}
        pending={pending}
        onSubmit={submit}
        error={error}
      >
        <DashboardField label={t("book")}>
          <Select size="control-md" value={productId} onChange={(event) => setProductId(event.target.value)}>
            {books.map((option) => (
              <option key={option.id} value={option.id} disabled={onShelf(option)}>
                {option.title} ·{" "}
                {onShelf(option)
                  ? t("onShelfLendInstead")
                  : t("inLine", { count: option.inLine, formatted: formatNumber(option.inLine, locale) })}
              </option>
            ))}
          </Select>
        </DashboardField>
        <DashboardField label={t("guestName")}>
          <Input
            size="control-md"
            value={guestName}
            onChange={(event) => setGuestName(event.target.value)}
            maxLength={MAX_BORROWER_NAME_LENGTH}
            placeholder={t("guestNamePlaceholder")}
            autoComplete="off"
          />
        </DashboardField>
        <DashboardField label={t("guestPhone")}>
          <Input
            size="control-md"
            type="tel"
            inputMode="tel"
            value={guestPhone}
            onChange={(event) => setGuestPhone(event.target.value)}
            placeholder="0912 345 6789"
            autoComplete="off"
            dir="ltr"
          />
        </DashboardField>
        {book && !onShelf(book) ? (
          <p className={FIELD_HINT}>{t("placeInLine", { position: formatNumber(book.inLine + 1, locale) })}</p>
        ) : null}
      </DashboardDialog>
    </>
  );
}
