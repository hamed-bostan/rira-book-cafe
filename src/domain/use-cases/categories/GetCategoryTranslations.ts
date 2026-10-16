import type { CategoryTranslationInput, ICategoryRepository } from "../../repositories/ICategoryRepository";

/** The stored per-locale translations for a category — powers the admin edit form. */
export class GetCategoryTranslations {
  constructor(private readonly categoryRepo: ICategoryRepository) {}

  execute(categoryId: string): Promise<CategoryTranslationInput[]> {
    return this.categoryRepo.getTranslations(categoryId);
  }
}
