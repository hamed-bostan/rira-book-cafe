import { z } from "zod/mini";

import { toUserRole, type UserRole } from "@/src/domain/entities/User";

/**
 * What `GET /api/admin/me` promises: the signed-in dashboard user's own display
 * fields plus their effective role (and, for a custom role, its name in both
 * languages). Colocated with the shell feature rather than `src/contracts/` —
 * only the frontend reads this shape, the route computes it itself rather than
 * validating a client-supplied body against it.
 */
export const viewerResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.nullable(z.string()),
  imageUrl: z.nullable(z.string()),
  role: z.custom<UserRole>((value) => typeof value === "string" && toUserRole(value) === value),
  roleName: z.nullable(z.object({ en: z.string(), fa: z.string() })),
});

export type ViewerWire = z.infer<typeof viewerResponseSchema>;
