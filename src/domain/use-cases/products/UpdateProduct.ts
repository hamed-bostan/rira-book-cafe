import { diffFields } from "../../entities/ActivityEntry";
import { NotFoundError } from "../../errors/NotFoundError";
import { ValidationError } from "../../errors/ValidationError";

import { productSnapshot } from "./productActivity";
import { validateProduct } from "./validateProduct";

import type { ActivityActor } from "../../entities/ActivityEntry";
import type { Product } from "../../entities/Product";
import type { IProductRepository, NewProduct } from "../../repositories/IProductRepository";

export class UpdateProduct {
  constructor(private readonly productRepo: IProductRepository) {}

  /** `actor` is the admin saving the form, and is required — it attributes the activity entry. */
  async execute(id: string, input: NewProduct, actor: ActivityActor): Promise<Product> {
    if (!id) throw new ValidationError("id", "Missing product id.");
    const valid = validateProduct(input);

    const existing = await this.productRepo.getById(id);
    if (!existing) throw new NotFoundError("product", id);

    // The entry is written by the repository inside the transaction that saves the
    // item, diffed against the row the write actually produced. Returning `null`
    // for an unchanged save keeps the log a record of changes rather than clicks.
    return this.productRepo.update(id, valid, (saved) => {
      const changes = diffFields(productSnapshot(existing), productSnapshot(saved));
      if (changes.length === 0) return null;
      return {
        actorId: actor.id,
        actorName: actor.name,
        action: "product.updated",
        entityType: "product",
        entityId: saved.id,
        entityLabel: saved.name,
        changes,
      };
    });
  }
}
