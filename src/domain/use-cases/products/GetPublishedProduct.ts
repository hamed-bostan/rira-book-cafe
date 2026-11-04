import { keepOnPublicMenu, type MenuCategories } from "./publicMenu";

import type { Product } from "../../entities/Product";
import type { IProductRepository } from "../../repositories/IProductRepository";

/**
 * One product, as the storefront may see it — `null` for one that isn't on the
 * public menu (unpublished, or in a hidden category — see `isOnPublicMenu`),
 * exactly as for an id that never existed. Behind the public
 * `GET /api/products/:id`, so the product page 404s on a withdrawn product rather
 * than serving it to whoever kept the link.
 *
 * {@link GetProductById} is the dashboard's version, which sees every state.
 */
export class GetPublishedProduct {
  constructor(
    private readonly productRepo: Pick<IProductRepository, "getPublishedById">,
    private readonly categoryRepo: MenuCategories,
  ) {}

  async execute(id: string, locale?: string): Promise<Product | null> {
    const product = await this.productRepo.getPublishedById(id, locale);
    if (!product) return null;
    const [shown] = await keepOnPublicMenu(this.categoryRepo, [product]);
    return shown ?? null;
  }
}
