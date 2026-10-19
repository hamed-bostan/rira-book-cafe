// The Prisma CLI's configuration (`generate`, `migrate`, `db seed`). The app itself
// never reads this file: the runtime client gets its connection from the driver
// adapter in `src/infrastructure/prisma/client.ts`.
//
// Prisma 7 no longer loads `.env` on its own, so it is loaded here. It never
// overrides a variable that is already set — the container's injected env, CI's,
// and the test fixtures' per-database `DATABASE_URL` all win over the file.
import "dotenv/config";

import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx scripts/seed.ts",
  },
  datasource: {
    // Read directly rather than through `env()` from `prisma/config`, which throws
    // when the variable is unset: `prisma generate` needs no database, and CI runs
    // it without one. Migrate commands still fail loudly without a URL.
    url: process.env.DATABASE_URL,
  },
});
