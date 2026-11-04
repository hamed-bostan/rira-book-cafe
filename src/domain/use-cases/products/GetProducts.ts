import { keepOnPublicMenu, type MenuCategories } from "./publicMenu";

import type { Product } from "../../entities/Product";
import type { IProductRepository } from "../../repositories/IProductRepository";

/** The public menu: published items in shown categories (see `isOnPublicMenu`). */
export class GetProducts {
  constructor(
    private readonly productRepo: Pick<IProductRepository, "getAll">,
    private readonly categoryRepo: MenuCategories,
  ) {}

  async execute(locale?: string): Promise<Product[]> {
    return keepOnPublicMenu(this.categoryRepo, await this.productRepo.getAll(locale));
  }
}
