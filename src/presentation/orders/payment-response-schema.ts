import { z } from "zod";

/** What `POST /api/orders/:id/pay` returns: the gateway page to send the guest to. */
export const paymentSessionResponseSchema = z.object({ redirectUrl: z.string().url() });

export type PaymentSessionResponse = z.infer<typeof paymentSessionResponseSchema>;
