"use client";

import { Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatNumber } from "@/src/lib/formatNumber";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Select } from "@/src/presentation/design-system/components/form/Select/Select";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { bookLoansApi } from "../book-loans/book-loan-api";
import { DashboardDialog } from "../DashboardDialog";
import { DashboardField } from "../DashboardField";
import { FIELD_HINT } from "../fieldStyles";
import { GuestField, type GuestFieldValue } from "../guest-profiles/GuestField";

type HoldableBook = {
  id: string;
  title: string;
  /** Copies free on the shelf. */
  free: number;
  /** Guests already in its line. */
  inLine: number;
  /** A copy is free that nobody holds or waits for (`canBorrowBook`): it has no line to join. */
  onShelf: boolean;
};

type AddHoldDialogProps = {
  books: readonly HoldableBook[];
};

const FIELDS = ["productId", "guestPhone", "guestName"] as const;
/** Where a new hold shows: the Open tab. */
const OPEN_HOLDS_HREF = "/dashboard/book-holds";

/**
 * "Add a hold" for a guest who asks at the counter or by phone, found by their
 * phone — or given a profile with the hold (`GuestField`). A book with a copy free
 * that nobody holds or waits for can't be picked — lend it instead. Says up front
 * which place in line they'll take. Writes over the REST API, then shows the Open tab.
 */
export function AddHoldDialog({ books }: AddHoldDialogProps) {
  const t = useTranslations("dashBookHolds");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();

  const firstHoldable = (books.find((book) => book.free < 1) ?? books.find((book) => !book.onShelf))?.id ?? "";

  const [open, setOpen] = React.useState(false);
  const [productId, setProductId] = React.useState(firstHoldable);
  const [guest, setGuest] = React.useState<GuestFieldValue | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function openDialog(): void {
    setProductId(firstHoldable);
    setGuest(null);
    setError(null);
    setOpen(true);
  }

  const book = books.find((candidate) => candidate.id === productId);
  const blocked = !book || book.onShelf || !guest;

  function submit(): void {
    if (!book || !guest) return;
    setError(null);
    startTransition(async () => {
      try {
        const hold = await bookLoansApi.addHold({ productId, guestPhone: guest.phone, guestName: guest.name });
        toast({ tone: "success", title: t("addedToast", { name: hold.guestName, title: book.title }) });
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
              <option key={option.id} value={option.id} disabled={option.onShelf}>
                {option.title} ·{" "}
                {option.onShelf
                  ? t("onShelfLendInstead")
                  : t("inLine", { count: option.inLine, formatted: formatNumber(option.inLine, locale) })}
              </option>
            ))}
          </Select>
        </DashboardField>
        <GuestField onChange={setGuest} disabled={pending} />
        {book && !book.onShelf ? (
          <p className={FIELD_HINT}>{t("placeInLine", { position: formatNumber(book.inLine + 1, locale) })}</p>
        ) : null}
      </DashboardDialog>
    </>
  );
}
