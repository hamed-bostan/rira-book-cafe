import { describe, expect, it } from "vitest";

import { bulkResultSchema } from "../bulk-result-response-schema";

describe("bulkResultSchema", () => {
  it("reads the count of changed rows", () => {
    expect(bulkResultSchema.parse({ updated: 12 })).toEqual({ updated: 12 });
    expect(bulkResultSchema.safeParse({ updated: "12" }).success).toBe(false);
  });
});
