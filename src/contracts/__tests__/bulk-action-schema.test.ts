import { describe, expect, it } from "vitest";

import {
  bulkResultSchema,
  categoryBulkRequestSchema,
  orderBulkRequestSchema,
  productBulkRequestSchema,
  reviewBulkRequestSchema,
} from "../bulk-action-schema";

import { messagesAt } from "./zod-issues";

const ids = (count: number): string[] => Array.from({ length: count }, (_, index) => `id-${index}`);

describe("productBulkRequestSchema", () => {
  it("accepts publish, unpublish and assignCategory", () => {
    expect(productBulkRequestSchema.parse({ ids: ["a", "b"], action: { type: "publish" } })).toEqual({ ids: ["a", "b"], action: { type: "publish" } });
    expect(productBulkRequestSchema.safeParse({ ids: ["a"], action: { type: "unpublish" } }).success).toBe(true);
    expect(productBulkRequestSchema.parse({ ids: ["a"], action: { type: "assignCategory", categoryId: "cat-1" } }).action).toEqual({
      type: "assignCategory",
      categoryId: "cat-1",
    });
  });

  it("strips fields a variant doesn't carry", () => {
    expect(productBulkRequestSchema.parse({ ids: ["a"], action: { type: "publish", price: 0 } }).action).toEqual({ type: "publish" });
  });

  it("refuses an action the union has no variant for", () => {
    const result = productBulkRequestSchema.safeParse({ ids: ["a"], action: { type: "setPrice", price: 1000 } });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["action", "type"]);
  });

  it("requires a category to move products into", () => {
    const result = productBulkRequestSchema.safeParse({ ids: ["a"], action: { type: "assignCategory", categoryId: "" } });
    expect(messagesAt(result, "action.categoryId")).toEqual(["categoryRequired"]);
  });

  it("bounds the selection", () => {
    expect(messagesAt(productBulkRequestSchema.safeParse({ ids: [], action: { type: "publish" } }), "ids")).toEqual(["selectionRequired"]);
    expect(productBulkRequestSchema.safeParse({ ids: ids(200), action: { type: "publish" } }).success).toBe(true);
    expect(messagesAt(productBulkRequestSchema.safeParse({ ids: ids(201), action: { type: "publish" } }), "ids")).toEqual(["selectionTooLarge"]);
    expect(messagesAt(productBulkRequestSchema.safeParse({ ids: [""], action: { type: "publish" } }), "ids.0")).toHaveLength(1);
  });
});

describe("categoryBulkRequestSchema", () => {
  it("only activates or deactivates", () => {
    expect(categoryBulkRequestSchema.safeParse({ ids: ["c1"], action: { type: "activate" } }).success).toBe(true);
    expect(categoryBulkRequestSchema.safeParse({ ids: ["c1"], action: { type: "deactivate" } }).success).toBe(true);
    expect(categoryBulkRequestSchema.safeParse({ ids: ["c1"], action: { type: "delete" } }).success).toBe(false);
  });

  it("bounds the selection", () => {
    expect(messagesAt(categoryBulkRequestSchema.safeParse({ ids: [], action: { type: "activate" } }), "ids")).toEqual(["selectionRequired"]);
  });
});

describe("reviewBulkRequestSchema", () => {
  it("approves or rejects, never sets pending", () => {
    expect(reviewBulkRequestSchema.parse({ ids: ["r1"], status: "approved" })).toEqual({ ids: ["r1"], status: "approved" });
    expect(reviewBulkRequestSchema.safeParse({ ids: ["r1"], status: "rejected" }).success).toBe(true);
    expect(messagesAt(reviewBulkRequestSchema.safeParse({ ids: ["r1"], status: "pending" }), "status")).toHaveLength(1);
  });
});

describe("orderBulkRequestSchema", () => {
  it("moves a delivery stage or cancels", () => {
    expect(orderBulkRequestSchema.parse({ ids: ["o1"], action: { type: "setStage", stage: "shipped" } }).action).toEqual({
      type: "setStage",
      stage: "shipped",
    });
    expect(orderBulkRequestSchema.safeParse({ ids: ["o1"], action: { type: "cancel" } }).success).toBe(true);
  });

  it("refuses an unknown stage", () => {
    const result = orderBulkRequestSchema.safeParse({ ids: ["o1"], action: { type: "setStage", stage: "delivered" } });
    expect(messagesAt(result, "action.stage")).toHaveLength(1);
  });

  it("caps the selection tighter than products", () => {
    expect(orderBulkRequestSchema.safeParse({ ids: ids(100), action: { type: "cancel" } }).success).toBe(true);
    expect(messagesAt(orderBulkRequestSchema.safeParse({ ids: ids(101), action: { type: "cancel" } }), "ids")).toEqual(["selectionTooLarge"]);
    expect(messagesAt(orderBulkRequestSchema.safeParse({ ids: [], action: { type: "cancel" } }), "ids")).toEqual(["selectionRequired"]);
  });
});

describe("bulkResultSchema", () => {
  it("reads the count of changed rows", () => {
    expect(bulkResultSchema.parse({ updated: 12 })).toEqual({ updated: 12 });
    expect(bulkResultSchema.safeParse({ updated: "12" }).success).toBe(false);
  });
});
