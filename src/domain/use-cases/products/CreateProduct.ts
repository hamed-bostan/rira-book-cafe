import { activityValue } from "../../entities/ActivityEntry";

import { validateProduct } from "./validateProduct";

import type { ActivityActor } from "../../entities/ActivityEntry";
import type { Product } from "../../entities/Product";
import type { IProductRepository, NewProduct } from "../../repositories/IProductRepository";

export class CreateProduct {
  constructor(private readonly productRepo: IProductRepository) {}

  /**
   * `actor` is the admin creating the item. Required, not optional: it's what the
   * activity log records, and an optional actor would make an unattributed item
   * one forgotten argument away.
   */
  async execute(input: NewProduct, actor: ActivityActor): Promise<Product> {
    const valid = validateProduct(input);

    // The entry is built here and written by the repository *inside* the
    // transaction that creates the item. The hook is a function of the persisted
    // row because the id it needs doesn't exist until the insert has run.
    return this.productRepo.create(valid, (created) => ({
      actorId: actor.id,
      actorName: actor.name,
      action: "product.created",
      entityType: "product",
      entityId: created.id,
      entityLabel: created.name,
      // A creation has no "before", so the diff records the values it started at.
      changes: [
        { field: "kind", before: null, after: activityValue(created.kind) },
        { field: "price", before: null, after: activityValue(created.price) },
        { field: "stockQuantity", before: null, after: activityValue(created.stockQuantity) },
      ],
    }));
  }
}
