import type { Product } from "../../entities/Product";
import type { IProductRepository } from "../../repositories/IProductRepository";

export class GetProducts {
  constructor(private readonly productRepo: IProductRepository) {}

  execute(locale?: string): Promise<Product[]> {
    return this.productRepo.getAll(locale);
  }
}
