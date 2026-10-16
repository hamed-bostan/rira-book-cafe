import type { IProductRepository, ProductTranslationInput } from "../../repositories/IProductRepository";

/** The stored per-locale translations for a product — powers the admin edit form. */
export class GetProductTranslations {
  constructor(private readonly productRepo: IProductRepository) {}

  execute(productId: string): Promise<ProductTranslationInput[]> {
    return this.productRepo.getTranslations(productId);
  }
}
