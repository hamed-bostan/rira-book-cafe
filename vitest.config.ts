import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts", "**/*.test.tsx"],
    // Postgres-backed tests live in their own project (`vitest.integration.config.ts`,
    // `npm run test:integration`) so `npm test` never needs a database.
    exclude: ["node_modules", ".next", ".claude", "**/*.integration.test.ts"],
  },
});
