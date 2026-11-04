import { activityValue } from "../../entities/ActivityEntry";
import { ConflictError } from "../../errors/ConflictError";
import { NotFoundError } from "../../errors/NotFoundError";
import { ResourceInUseError } from "../../errors/ResourceInUseError";
import { ValidationError } from "../../errors/ValidationError";

import { categorySnapshot } from "./categoryActivity";
import { parentNameOf } from "./categoryParent";

import type { ActivityActor } from "../../entities/ActivityEntry";
import type { ICategoryRepository } from "../../repositories/ICategoryRepository";
import type { IImageStorageRepository } from "../../repositories/IImageStorageRepository";

export class DeleteCategory {
  constructor(
    private readonly categoryRepo: ICategoryRepository,
    private readonly imageStorage: IImageStorageRepository,
  ) {}

  async execute(id: string, actor: ActivityActor): Promise<void> {
    if (!id) throw new ValidationError("id", "Missing category id.");

    const categories = await this.categoryRepo.getAll();
    const existing = categories.find((category) => category.id === id);
    if (!existing) throw new NotFoundError("category", id);

    // A category with items can't go: they'd drop off the menu. The database's key
    // refuses it too, but this says why, with the count, before trying.
    if (existing.productCount > 0) {
      throw new ResourceInUseError(
        "category",
        `${existing.name} still has ${existing.productCount} ${existing.productCount === 1 ? "product" : "products"} assigned to it. Move or remove those products first, then delete this category.`,
      );
    }
    // Nor can a parent with subcategories: they'd be left hanging under nothing.
    // Moving them (or deleting them) first is a deliberate choice, not a side effect.
    const children = categories.filter((category) => category.parentId === id).length;
    if (children > 0) {
      throw new ConflictError(
        "HAS_SUBCATEGORIES",
        `${existing.name} still has ${children} ${children === 1 ? "subcategory" : "subcategories"}. Move or delete them first, then delete this category.`,
      );
    }

    // As with a deleted product: once the row is gone the log is the only place
    // this category's name and slug still exist, so the entry commits with the
    // delete and the diff records every tracked field moving to nothing.
    const snapshot = categorySnapshot(existing, parentNameOf(existing, categories));
    await this.categoryRepo.delete(id, () => ({
      actorId: actor.id,
      actorName: actor.name,
      action: "category.deleted",
      entityType: "category",
      entityId: id,
      entityLabel: existing.name,
      changes: Object.entries(snapshot)
        .map(([field, value]) => ({ field, before: activityValue(value), after: null }))
        .filter((change) => change.before !== null),
    }));

    // Reclaim the now-orphaned icon (best-effort: never blocks the delete).
    await this.imageStorage.removeByUrl(existing.iconUrl);
  }
}
