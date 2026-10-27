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
import { FormMessage } from "@/src/presentation/design-system/components/form/FormMessage/FormMessage";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Select } from "@/src/presentation/design-system/components/form/Select/Select";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { Modal, ModalContent } from "@/src/presentation/design-system/components/Modal/Modal";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { bookLoansApi } from "../book-loans/book-loan-api";

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

/**
 * "Add a hold" for a guest who asks at the counter or by phone. A book with a copy
 * free and nobody waiting can't be picked — lend it instead. Says up front which
 * place in line they'll take. Writes over the REST API, then refreshes.
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

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    if (blocked || !book) return;
    setError(null);
    startTransition(async () => {
      try {
        await bookLoansApi.addHold({ productId, guestName, guestPhone });
        toast({ tone: "success", title: t("addedToast", { name: guestName.trim(), title: book.title }) });
        setOpen(false);
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
        <Icon icon={Plus} size="sm" />
        {t("addHold")}
      </Button>

      <Modal open={open} onOpenChange={setOpen}>
        <ModalContent
          title={t("addHold")}
          className="flex max-h-[calc(100dvh-2rem)] max-w-md flex-col overflow-y-auto"
          titleClassName="text-start text-body-lead"
        >
          <p className="mt-1 text-body-default text-muted-foreground sm:text-body-small">{t("addHoldSub")}</p>
          <form onSubmit={submit} className="mt-5 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
              {t("book")}
              <Select
                size="control-md"
                value={productId}
                onChange={(event) => setProductId(event.target.value)}
                required
              >
                {books.map((option) => (
                  <option key={option.id} value={option.id} disabled={onShelf(option)}>
                    {option.title} ·{" "}
                    {onShelf(option)
                      ? t("onShelfLendInstead")
                      : t("inLine", { count: option.inLine, formatted: formatNumber(option.inLine, locale) })}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
              {t("guestName")}
              <Input
                size="control-md"
                value={guestName}
                onChange={(event) => setGuestName(event.target.value)}
                maxLength={MAX_BORROWER_NAME_LENGTH}
                placeholder={t("guestNamePlaceholder")}
                autoComplete="off"
                required
              />
            </label>
            <label className="flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
              {t("guestPhone")}
              <Input
                size="control-md"
                type="tel"
                inputMode="tel"
                value={guestPhone}
                onChange={(event) => setGuestPhone(event.target.value)}
                placeholder="0912 345 6789"
                autoComplete="off"
                dir="ltr"
                required
              />
            </label>
            {book && !onShelf(book) ? (
              <p className="text-body-small text-muted-foreground sm:text-body-caption">
                {t("placeInLine", { position: formatNumber(book.inLine + 1, locale) })}
              </p>
            ) : null}
            {error ? <FormMessage>{error}</FormMessage> : null}

            <div className="mt-1 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                size="control-md"
                className="px-4"
                onClick={() => setOpen(false)}
              >
                {t("back")}
              </Button>
              <Button type="submit" size="control-md" className="px-4" loading={pending} disabled={blocked}>
                {t("addToLine")}
              </Button>
            </div>
          </form>
        </ModalContent>
      </Modal>
    </>
  );
}
