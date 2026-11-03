import { z } from "zod/mini";

import { PAYMENT_ATTEMPT_STATUSES, PAYMENT_FAILURE_REASONS } from "@/src/domain/entities/PaymentAttempt";

/** What the online-payment endpoints return: an attempt, with the number of the order it was for. */
export const orderPaymentAttemptResponseSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  orderNumber: z.number(),
  provider: z.string(),
  authority: z.string(),
  amount: z.number(),
  status: z.enum(PAYMENT_ATTEMPT_STATUSES),
  failureReason: z.optional(z.enum(PAYMENT_FAILURE_REASONS)),
  gatewayCode: z.optional(z.string()),
  refId: z.optional(z.string()),
  cardPan: z.optional(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const orderPaymentAttemptListResponseSchema = z.array(orderPaymentAttemptResponseSchema);
