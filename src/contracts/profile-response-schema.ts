import { z } from "zod/mini";

/**
 * What `GET/PUT /api/profile` returns — shared by the route (which builds a
 * `ProfileWire`) and the typed services that validate it back. Kept apart from the
 * form's `profileUpdateSchema` so pages that only read a profile don't carry classic
 * zod for it.
 */
export const profileResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string(),
  email: z.nullable(z.string()),
});

export type ProfileWire = z.infer<typeof profileResponseSchema>;
