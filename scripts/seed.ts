/**
 * `npm run db:seed` (`prisma db seed`, which loads `.env`): loads the sample data
 * from `seed-sample-data.ts`, making `SEED_OWNER_PHONE` the owner when it's set.
 */
import { prisma } from "@/src/infrastructure/prisma/client";

import { seedSampleData } from "./seed-sample-data";

async function main(): Promise<void> {
  const { categories, items, events, ownerId } = await seedSampleData(process.env.SEED_OWNER_PHONE);

  console.warn(
    `Seeded ${categories} categories, ${items} menu items and ${events} events` +
      (ownerId ? `; ${ownerId} is the owner.` : ". Set SEED_OWNER_PHONE to also create an owner."),
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
