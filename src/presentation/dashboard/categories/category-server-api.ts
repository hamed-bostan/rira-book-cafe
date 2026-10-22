import type { Category } from "@/src/domain/entities/Category";
import type { CategoryTranslationInput } from "@/src/domain/repositories/ICategoryRepository";
import { ApiError } from "@/src/lib/api/ApiError";
import { serverApiGet } from "@/src/lib/api/server-client";
import {
  categoryListResponseSchema,
  categoryResponseSchema,
} from "@/src/presentation/category/category-response-schema";

import { categoryTranslationListResponseSchema } from "./category-translation-response-schema";

/**
 * Server-side category reads for the dashboard (BFF). Fetched during server
 * render so the data arrives with the page instead of after a client round-trip.
 * Mutations go through the browser `categoriesApi`, which then `router.refresh()`es
 * to re-run these reads.
 */
export const categoriesServerApi = {
  /**
   * Every category in menu order, hidden ones included, each with its item
   * counts. Localized: the admin list is for reading, so it follows the active
   * locale (falling back to the base name where a category has no translation yet).
   */
  list(): Promise<Category[]> {
    return serverApiGet("/categories", categoryListResponseSchema);
  },

  /**
   * Resolve a category by id; `null` on 404 so callers can `notFound()`.
   *
   * Canonical: this feeds the edit form, which writes back to the base row —
   * prefilling it with translated text would overwrite that row on save.
   */
  async getById(id: string): Promise<Category | null> {
    try {
      return await serverApiGet(`/categories/${id}`, categoryResponseSchema, { canonical: true });
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },

  /** The category's stored per-locale translations, to prefill the edit form. */
  getTranslations(id: string): Promise<CategoryTranslationInput[]> {
    return serverApiGet(`/categories/${id}/translations`, categoryTranslationListResponseSchema);
  },
};
