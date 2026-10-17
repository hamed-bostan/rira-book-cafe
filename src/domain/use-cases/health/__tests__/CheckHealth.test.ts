import { describe, expect, it } from "vitest";

import { CheckHealth } from "../CheckHealth";

describe("CheckHealth", () => {
  it("reports ok when the database answers", async () => {
    const report = await new CheckHealth({ ping: async () => {} }).execute();
    expect(report.status).toBe("ok");
    expect(report.checks.database.status).toBe("ok");
  });

  it("reports an error when the database is down", async () => {
    const report = await new CheckHealth({
      ping: () => Promise.reject(new Error("ECONNREFUSED")),
    }).execute();
    expect(report).toMatchObject({ status: "error", checks: { database: { status: "error" } } });
  });

  it("gives up on a hanging database after the timeout", async () => {
    const report = await new CheckHealth({ ping: () => new Promise<void>(() => {}) }, 20).execute();
    expect(report.status).toBe("error");
    expect(report.checks.database.latencyMs).toBeLessThan(1_000);
  });
});
