import { keepOnPublicMenu, type MenuCategories } from "./publicMenu";

import type { Product } from "../../entities/Product";
import type { IProductRepository } from "../../repositories/IProductRepository";

/** The featured items guests may see — on the public menu (see `isOnPublicMenu`). */
export class GetFeaturedProducts {
  constructor(
    private readonly productRepo: Pick<IProductRepository, "getFeatured">,
    private readonly categoryRepo: MenuCategories,
  ) {}

  async execute(locale?: string): Promise<Product[]> {
    return keepOnPublicMenu(this.categoryRepo, await this.productRepo.getFeatured(locale));
  }
}
