import type { Product } from "../../entities/Product";
import type { IProductRepository } from "../../repositories/IProductRepository";

/**
 * One product, as the storefront may see it — `null` for an unpublished product,
 * exactly as for an id that never existed. Behind the public
 * `GET /api/products/:id`, so the product page 404s on a withdrawn product rather
 * than serving it to whoever kept the link.
 *
 * {@link GetProductById} is the dashboard's version, which sees every state.
 */
export class GetPublishedProduct {
  constructor(private readonly productRepo: IProductRepository) {}

  execute(id: string, locale?: string): Promise<Product | null> {
    return this.productRepo.getPublishedById(id, locale);
  }
}
