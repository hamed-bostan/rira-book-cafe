import { bulkResultSchema, type BulkResult, type CategoryBulkAction } from "@/src/contracts/bulk-action-schema";
import type { CategoryFormInput, CategoryMoveInput } from "@/src/contracts/category-schema";
import type { Category } from "@/src/domain/entities/Category";
import { apiDelete, apiPatch, apiPost, apiPut } from "@/src/lib/api/client";
import { categoryResponseSchema } from "@/src/presentation/category/category-response-schema";

/**
 * Typed client for the category REST *mutations*. UI components call these instead
 * of touching Axios directly; each method resolves with domain data or rejects
 * with an `ApiError` — either normalized from the failure (see `client.ts`) or
 * raised because the response body didn't match `categoryResponseSchema`.
 * Reads are server-side (see `categoriesServerApi`).
 */
export const categoriesApi = {
  create(values: CategoryFormInput): Promise<Category> {
    return apiPost("/categories", values, categoryResponseSchema);
  },

  update(id: string, values: CategoryFormInput): Promise<Category> {
    return apiPut(`/categories/${id}`, values, categoryResponseSchema);
  },

  remove(id: string): Promise<void> {
    return apiDelete(`/categories/${id}`);
  },

  /** Move a category one place up or down the menu. */
  move(id: string, values: CategoryMoveInput): Promise<void> {
    return apiPost(`/admin/categories/${id}/move`, values);
  },

  /**
   * Apply one change to a selection of categories — activate or deactivate (the
   * list's "Hide from menu" / "Show on menu" sends one id). Resolves with how
   * many categories actually changed, which can be fewer than were selected
   * (some already held the value).
   */
  bulkUpdate(ids: readonly string[], action: CategoryBulkAction): Promise<BulkResult> {
    return apiPatch("/admin/categories/bulk", { ids, action }, bulkResultSchema);
  },
};
