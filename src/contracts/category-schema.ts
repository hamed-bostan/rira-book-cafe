import { CATEGORY_MOVE_DIRECTIONS } from "@/src/domain/entities/Category";
import * as z from "@/src/lib/zod";

import { imageUrlField } from "./image-url";

/**
 * The single source of truth for category form input, shared by the client form
 * (React Hook Form resolver) and the REST route handlers (defensive re-validation
 * — never trust the client). Framework-free, so it stays importable from both.
 * Validation messages are `formErrors` message keys, translated at display time
 * (see `src/lib/formErrorMessage.ts`).
 */
export const categoryFormSchema = z.pipe(
  z.object({
    name: z.string().check(z.trim(), z.minLength(1, "nameRequired"), z.maxLength(50, "nameTooLong")),
    slug: z
      .string()
      .check(
        z.trim(),
        z.minLength(1, "slugRequired"),
        z.maxLength(60, "slugTooLong"),
        z.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slugFormat"),
      ),
    iconUrl: imageUrlField("iconRequired"),
    // A new category is active by default, matching the column — an operator who
    // wants to stage one deactivates it deliberately.
    isActive: z._default(z.boolean(), true),
    // Optional Persian (fa) name override; blank means "no fa translation".
    faName: z.pipe(
      z.string().check(z.trim()),
      z.transform((value) => (value.length > 0 ? value : undefined)),
    ),
  }),
  z.transform(({ faName, ...base }) => ({
    ...base,
    translations: faName ? [{ locale: "fa", name: faName }] : [],
  })),
);

/** Form value shape (what the controls hold, before transform). */
export type CategoryFormInput = z.input<typeof categoryFormSchema>;
/** Validated payload shape (what the use-case receives) — matches `NewCategory`. */
export type CategoryFormValues = z.output<typeof categoryFormSchema>;

/** Moving a category one place on the menu — the list's up/down buttons. */
export const categoryMoveSchema = z.object({ direction: z.enum(CATEGORY_MOVE_DIRECTIONS) });
export type CategoryMoveInput = z.infer<typeof categoryMoveSchema>;
