import { diffFields } from "../../entities/ActivityEntry";
import { NotFoundError } from "../../errors/NotFoundError";
import { UniqueConstraintError } from "../../errors/UniqueConstraintError";
import { ValidationError } from "../../errors/ValidationError";

import { categorySnapshot } from "./categoryActivity";

import type { ActivityActor } from "../../entities/ActivityEntry";
import type { Category } from "../../entities/Category";
import type { ICategoryRepository, NewCategory } from "../../repositories/ICategoryRepository";
import type { IImageStorageRepository } from "../../repositories/IImageStorageRepository";



export class UpdateCategory {
  constructor(
    private readonly categoryRepo: ICategoryRepository,
    private readonly imageStorage: IImageStorageRepository,
  ) {}

  async execute(id: string, input: NewCategory, actor: ActivityActor): Promise<Category> {
    if (!id) throw new ValidationError("id", "Missing category id.");
    const name = input.name.trim();
    const slug = input.slug.trim();
    if (!name) throw new ValidationError("name", "Name is required.");
    if (!slug) throw new ValidationError("slug", "Slug is required.");
    if (!input.iconUrl) throw new ValidationError("iconUrl", "An icon image is required.");

    // Slug uniqueness is this use-case's invariant: reject a slug already owned by
    // a *different* category (renaming to your own current slug is fine). The DB's
    // unique constraint still guards the check-to-update race — that path surfaces
    // as the same UniqueConstraintError from the repository.
    const clash = await this.categoryRepo.getBySlug(slug);
    if (clash && clash.id !== id) throw new UniqueConstraintError(["slug"]);

    const previous = await this.categoryRepo.getById(id);
    if (!previous) throw new NotFoundError("category", id);

    const updated = await this.categoryRepo.update(
      id,
      { name, slug, iconUrl: input.iconUrl, isActive: input.isActive, translations: input.translations },
      (saved) => {
        const changes = diffFields(categorySnapshot(previous), categorySnapshot(saved));
        if (changes.length === 0) return null;
        return {
          actorId: actor.id,
          actorName: actor.name,
          action: "category.updated",
          entityType: "category",
          entityId: saved.id,
          entityLabel: saved.name,
          changes,
        };
      },
    );

    // Reclaim the previous icon when it's been swapped out (best-effort). After
    // the write, so the entry still records the old URL even if reclaiming throws.
    if (previous.iconUrl !== updated.iconUrl) {
      await this.imageStorage.removeByUrl(previous.iconUrl);
    }

    return updated;
  }
}
