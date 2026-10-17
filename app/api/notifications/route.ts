import { NextResponse } from "next/server";

import { ListNotifications, SyncLoanReminders } from "@/src/domain/use-cases/notifications/NotificationQueries";
import { bookLoanRepository, customerNotifier, notificationRepository } from "@/src/infrastructure/container";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getUserSession } from "@/src/lib/require-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/notifications — the signed-in guest's notifications, newest first. Any
 * loan reminders that have come due are added first.
 */
export async function GET(): Promise<NextResponse> {
  const session = await getUserSession();
  if (!session?.user.id) return unauthorizedResponse();

  try {
    const reminders = new SyncLoanReminders(bookLoanRepository, customerNotifier);
    return NextResponse.json(await new ListNotifications(notificationRepository, reminders).execute(session.user.id, new Date()));
  } catch (error) {
    return errorResponseFromException(error, "GET /api/notifications failed");
  }
}
