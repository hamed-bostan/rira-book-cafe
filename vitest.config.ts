import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/** Coverage floor for the layers that hold the rules (`npm run test:coverage`). */
const CORE_THRESHOLDS = { lines: 80, statements: 80, functions: 80, branches: 75 };

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
    coverage: {
      provider: "v8",
      // Measured — and held to a floor — only where the business rules live: the
      // domain and the contracts both halves of the BFF validate with. UI, adapters
      // and route handlers are covered by the integration and E2E suites instead.
      include: ["src/domain/**", "src/contracts/**"],
      exclude: ["**/__tests__/**", "**/*.test.ts"],
      reporter: ["text-summary", "html", "json-summary"],
      thresholds: {
        "src/domain/**": CORE_THRESHOLDS,
        "src/contracts/**": CORE_THRESHOLDS,
      },
    },
  },
});
