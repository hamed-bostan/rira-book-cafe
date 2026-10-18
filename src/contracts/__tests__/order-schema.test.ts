import { describe, expect, it } from "vitest";

import { placeOrderSchema } from "../order-schema";

describe("placeOrderSchema", () => {
  it("requires a table for dine-in", () => {
    const result = placeOrderSchema.safeParse({ serviceType: "dineIn", items: [{ productId: "p1", quantity: 1 }] });
    expect(result.error?.issues.map((issue) => issue.message)).toContain("tableRequired");
  });

  it("trims notes and turns blanks into undefined", () => {
    const parsed = placeOrderSchema.parse({
      serviceType: "dineIn",
      tableLabel: " 4 ",
      note: "  ",
      items: [{ productId: "p1", quantity: 2, note: " oat milk " }],
    });
    expect(parsed).toMatchObject({ tableLabel: "4", note: undefined, items: [{ note: "oat milk" }] });
  });

  it("rejects empty orders and fractional quantities", () => {
    expect(placeOrderSchema.safeParse({ serviceType: "takeaway", items: [] }).success).toBe(false);
    expect(
      placeOrderSchema.safeParse({ serviceType: "takeaway", items: [{ productId: "p1", quantity: 1.5 }] }).success,
    ).toBe(false);
  });
});
