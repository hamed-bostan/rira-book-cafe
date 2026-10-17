import { NextResponse } from "next/server";

import { MarkNotificationsRead } from "@/src/domain/use-cases/notifications/NotificationQueries";
import { notificationRepository } from "@/src/infrastructure/container";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getUserSession } from "@/src/lib/require-auth";

/** POST /api/notifications/read — mark everything the guest has as read. 204. */
export async function POST(): Promise<NextResponse> {
  const session = await getUserSession();
  if (!session?.user.id) return unauthorizedResponse();

  try {
    await new MarkNotificationsRead(notificationRepository).execute(session.user.id, new Date());
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponseFromException(error, "POST /api/notifications/read failed");
  }
}
