import { activityValue } from "../../entities/ActivityEntry";
import { UniqueConstraintError } from "../../errors/UniqueConstraintError";
import { ValidationError } from "../../errors/ValidationError";

import { categorySnapshot } from "./categoryActivity";

import type { ActivityActor } from "../../entities/ActivityEntry";
import type { Category } from "../../entities/Category";
import type { ICategoryRepository, NewCategory } from "../../repositories/ICategoryRepository";

export class CreateCategory {
  constructor(
    private readonly categoryRepo: ICategoryRepository,
  ) {}

  async execute(input: NewCategory, actor: ActivityActor): Promise<Category> {
    const name = input.name.trim();
    const slug = input.slug.trim();
    if (!name) throw new ValidationError("name", "Name is required.");
    if (!slug) throw new ValidationError("slug", "Slug is required.");
    if (!input.iconUrl) throw new ValidationError("iconUrl", "An icon image is required.");

    // Slug uniqueness is this use-case's invariant, enforced here so every caller
    // gets it — not just one that remembers to pre-check. The DB's unique
    // constraint still guards the race between this check and the insert; that
    // path surfaces as the same UniqueConstraintError from the repository.
    const existing = await this.categoryRepo.getBySlug(slug);
    if (existing) throw new UniqueConstraintError(["slug"]);

    // The entry commits with the category — see `AuditHook`.
    return this.categoryRepo.create(
      { name, slug, iconUrl: input.iconUrl, isActive: input.isActive, translations: input.translations },
      (created) => ({
        actorId: actor.id,
        actorName: actor.name,
        action: "category.created",
        entityType: "category",
        entityId: created.id,
        entityLabel: created.name,
        changes: Object.entries(categorySnapshot(created))
          .map(([field, value]) => ({ field, before: null, after: activityValue(value) }))
          .filter((change) => change.after !== null),
      }),
    );
  }
}
