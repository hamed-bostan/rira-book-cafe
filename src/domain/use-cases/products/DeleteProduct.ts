import { activityValue } from "../../entities/ActivityEntry";
import { NotFoundError } from "../../errors/NotFoundError";
import { ValidationError } from "../../errors/ValidationError";

import { productSnapshot } from "./productActivity";

import type { ActivityActor } from "../../entities/ActivityEntry";
import type { IProductRepository } from "../../repositories/IProductRepository";

export class DeleteProduct {
  constructor(
    private readonly productRepo: IProductRepository,
  ) {}

  async execute(id: string, actor: ActivityActor): Promise<void> {
    if (!id) throw new ValidationError("id", "Missing product id.");

    const existing = await this.productRepo.getById(id);
    if (!existing) throw new NotFoundError("product", id);

    // The entry commits with the delete, which matters more here than anywhere
    // else: once this returns, the log is the *only* place the product's name,
    // price and level still exist. A window in which the row is gone and the entry
    // isn't yet written is a window in which that history can be lost outright.
    //
    // The hook takes no argument — a delete produces nothing to describe, and the
    // values it records are the ones read before the write.
    const snapshot = productSnapshot(existing);
    await this.productRepo.delete(id, () => ({
      actorId: actor.id,
      actorName: actor.name,
      action: "product.deleted",
      entityType: "product",
      entityId: id,
      entityLabel: existing.name,
      // Every tracked field moving to nothing, rather than the empty diff a delete
      // would otherwise produce.
      changes: Object.entries(snapshot)
        .map(([field, value]) => ({ field, before: activityValue(value), after: null }))
        .filter((change) => change.before !== null),
    }));
  }
}
