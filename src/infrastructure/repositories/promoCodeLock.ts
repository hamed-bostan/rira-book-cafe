import type { Prisma } from "@/src/infrastructure/prisma/generated/client";

/**
 * Serialize everything that decides whether an order may take a promo code —
 * checkout claiming a use, staff archiving or deleting the code — on one
 * transaction-scoped lock per code. Whichever commits first, the other sees it:
 * an order never takes a code that's being archived, and a code is never deleted
 * from under an order placed with it.
 */
export async function lockPromoCode(tx: Prisma.TransactionClient, promoCodeId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`promo:${promoCodeId}`}))`;
}
