import { describe, expect, it, vi } from "vitest";

import { ConflictError } from "../../../errors/ConflictError";
import { NotFoundError } from "../../../errors/NotFoundError";
import { ValidationError } from "../../../errors/ValidationError";
import { DeleteOwnReview, DeleteReview, RemoveReviewReply, ReplyToReview } from "../ReviewReplyCommands";

import type { NewActivityEntry } from "../../../entities/ActivityEntry";
import type { ProductReview } from "../../../entities/ProductReview";
import type { IReviewRepository, ReviewReplyInput } from "../../../repositories/IReviewRepository";

const NOW = new Date("2026-11-04T10:00:00Z");
const STAFF = { id: "s1", name: "Ali" };

function review(overrides: Partial<ProductReview> = {}): ProductReview {
  return {
    id: "r1",
    productId: "p1",
    productName: "Latte",
    userId: "g1",
    authorName: "Sara",
    rating: 2,
    comment: "Too sweet",
    status: "approved",
    createdAt: "2026-11-01T10:00:00Z",
    updatedAt: "2026-11-01T10:00:00Z",
    ...overrides,
  };
}

/** A review table of one row; writes run the audit hook the way the repository does. */
function repoWith(current: ProductReview | null) {
  const entries: (NewActivityEntry | null)[] = [];
  const setReply = vi.fn(
    async (_id: string, reply: ReviewReplyInput | null, audit?: (r: ProductReview) => NewActivityEntry | null) => {
      const saved = review({
        ...current,
        reply: reply
          ? { text: reply.text, byName: reply.by.name, at: current?.reply?.at ?? reply.at.toISOString() }
          : undefined,
      });
      if (audit) entries.push(audit(saved));
      return saved;
    },
  );
  const remove = vi.fn(async (_id: string, audit?: (r: ProductReview) => NewActivityEntry | null) => {
    if (!current) return null;
    if (audit) entries.push(audit(current));
    return current;
  });
  const repo = {
    getById: vi.fn(async () => current),
    getOwn: vi.fn(async () => current),
    setReply,
    delete: remove,
  } as unknown as IReviewRepository;
  return { repo, setReply, remove, entries };
}

describe("ReplyToReview", () => {
  it("posts the reply, logs it and tells the guest the first time", async () => {
    const { repo, setReply, entries } = repoWith(review());
    const notifier = { notify: vi.fn(async () => {}) };
    await new ReplyToReview(repo, notifier).execute("r1", "  Sorry — we'll go easier on the syrup. ", STAFF, NOW);

    expect(setReply).toHaveBeenCalledWith(
      "r1",
      { text: "Sorry — we'll go easier on the syrup.", by: STAFF, at: NOW },
      expect.any(Function),
    );
    expect(entries[0]).toMatchObject({
      action: "review.replied",
      entityType: "review",
      entityId: "r1",
      changes: [{ field: "reply", before: null, after: "Sorry — we'll go easier on the syrup." }],
    });
    expect(notifier.notify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "g1", kind: "reviewReplied", params: { productName: "Latte" } }),
    );
  });

  it("edits a reply without telling the guest again", async () => {
    const { repo, entries } = repoWith(
      review({ reply: { text: "Thanks", byName: "Ali", at: "2026-11-02T10:00:00Z" } }),
    );
    const notifier = { notify: vi.fn(async () => {}) };
    await new ReplyToReview(repo, notifier).execute("r1", "Thank you!", STAFF, NOW);
    expect(entries[0]?.changes).toEqual([{ field: "reply", before: "Thanks", after: "Thank you!" }]);
    expect(notifier.notify).not.toHaveBeenCalled();
  });

  it("refuses a review guests can't see, an empty reply, and a missing review", async () => {
    await expect(
      new ReplyToReview(repoWith(review({ status: "pending" })).repo).execute("r1", "Hi", STAFF, NOW),
    ).rejects.toBeInstanceOf(ConflictError);
    await expect(new ReplyToReview(repoWith(review()).repo).execute("r1", "   ", STAFF, NOW)).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(new ReplyToReview(repoWith(null).repo).execute("r1", "Hi", STAFF, NOW)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("RemoveReviewReply", () => {
  it("takes the reply down and logs what it said", async () => {
    const { repo, setReply, entries } = repoWith(
      review({ reply: { text: "Thanks", byName: "Ali", at: "2026-11-02T10:00:00Z" } }),
    );
    await new RemoveReviewReply(repo).execute("r1", STAFF);
    expect(setReply).toHaveBeenCalledWith("r1", null, expect.any(Function));
    expect(entries[0]).toMatchObject({
      action: "review.replyRemoved",
      changes: [{ field: "reply", before: "Thanks", after: null }],
    });
  });

  it("does nothing when there's no reply", async () => {
    const { repo, setReply } = repoWith(review());
    await new RemoveReviewReply(repo).execute("r1", STAFF);
    expect(setReply).not.toHaveBeenCalled();
  });
});

describe("DeleteReview", () => {
  it("deletes and logs what the review said", async () => {
    const { repo, entries } = repoWith(review());
    await new DeleteReview(repo).execute("r1", STAFF);
    expect(entries[0]).toMatchObject({
      action: "review.deleted",
      entityId: "r1",
      entityLabel: "Latte",
      changes: [
        { field: "author", before: "Sara", after: null },
        { field: "rating", before: "2", after: null },
        { field: "comment", before: "Too sweet", after: null },
        { field: "status", before: "approved", after: null },
      ],
    });
  });

  it("is a not-found when it's already gone", async () => {
    await expect(new DeleteReview(repoWith(null).repo).execute("r1", STAFF)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("DeleteOwnReview", () => {
  it("deletes the guest's own review, with no staff entry", async () => {
    const { repo, remove } = repoWith(review());
    await new DeleteOwnReview(repo).execute("p1", "g1");
    expect(remove).toHaveBeenCalledWith("r1");
  });

  it("is a not-found when they have none", async () => {
    await expect(new DeleteOwnReview(repoWith(null).repo).execute("p1", "g1")).rejects.toBeInstanceOf(NotFoundError);
  });
});
