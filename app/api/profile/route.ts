import { NextResponse, type NextRequest } from "next/server";

import type { ProfileWire } from "@/src/contracts/profile-response-schema";
import { profileUpdateSchema } from "@/src/contracts/profile-schema";
import type { User } from "@/src/domain/entities/User";
import { GetOrCreateUser } from "@/src/domain/use-cases/profile/GetOrCreateUser";
import { UpdateOwnProfile } from "@/src/domain/use-cases/profile/UpdateOwnProfile";
import { userRepository } from "@/src/infrastructure/container";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { getUserSession } from "@/src/lib/require-auth";

export const dynamic = "force-dynamic";

function toWire(user: User): ProfileWire {
  return { id: user.id, name: user.name, phone: user.phone, email: user.email };
}

/** GET /api/profile — the signed-in guest's own profile (created on first read if missing). */
export async function GET(): Promise<NextResponse> {
  const session = await getUserSession();
  if (!session?.user.id) return unauthorizedResponse();

  try {
    const user = await new GetOrCreateUser(userRepository).execute({
      id: session.user.id,
      phone: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json(toWire(user));
  } catch (error) {
    return errorResponseFromException(error, "GET /api/profile failed");
  }
}

/** PUT /api/profile — update the signed-in guest's name and email. */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  const session = await getUserSession();
  if (!session?.user.id) return unauthorizedResponse();

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });

  const parsed = profileUpdateSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const user = await new UpdateOwnProfile(userRepository).execute(session.user.id, {
      name: parsed.data.name,
      email: parsed.data.email || null,
    });
    return NextResponse.json(toWire(user));
  } catch (error) {
    return errorResponseFromException(error, "PUT /api/profile failed");
  }
}
