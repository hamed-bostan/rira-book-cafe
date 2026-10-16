import { hasProductSearchCriteria } from "../../entities/ProductFilters";

import type { Product } from "../../entities/Product";
import type { ProductFilters } from "../../entities/ProductFilters";
import type { IProductRepository } from "../../repositories/IProductRepository";

/**
 * Catalog search. Normalises the query and short-circuits an *all-empty* filter to
 * no results — a blank criteria set must never fall through to the whole catalog.
 * When a filter is present (a term, a category, a price bound, a dietary tag or a
 * brand) it delegates to the repository, which combines them with AND. Backs
 * `/api/products?q=` and its filter params.
 */
export class SearchProducts {
  constructor(private readonly productRepo: IProductRepository) {}

  execute(filters: ProductFilters, locale?: string): Promise<Product[]> {
    const query = filters.query?.trim() ?? "";
    const normalized: ProductFilters = { ...filters, query: query || undefined };

    if (!hasProductSearchCriteria(normalized)) return Promise.resolve([]);
    return this.productRepo.search(normalized, locale);
  }
}
