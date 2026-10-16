import type { Category } from "../../entities/Category";
import type { ICategoryRepository } from "../../repositories/ICategoryRepository";

export class GetCategoryById {
  constructor(private readonly categoryRepo: ICategoryRepository) {}

  execute(id: string, locale?: string): Promise<Category | null> {
    return this.categoryRepo.getById(id, locale);
  }
}
