/**
 * `npm run db:seed` (`prisma db seed`; `prisma.config.ts` loads `.env`): loads the sample data
 * from `seed-sample-data.ts`, making `SEED_OWNER_PHONE` the owner when it's set.
 */
import { rmSync } from "node:fs";

import { prisma } from "@/src/infrastructure/prisma/client";

import { seedSampleData } from "./seed-sample-data";

async function main(): Promise<void> {
  const { categories, items, events, ownerId } = await seedSampleData(process.env.SEED_OWNER_PHONE);
  // A server built in this folder caches catalog reads on disk; drop them so it
  // doesn't serve the menu as it was before the reseed.
  rmSync(".next/cache/fetch-cache", { recursive: true, force: true });

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
