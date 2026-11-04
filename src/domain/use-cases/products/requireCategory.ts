import { ValidationError } from "../../errors/ValidationError";

import type { ICategoryRepository } from "../../repositories/ICategoryRepository";

/**
 * Refuse a category that doesn't exist — a hand-written request, or one deleted
 * in another tab since the form was opened. An item filed under a missing
 * category would drop silently off the public menu, so creating, editing and
 * moving items all check it here, as a field error the form shows on its
 * category picker. (The database's key refuses it too; this is the answer the
 * admin reads.) The message is a `formErrors` key, localized client-side.
 */
export async function requireCategory(
  categoryRepo: Pick<ICategoryRepository, "getById">,
  categoryId: string,
): Promise<void> {
  if (!categoryId) throw new ValidationError("categoryId", "categoryRequired");
  if (!(await categoryRepo.getById(categoryId))) throw new ValidationError("categoryId", "categoryUnknown");
}
