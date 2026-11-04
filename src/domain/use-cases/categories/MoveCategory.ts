import { singleChange } from "../../entities/ActivityEntry";
import { NotFoundError } from "../../errors/NotFoundError";
import { ValidationError } from "../../errors/ValidationError";

import { MENU_POSITION_FIELD } from "./categoryActivity";

import type { ActivityActor } from "../../entities/ActivityEntry";
import type { CategoryMoveDirection } from "../../entities/Category";
import type { ICategoryRepository } from "../../repositories/ICategoryRepository";

/**
 * Move a category one place up or down among its siblings — the dashboard's
 * up/down buttons. A top-level category moves among the top-level ones, a
 * subcategory among its parent's others; neither ever changes parent this way. It
 * swaps places with its neighbour, and the siblings' whole order is written back
 * so places stay 0…n-1 even if an earlier write left a gap or a tie.
 *
 * The entry is recorded as an update to the moved category, with its place among
 * its siblings (counted from one, as the dashboard shows it) before and after.
 */
export class MoveCategory {
  constructor(private readonly categoryRepo: ICategoryRepository) {}

  async execute(id: string, direction: CategoryMoveDirection, actor: ActivityActor): Promise<void> {
    if (!id) throw new ValidationError("id", "Missing category id.");

    const categories = await this.categoryRepo.getAll();
    const moved = categories.find((category) => category.id === id);
    if (!moved) throw new NotFoundError("category", id);

    const siblings = categories.filter((category) => category.parentId === moved.parentId);
    const from = siblings.findIndex((category) => category.id === id);
    const to = direction === "up" ? from - 1 : from + 1;
    if (to < 0) throw new ValidationError("direction", `${moved.name} is already first.`);
    if (to >= siblings.length) throw new ValidationError("direction", `${moved.name} is already last.`);

    const ids = siblings.map((category) => category.id);
    [ids[from], ids[to]] = [ids[to], ids[from]];

    await this.categoryRepo.setOrder(moved.parentId, ids, [
      () => ({
        actorId: actor.id,
        actorName: actor.name,
        action: "category.updated",
        entityType: "category",
        entityId: moved.id,
        entityLabel: moved.name,
        changes: singleChange(MENU_POSITION_FIELD, from + 1, to + 1),
      }),
    ]);
  }
}
