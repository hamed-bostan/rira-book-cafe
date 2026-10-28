import { z } from "zod/mini";

/** What `POST /api/orders/:id/pay` returns: the gateway page to send the guest to. */
export const paymentSessionResponseSchema = z.object({ redirectUrl: z.url() });

export type PaymentSessionResponse = z.infer<typeof paymentSessionResponseSchema>;
