import type { Product } from "../../entities/Product";
import type { IProductRepository } from "../../repositories/IProductRepository";

/**
 * Resolve a set of products by id — for screens that already hold product ids and
 * need to label them, such as the moderation queue showing each review's product.
 *
 * Backs `GET /api/products?ids=`. It exists so those screens stop reading the
 * whole catalog to build a lookup map: a page of 20 reviews needs at most 20
 * products, not every product in the store.
 *
 * Duplicate ids are collapsed before the read, since callers derive the list from
 * rows that often share a product.
 */
export class GetProductsByIds {
  constructor(private readonly productRepo: IProductRepository) {}

  execute(ids: readonly string[], locale?: string): Promise<Product[]> {
    return this.productRepo.getByIds([...new Set(ids)], locale);
  }
}
