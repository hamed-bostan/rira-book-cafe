import { describe, expect, it, vi } from "vitest";

import { ConflictError } from "../../../errors/ConflictError";
import { NotFoundError } from "../../../errors/NotFoundError";
import { ValidationError } from "../../../errors/ValidationError";
import { DeleteProducts } from "../DeleteProducts";

import type { Product } from "../../../entities/Product";

const ACTOR = { id: "a1", name: "Admin" };

const products = {
  getByIds: vi.fn(async (ids: readonly string[]) => ids.map((id) => ({ id, name: `Item ${id}` }) as Product)),
};

describe("DeleteProducts", () => {
  it("deletes each item through the single delete and reports refusals by name", async () => {
    const deleteOne = {
      execute: vi.fn(async (id: string) => {
        if (id === "book") throw new ConflictError("BOOK_IN_USE", "On loan.");
        if (id === "gone") throw new NotFoundError("product", id);
      }),
    };
    const result = await new DeleteProducts(products, deleteOne).execute(["a", "book", "b", "gone", "a"], ACTOR);

    // Duplicates are deleted once.
    expect(deleteOne.execute).toHaveBeenCalledTimes(4);
    expect(deleteOne.execute).toHaveBeenCalledWith("a", ACTOR);
    expect(result).toEqual({
      deleted: 2,
      refused: [
        { id: "book", name: "Item book", reason: "bookInUse" },
        { id: "gone", name: "Item gone", reason: "notFound" },
      ],
    });
  });

  it("stops on an unexpected failure, keeping what was already deleted", async () => {
    const deleteOne = {
      execute: vi.fn(async (id: string) => {
        if (id === "b") throw new Error("db down");
      }),
    };
    await expect(new DeleteProducts(products, deleteOne).execute(["a", "b", "c"], ACTOR)).rejects.toThrow("db down");
    expect(deleteOne.execute).toHaveBeenCalledTimes(2);
  });

  it("refuses an empty selection and one over the cap", async () => {
    const deleteOne = { execute: vi.fn(async () => {}) };
    const useCase = new DeleteProducts(products, deleteOne);
    await expect(useCase.execute([], ACTOR)).rejects.toBeInstanceOf(ValidationError);
    await expect(
      useCase.execute(
        Array.from({ length: 201 }, (_, i) => `p${i}`),
        ACTOR,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(deleteOne.execute).not.toHaveBeenCalled();
  });
});
