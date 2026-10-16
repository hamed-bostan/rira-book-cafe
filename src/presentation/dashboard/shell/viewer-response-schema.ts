import { z } from "zod";

import { USER_ROLES } from "@/src/domain/entities/User";

/**
 * What `GET /api/admin/me` promises: the signed-in dashboard user's own display
 * fields plus their effective role. Colocated with the shell feature rather than
 * `src/contracts/` — only the frontend reads this shape, the route computes it
 * itself rather than validating a client-supplied body against it.
 */
export const viewerResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  imageUrl: z.string().nullable(),
  role: z.enum(USER_ROLES),
});

export type ViewerWire = z.infer<typeof viewerResponseSchema>;
