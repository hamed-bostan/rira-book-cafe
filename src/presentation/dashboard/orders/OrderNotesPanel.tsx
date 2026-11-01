"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import type { OrderNote } from "@/src/domain/entities/OrderNote";
import { MAX_ORDER_NOTE_LENGTH } from "@/src/domain/entities/OrderNote";
import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatOrderDate } from "@/src/lib/formatOrderDate";
import { DashboardField } from "@/src/presentation/dashboard/DashboardField";
import { FIELD_HINT, FIELD_TEXTAREA } from "@/src/presentation/dashboard/fieldStyles";
import { FormAlert } from "@/src/presentation/dashboard/FormAlert";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Textarea } from "@/src/presentation/design-system/components/form/Textarea/Textarea";

import { ordersApi } from "./order-api";

type OrderNotesPanelProps = {
  orderId: string;
  /** The order's notes, newest first, fetched during the page's server render. */
  notes: OrderNote[];
  /** Whether the viewer may add one. Everyone who can see the page can read them. */
  canWrite: boolean;
};

/**
 * Internal notes on an order — what the people working it need each other to know,
 * and the one thing the `support` role can write.
 *
 * Nothing here reaches the customer; that's the comms panel below. Notes are
 * append-only and there is no edit or delete control, because there's no endpoint
 * behind one: they're read later by someone reconstructing what happened, and a
 * note that could be revised afterwards would be no use for that.
 *
 * Writing one `router.refresh()`es rather than prepending to a local list — the
 * server render stays the single source of truth, as everywhere else in the
 * dashboard.
 */
export function OrderNotesPanel({ orderId, notes, canWrite }: OrderNotesPanelProps) {
  const t = useTranslations("dashOrderNotes");
  const tApiErrors = useTranslations("apiErrors");
  const locale = useLocale();
  const router = useRouter();

  const [body, setBody] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function submit(): void {
    setError(null);
    startTransition(async () => {
      try {
        await ordersApi.addNote(orderId, { body });
        setBody("");
        router.refresh();
      } catch (err) {
        setError(localizeApiError(err, tApiErrors, t("addError")));
      }
    });
  }

  return (
    <>
      {notes.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {notes.map((note) => (
            <li key={note.id} className="flex flex-col gap-0.5 rounded-button bg-muted p-3">
              <p className="whitespace-pre-wrap text-foreground">{note.body}</p>
              {/* The snapshotted name, not a lookup — the note reads correctly
                  after its author is renamed or gone. */}
              <p className={FIELD_HINT}>
                {note.authorName} ·{" "}
                <time dateTime={note.createdAt} className="tabular-nums">
                  {formatOrderDate(note.createdAt, locale)}
                </time>
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">{t("empty")}</p>
      )}

      {canWrite ? (
        <>
          <DashboardField label={t("label")}>
            <Textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder={t("placeholder")}
              maxLength={MAX_ORDER_NOTE_LENGTH}
              rows={3}
              disabled={pending}
              className={FIELD_TEXTAREA}
            />
          </DashboardField>
          {error ? <FormAlert>{error}</FormAlert> : null}
          <Button
            type="button"
            variant="secondary"
            size="control-md"
            className="self-end px-3"
            loading={pending}
            disabled={body.trim() === ""}
            onClick={submit}
          >
            {t("add")}
          </Button>
        </>
      ) : null}
    </>
  );
}
