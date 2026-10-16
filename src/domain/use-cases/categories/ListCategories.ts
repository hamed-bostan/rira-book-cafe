import type { AdminCategoryFilters, AdminCategorySort } from "../../entities/AdminCategoryFilters";
import type { Category } from "../../entities/Category";
import type { Page, PageRequest } from "../../entities/Pagination";
import type { ICategoryRepository } from "../../repositories/ICategoryRepository";

/**
 * One page of the category-management list. Backs `GET /api/admin/categories`.
 *
 * Normalises a blank search term to "no term", the same normalisation
 * `ListProducts` does for the catalog list.
 */
export class ListCategories {
  constructor(private readonly categoryRepo: ICategoryRepository) {}

  execute(
    filters: AdminCategoryFilters,
    page: PageRequest<AdminCategorySort>,
    locale?: string,
  ): Promise<Page<Category>> {
    const query = filters.query?.trim() ?? "";
    return this.categoryRepo.listPage({ ...filters, query: query || undefined }, page, locale);
  }
}
