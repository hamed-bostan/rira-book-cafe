import { NextResponse } from "next/server";

import { CountUnreadNotifications, SyncLoanReminders } from "@/src/domain/use-cases/notifications/NotificationQueries";
import { bookLoanRepository, customerNotifier, notificationRepository } from "@/src/infrastructure/container";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getUserSession } from "@/src/lib/require-auth";

export const dynamic = "force-dynamic";

/** GET /api/notifications/unread-count — `{ count }` for the bell's badge. */
export async function GET(): Promise<NextResponse> {
  const session = await getUserSession();
  if (!session?.user.id) return unauthorizedResponse();

  try {
    const reminders = new SyncLoanReminders(bookLoanRepository, customerNotifier);
    const count = await new CountUnreadNotifications(notificationRepository, reminders).execute(session.user.id, new Date());
    return NextResponse.json({ count });
  } catch (error) {
    return errorResponseFromException(error, "GET /api/notifications/unread-count failed");
  }
}
