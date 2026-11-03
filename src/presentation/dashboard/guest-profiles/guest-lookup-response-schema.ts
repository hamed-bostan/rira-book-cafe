import { z } from "zod/mini";

/** What `GET /api/admin/guests?phone=` returns: whose profile the phone is, if anyone's. */
export const guestLookupResponseSchema = z.union([
  z.object({ found: z.literal(false) }),
  z.object({ found: z.literal(true), name: z.nullable(z.string()), signedIn: z.boolean() }),
]);
