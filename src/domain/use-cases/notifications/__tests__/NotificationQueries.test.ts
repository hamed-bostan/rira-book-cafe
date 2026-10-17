import { describe, expect, it, vi } from "vitest";

import { NOTIFICATION_LIST_LIMIT, type Notification } from "../../../entities/Notification";
import { CountUnreadNotifications, ListNotifications, MarkNotificationsRead, SyncLoanReminders } from "../NotificationQueries";

import type { BookLoan } from "../../../entities/BookLoan";
import type { ICustomerNotifier, INotificationRepository } from "../../../repositories/INotificationRepository";

const NOW = new Date("2026-10-20T10:00:00Z");

function loan(id: string, dueAt: string, overrides: Partial<BookLoan> = {}): BookLoan {
  return {
    id,
    reference: 1,
    productId: "b1",
    bookTitle: "The Blind Owl",
    userId: "g1",
    borrowerName: "Sara",
    borrowerPhone: "09121234567",
    lentAt: "2026-10-01T10:00:00Z",
    dueAt,
    status: "out",
    lentById: "s1",
    lentByName: "Ali",
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

const NOTIFICATION: Notification = { id: "n1", userId: "g1", kind: "orderReady", params: { orderNumber: 4 }, createdAt: "" };

type Setup = {
  reminders: SyncLoanReminders;
  notify: ReturnType<typeof vi.fn<ICustomerNotifier["notify"]>>;
  repo: INotificationRepository;
  listForUser: ReturnType<typeof vi.fn<INotificationRepository["listForUser"]>>;
  markAllRead: ReturnType<typeof vi.fn<INotificationRepository["markAllRead"]>>;
};

function setup(loans: BookLoan[]): Setup {
  const notify = vi.fn<ICustomerNotifier["notify"]>(async () => {});
  const reminders = new SyncLoanReminders({ listForUser: vi.fn(async () => loans) }, { notify });
  const listForUser = vi.fn<INotificationRepository["listForUser"]>(async () => [NOTIFICATION]);
  const markAllRead = vi.fn<INotificationRepository["markAllRead"]>(async () => {});
  const repo: INotificationRepository = {
    create: vi.fn(async () => null),
    listForUser,
    countUnread: vi.fn(async () => 3),
    markAllRead,
  };
  return { reminders, notify, repo, listForUser, markAllRead };
}

describe("SyncLoanReminders", () => {
  it("sends a reminder for each loan that's due soon or overdue, and nothing for the rest", async () => {
    const { reminders, notify } = setup([
      loan("overdue", "2026-10-19T20:00:00Z"),
      loan("soon", "2026-10-21T20:00:00Z"),
      loan("later", "2026-11-10T20:00:00Z"),
      loan("back", "2026-10-19T20:00:00Z", { status: "returned" }),
    ]);
    await reminders.execute("g1", NOW);
    expect(notify.mock.calls.map(([sent]) => [sent.kind, sent.dedupeKey])).toEqual([
      ["loanOverdue", "loan:overdue:loanOverdue"],
      ["loanDueSoon", "loan:soon:loanDueSoon"],
    ]);
  });
});

describe("guest notification reads", () => {
  it("lists the guest's notifications after syncing reminders", async () => {
    const { reminders, notify, repo, listForUser } = setup([loan("overdue", "2026-10-19T20:00:00Z")]);
    expect(await new ListNotifications(repo, reminders).execute("g1", NOW)).toEqual([NOTIFICATION]);
    expect(notify).toHaveBeenCalledOnce();
    expect(listForUser).toHaveBeenCalledWith("g1", NOTIFICATION_LIST_LIMIT);
    // The reminder is sent before the list is read, so it shows up in it.
    expect(notify.mock.invocationCallOrder[0]).toBeLessThan(listForUser.mock.invocationCallOrder[0]);
  });

  it("counts unread after syncing reminders", async () => {
    const { reminders, notify, repo } = setup([loan("soon", "2026-10-21T20:00:00Z")]);
    expect(await new CountUnreadNotifications(repo, reminders).execute("g1", NOW)).toBe(3);
    expect(notify).toHaveBeenCalledOnce();
  });

  it("marks everything read at the given time", async () => {
    const { repo, markAllRead } = setup([]);
    await new MarkNotificationsRead(repo).execute("g1", NOW);
    expect(markAllRead).toHaveBeenCalledWith("g1", NOW);
  });
});
