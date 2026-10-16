import type { Product } from "../../entities/Product";
import type { IProductRepository } from "../../repositories/IProductRepository";

/**
 * One product in any visibility state — the dashboard's read, behind
 * `GET /api/admin/products/:id`. Gate the caller to admins.
 *
 * {@link GetPublishedProduct} is the storefront's version. The dashboard needs this
 * one because it must be able to open a product it has just unpublished; served the
 * published-only read, unpublishing would be a one-way door with no way back to the
 * edit form.
 */
export class GetProductById {
  constructor(private readonly productRepo: IProductRepository) {}

  execute(id: string, locale?: string): Promise<Product | null> {
    return this.productRepo.getById(id, locale);
  }
}
