import { describe, expect, it } from "vitest";

import { InsufficientStockError } from "../InsufficientStockError";
import { NotFoundError } from "../NotFoundError";
import { ResourceInUseError } from "../ResourceInUseError";
import { UniqueConstraintError } from "../UniqueConstraintError";

describe("domain errors", () => {
  it("names each shortfall in an insufficient-stock error", () => {
    const error = new InsufficientStockError([
      { productId: "p1", name: "Latte", available: 1, requested: 3 },
      { productId: "p2", name: "Cake", available: 0, requested: 1 },
    ]);
    expect(error.name).toBe("InsufficientStockError");
    expect(error.message).toBe("Not enough stock for: Latte (1 left, 3 requested), Cake (0 left, 1 requested).");
    expect(error.shortfalls).toHaveLength(2);
  });

  it("says what was missing, with or without an identifier", () => {
    expect(new NotFoundError("order", "o1").message).toBe('order "o1" was not found.');
    expect(new NotFoundError("order").message).toBe("order was not found.");
  });

  it("names the fields of a unique violation when known", () => {
    expect(new UniqueConstraintError(["slug"]).message).toBe("Unique constraint violated on: slug.");
    expect(new UniqueConstraintError([]).message).toBe("Unique constraint violated.");
  });

  it("carries the entity and cause of a resource-in-use refusal", () => {
    const cause = new Error("fk");
    const error = new ResourceInUseError("category", "Still has products.", { cause });
    expect(error).toMatchObject({ name: "ResourceInUseError", entity: "category", message: "Still has products." });
    expect(error.cause).toBe(cause);
  });
});
