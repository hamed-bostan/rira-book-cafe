import type { NewNotification, Notification } from "../entities/Notification";

export type INotificationRepository = {
  /**
   * Store a notification. One whose `dedupeKey` was already used is dropped, not an
   * error — returns `null` then.
   */
  create(input: NewNotification): Promise<Notification | null>;
  /** One guest's notifications, newest first, at most `limit`. */
  listForUser(userId: string, limit: number): Promise<Notification[]>;
  countUnread(userId: string): Promise<number>;
  /** Mark everything the guest hasn't read as read now. */
  markAllRead(userId: string, at: Date): Promise<void>;
};

/**
 * Tells guests what happened. Use-cases call it *after* their change has committed,
 * and it never throws: a notification that fails to land is logged, and the order
 * that moved still moved. The caller doesn't wait on the guest's inbox.
 */
export type ICustomerNotifier = {
  notify(input: NewNotification): Promise<void>;
};
