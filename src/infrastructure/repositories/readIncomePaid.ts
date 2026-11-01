import type { IncomeSourceType } from "@/src/domain/entities/Income";
import type { PrismaDb } from "@/src/infrastructure/prisma/transaction";

/** What's been received against each event sign-up or suite stay, voids aside. */
export async function paidBySource(
  db: Pick<PrismaDb, "income">,
  sourceType: IncomeSourceType,
  ids: readonly string[],
): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const groups = await db.income.groupBy({
    by: ["sourceId"],
    where: { sourceType, sourceId: { in: [...ids] }, status: "received" },
    _sum: { amount: true },
  });
  return new Map(groups.flatMap((group) => (group.sourceId ? [[group.sourceId, Number(group._sum.amount ?? 0)]] : [])));
}
