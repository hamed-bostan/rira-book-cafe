import type { Category } from "../../entities/Category";
import type { ICategoryRepository } from "../../repositories/ICategoryRepository";

export class GetCategories {
  constructor(private readonly categoryRepo: ICategoryRepository) {}

  execute(locale?: string): Promise<Category[]> {
    return this.categoryRepo.getAll(locale);
  }
}
