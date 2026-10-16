import { z } from "zod";

/**
 * The single source of truth for category form input, shared by the client form
 * (React Hook Form resolver) and the REST route handlers (defensive re-validation
 * — never trust the client). Framework-free, so it stays importable from both.
 * Validation messages are `formErrors` message keys, translated at display time
 * (see `src/lib/formErrorMessage.ts`).
 */
export const categoryFormSchema = z
  .object({
    name: z.string().trim().min(1, "nameRequired").max(50, "nameTooLong"),
    slug: z
      .string()
      .trim()
      .min(1, "slugRequired")
      .max(60, "slugTooLong")
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slugFormat"),
    iconUrl: z.string().min(1, "iconRequired").url("imageInvalid"),
    // A new category is active by default, matching the column — an operator who
    // wants to stage one deactivates it deliberately.
    isActive: z.boolean().default(true),
    // Optional Persian (fa) name override; blank means "no fa translation".
    faName: z
      .string()
      .trim()
      .transform((value) => (value.length > 0 ? value : undefined)),
  })
  .transform(({ faName, ...base }) => ({
    ...base,
    translations: faName ? [{ locale: "fa", name: faName }] : [],
  }));

/** Form value shape (what the controls hold, before transform). */
export type CategoryFormInput = z.input<typeof categoryFormSchema>;
/** Validated payload shape (what the use-case receives) — matches `NewCategory`. */
export type CategoryFormValues = z.output<typeof categoryFormSchema>;
