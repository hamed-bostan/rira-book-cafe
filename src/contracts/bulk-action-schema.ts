import { z } from "zod";

/**
 * The single source of truth for the dashboard's bulk actions, shared by the
 * selection UI and the admin REST routes (defensive re-validation — never trust the
 * client). Framework-free, so it stays importable from both.
 *
 * Both endpoints take the selected ids plus a *discriminated* action rather than a
 * loose patch object. The union is the guard rail: `PATCH /admin/products/bulk`
 * accepts publish, unpublish and "move to category" and cannot be made to express
 * "set the price of these forty products", because that variant doesn't exist. A
 * partial-`Product` body would have accepted it and left the refusal to a runtime
 * check somebody has to remember to write.
 */

/** Ids a bulk action applies to. Bounded here too — the use-cases enforce the same cap. */
const idsField = z
  .array(z.string().min(1))
  .min(1, "selectionRequired")
  .max(200, "selectionTooLarge");

/**
 * What to do to the selected products.
 *
 * `publish`/`unpublish` are two variants rather than one carrying a boolean because
 * that's what the UI has: two buttons. A `{ type: "setPublished", value }` shape
 * would be the same thing with an extra hop, and would let a caller send a
 * non-boolean to find out what happens.
 */
export const productBulkActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("publish") }),
  z.object({ type: z.literal("unpublish") }),
  z.object({ type: z.literal("assignCategory"), categoryId: z.string().min(1, "categoryRequired") }),
]);

export const productBulkRequestSchema = z.object({
  ids: idsField,
  action: productBulkActionSchema,
});

export type ProductBulkAction = z.infer<typeof productBulkActionSchema>;
export type ProductBulkRequest = z.infer<typeof productBulkRequestSchema>;

/**
 * What to do to the selected categories: activate or deactivate. No bulk
 * delete — deleting a category is destructive and rare enough to stay a
 * per-row confirm, so the union has no variant for it to route around.
 */
export const categoryBulkActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("activate") }),
  z.object({ type: z.literal("deactivate") }),
]);

export const categoryBulkRequestSchema = z.object({
  ids: idsField,
  action: categoryBulkActionSchema,
});

export type CategoryBulkAction = z.infer<typeof categoryBulkActionSchema>;
export type CategoryBulkRequest = z.infer<typeof categoryBulkRequestSchema>;

/**
 * Bulk review moderation. `status` matches `reviewModerationSchema` — an admin can
 * only approve or reject, since "pending" is the submission-time default and not a
 * decision anyone makes.
 */
export const reviewBulkRequestSchema = z.object({
  ids: idsField,
  status: z.enum(["approved", "rejected"]),
});

export type ReviewBulkRequest = z.infer<typeof reviewBulkRequestSchema>;

/**
 * What to do to the selected orders.
 *
 * Far narrower than the row menu might suggest, and narrower still than the
 * mock's: `setStage` moves the delivery milestone, `cancel` calls the order off.
 * Nothing else on an order can be done to a *selection* — resolving a return or a
 * substitution is a decision about one specific order's contents, and there is no
 * meaningful "approve these twelve returns" that doesn't amount to approving them
 * unread.
 *
 * Orders are capped tighter than products (see `MAX_BULK_ORDERS`): each one of
 * these moves stock and money, where a product bulk change moves a column.
 */
export const orderBulkActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("setStage"), stage: z.enum(["confirmed", "shipped", "arrived"]) }),
  z.object({ type: z.literal("cancel") }),
]);

export const orderBulkRequestSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "selectionRequired").max(100, "selectionTooLarge"),
  action: orderBulkActionSchema,
});

export type OrderBulkAction = z.infer<typeof orderBulkActionSchema>;
export type OrderBulkRequest = z.infer<typeof orderBulkRequestSchema>;

/**
 * What a bulk endpoint answers with: how many rows the action actually changed.
 *
 * `updated` is not necessarily `ids.length` — ids that no longer exist and rows
 * already holding the target value are skipped — and the screen reports this number
 * rather than the selection size, so "12 of 20 updated" is something the admin can
 * see rather than a silent discrepancy.
 */
export const bulkResultSchema = z.object({
  updated: z.number(),
});

export type BulkResult = z.infer<typeof bulkResultSchema>;
