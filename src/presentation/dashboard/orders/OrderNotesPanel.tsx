"use client";

import { StickyNote } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import type { OrderNote } from "@/src/domain/entities/OrderNote";
import { MAX_ORDER_NOTE_LENGTH } from "@/src/domain/entities/OrderNote";
import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatOrderDate } from "@/src/lib/formatOrderDate";
import { Avatar, Button, EmptyState, Icon, Textarea } from "@/src/presentation/design-system";

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
    <div className="flex flex-col gap-4">
      {canWrite ? (
        <div className="flex flex-col gap-2">
          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={t("placeholder")}
            aria-label={t("label")}
            maxLength={MAX_ORDER_NOTE_LENGTH}
            rows={3}
            disabled={pending}
          />
          <Button
            size="sm"
            className="self-start"
            loading={pending}
            disabled={body.trim() === ""}
            onClick={submit}
          >
            <Icon icon={StickyNote} size="sm" className="me-1.5" />
            {t("add")}
          </Button>
          {error ? <p className="text-body-small text-destructive">{error}</p> : null}
        </div>
      ) : null}

      {notes.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border">
          {notes.map((note) => (
            <li key={note.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
              <Avatar name={note.authorName} className="mt-0.5 size-8 shrink-0" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-2">
                  {/* The snapshotted name, not a lookup — the note reads correctly
                      after its author is renamed or gone. */}
                  <span className="text-body-small-strong text-foreground">{note.authorName}</span>
                  <time dateTime={note.createdAt} className="text-body-caption text-muted-foreground">
                    {formatOrderDate(note.createdAt, locale)}
                  </time>
                </div>
                <p className="whitespace-pre-wrap text-body-small text-foreground">{note.body}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={StickyNote} title={t("empty")} className="py-8" />
      )}
    </div>
  );
}
