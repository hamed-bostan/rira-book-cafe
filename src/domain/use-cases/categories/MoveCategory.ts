import { singleChange } from "../../entities/ActivityEntry";
import { NotFoundError } from "../../errors/NotFoundError";
import { ValidationError } from "../../errors/ValidationError";

import type { ActivityActor } from "../../entities/ActivityEntry";
import type { CategoryMoveDirection } from "../../entities/Category";
import type { ICategoryRepository } from "../../repositories/ICategoryRepository";

/**
 * Move a category one place up or down the menu — the dashboard's up/down
 * buttons. It swaps places with its neighbour, and the whole order is written
 * back so positions stay 0…n-1 even if an earlier write left a gap or a tie.
 *
 * The entry is recorded as an update to the moved category, with its place on
 * the menu (counted from one, as the dashboard shows it) before and after.
 */
export class MoveCategory {
  constructor(private readonly categoryRepo: ICategoryRepository) {}

  async execute(id: string, direction: CategoryMoveDirection, actor: ActivityActor): Promise<void> {
    if (!id) throw new ValidationError("id", "Missing category id.");

    const categories = await this.categoryRepo.getAll();
    const from = categories.findIndex((category) => category.id === id);
    if (from < 0) throw new NotFoundError("category", id);

    const moved = categories[from];
    const to = direction === "up" ? from - 1 : from + 1;
    if (to < 0) throw new ValidationError("direction", `${moved.name} is already first on the menu.`);
    if (to >= categories.length) throw new ValidationError("direction", `${moved.name} is already last on the menu.`);

    const ids = categories.map((category) => category.id);
    [ids[from], ids[to]] = [ids[to], ids[from]];

    await this.categoryRepo.setOrder(ids, () => ({
      actorId: actor.id,
      actorName: actor.name,
      action: "category.updated",
      entityType: "category",
      entityId: moved.id,
      entityLabel: moved.name,
      changes: singleChange("position", from + 1, to + 1),
    }));
  }
}
