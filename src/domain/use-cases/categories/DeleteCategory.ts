import { activityValue } from "../../entities/ActivityEntry";
import { NotFoundError } from "../../errors/NotFoundError";
import { ResourceInUseError } from "../../errors/ResourceInUseError";
import { ValidationError } from "../../errors/ValidationError";

import { categorySnapshot } from "./categoryActivity";

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

    const existing = await this.categoryRepo.getById(id);
    if (!existing) throw new NotFoundError("category", id);

    // A category with items can't go: they'd drop off the menu. The database's key
    // refuses it too, but this says why, with the count, before trying.
    if (existing.productCount > 0) {
      throw new ResourceInUseError(
        "category",
        `${existing.name} still has ${existing.productCount} ${existing.productCount === 1 ? "product" : "products"} assigned to it. Move or remove those products first, then delete this category.`,
      );
    }

    // As with a deleted product: once the row is gone the log is the only place
    // this category's name and slug still exist, so the entry commits with the
    // delete and the diff records every tracked field moving to nothing.
    const snapshot = categorySnapshot(existing);
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
