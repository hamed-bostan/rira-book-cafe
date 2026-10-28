import type { AdminProductFilters, AdminProductSort } from "../../entities/AdminProductFilters";
import type { Page, PageRequest } from "../../entities/Pagination";
import type { ProductListItem } from "../../entities/Product";
import type { IProductRepository } from "../../repositories/IProductRepository";

/**
 * One page of the catalog-management list. Backs `GET /api/admin/products`. Each
 * made-to-order row comes with its recipe's worst ingredient, when one is out or
 * running low — the warning the list shows in place of a count.
 *
 * Normalises a blank search term to "no term" so `?q=` and `?q=%20` behave like an
 * unfiltered list rather than a search for whitespace — the same normalisation
 * `SearchProducts` does. Unlike that use-case, an empty filter set is *not* short-
 * circuited to no results: the management list with no filters is the whole
 * catalog, one page at a time.
 */
export class ListProducts {
  constructor(private readonly productRepo: IProductRepository) {}

  execute(
    filters: AdminProductFilters,
    page: PageRequest<AdminProductSort>,
    locale?: string,
  ): Promise<Page<ProductListItem>> {
    const query = filters.query?.trim() ?? "";
    return this.productRepo.listPage({ ...filters, query: query || undefined }, page, locale);
  }
}
