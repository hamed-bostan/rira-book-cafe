/**
 * An internal note left on an order by whoever is working it.
 *
 * The context an order's status can't carry: "oat milk swapped for almond, guest
 * agreed", "table 4 asked to hold the cake until coffee". Staff-facing only — a note
 * is never shown to the guest. It's also the one thing the `support` role can write.
 *
 * Append-only: notes are read later by someone reconstructing what happened, and a
 * note that could be quietly edited afterwards would be no use for that. There is
 * no update and no delete on the repository.
 */
export type OrderNote = {
  id: string;
  /** The order this note is about. */
  orderId: string;
  /** Who wrote it. */
  authorId: string;
  /**
   * Their display name, snapshotted at write time — so the note still reads
   * correctly after they change their name or leave, the same way the activity
   * log snapshots its actor.
   */
  authorName: string;
  body: string;
  /** ISO 8601 timestamp (UTC). Formatted in the presentation layer. */
  createdAt: string;
};

/** How long a note may be. Long enough for a paragraph of context, not a document. */
export const MAX_ORDER_NOTE_LENGTH = 2000;
