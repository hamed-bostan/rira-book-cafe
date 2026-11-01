import { ConflictError } from "@/src/domain/errors/ConflictError";
import { Prisma } from "@/src/infrastructure/prisma/generated/client";

/**
 * Claim a month of a recurring bill, recorded or skipped, inside the caller's
 * transaction. The bill and month are the row's key, so a second claim, from two
 * clicks or two tabs, fails here and takes its transaction with it: an expense
 * recorded alongside it never lands.
 */
export async function claimBillMonth(
  tx: Prisma.TransactionClient,
  run: { billId: string; period: string; expenseId?: string; createdById: string; createdByName: string },
): Promise<void> {
  try {
    await tx.recurringBillRun.create({ data: run });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError("ALREADY_POSTED", "This month of the bill has already been dealt with.", {
        cause: error,
      });
    }
    throw error;
  }
}
