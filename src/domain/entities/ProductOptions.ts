/**
 * Options on a menu item — a size, a milk, extras — and what choosing them does to
 * a line's price.
 *
 * An item (a drink or a food; never a book) holds option groups in order. A group
 * is either single-choice (Size: Small / Medium / Large — at most one) or
 * multiple-choice (Extras: an extra shot, oat milk — between a minimum and a
 * maximum), and either required or optional. Each choice can add to the price (a
 * whole number of Toman, 0 for a free choice) and can be switched off for a while
 * (the oat milk ran out) without being deleted.
 *
 * Options change the price only. Stock and the cost of sales follow the item's
 * own recipe whatever was chosen: an extra shot doesn't take a second shot of
 * espresso out of Inventory (a known limitation, kept so options can't break the
 * stock and cost-of-sales posting).
 *
 * When an order takes a line, the choices are snapshotted onto it
 * ({@link OrderItemOption}) — the names in both languages and what each added —
 * so later edits to the item never change a past order.
 */

/** How many choices a group takes: one at most, or several within its bounds. */
export const OPTION_SELECTIONS = ["single", "multiple"] as const;
export type OptionSelection = (typeof OPTION_SELECTIONS)[number];

/** Most option groups on one item — a long menu card, not a configurator. */
export const MAX_OPTION_GROUPS = 8;
/** Most choices in one group. */
export const MAX_OPTION_CHOICES = 20;
/** Longest name of a group or a choice, in either language. */
export const MAX_OPTION_NAME_LENGTH = 60;
/** Most choices one order line can carry (every group at its fullest is far fewer in practice). */
export const MAX_LINE_CHOICES = MAX_OPTION_GROUPS * MAX_OPTION_CHOICES;

export type ProductOptionChoice = {
  id: string;
  /** The English (base) name. */
  name: string;
  /** The Persian name; absent falls back to `name`. */
  nameFa?: string;
  /** Added to the item's price when chosen, in Toman (0 or more). */
  priceDelta: number;
  /** Off while it can't be made; guests and staff can't choose it then. */
  isAvailable: boolean;
  /**
   * Chosen to begin with. Only a required single-choice group has a default (at
   * most one): it's what a guest gets when they don't pick, and what the item's
   * page starts on.
   */
  isDefault: boolean;
};

export type ProductOptionGroup = {
  id: string;
  name: string;
  nameFa?: string;
  /** A required group must be answered: a single-choice one with one choice, a multiple one with at least `minChoices`. */
  required: boolean;
  selection: OptionSelection;
  /** A required multiple-choice group's least number of choices (1 or more); 0 otherwise. */
  minChoices: number;
  /** A multiple-choice group's most choices; absent means as many as it has. 1 for a single-choice group. */
  maxChoices?: number;
  /** In order. */
  choices: ProductOptionChoice[];
};

/**
 * A group as the item's form saves it: a group or choice that carries the `id` of
 * one the item already has is that one, kept (so a guest's basket still names it);
 * one without is new. Positions are the order of the lists.
 */
export type ProductOptionGroupInput = Omit<ProductOptionGroup, "id" | "choices"> & {
  id?: string;
  choices: (Omit<ProductOptionChoice, "id"> & { id?: string })[];
};

/**
 * A choice as an order line keeps it: which group and choice it was, their names in
 * both languages, and what it added to the line's unit price, as they were when the
 * line was taken.
 */
export type OrderItemOption = {
  groupId: string;
  group: string;
  groupFa?: string;
  choiceId: string;
  choice: string;
  choiceFa?: string;
  /** Added to the line's unit price, in Toman. */
  priceDelta: number;
};

/** A name in the reader's language: the Persian one on the Persian site when there is one. */
export function localizedName(name: string, nameFa: string | undefined, locale: string): string {
  return locale === "fa" && nameFa ? nameFa : name;
}

/** The least and most choices a group takes. */
export function choiceBounds(
  group: Pick<ProductOptionGroup, "required" | "selection" | "minChoices" | "maxChoices" | "choices">,
): {
  min: number;
  max: number;
} {
  if (group.selection === "single") return { min: group.required ? 1 : 0, max: 1 };
  const max = Math.min(group.maxChoices ?? group.choices.length, group.choices.length);
  return { min: group.required ? Math.max(1, group.minChoices) : 0, max };
}

/** Why a selection can't be ordered, as a `formErrors` key. */
export type OptionSelectionProblem =
  "optionUnknown" | "optionUnavailable" | "optionRequired" | "optionTooFew" | "optionTooMany";

/**
 * The choices a selection starts on: each required single-choice group's default,
 * when it's available. What the item's page first shows, and what the server
 * applies to a required group the request left unanswered.
 */
export function defaultChoiceIds(groups: readonly ProductOptionGroup[]): string[] {
  return groups.flatMap((group) => {
    if (group.selection !== "single" || !group.required) return [];
    const choice = group.choices.find((candidate) => candidate.isDefault && candidate.isAvailable);
    return choice ? [choice.id] : [];
  });
}

/**
 * Check a selection against an item's groups: every choice is the item's, can be
 * had now, and isn't chosen twice; every group gets between its least and most.
 * `null` when it can be ordered. Shared by the item's page (to enable Add) and the
 * server (which refuses what it says).
 */
export function optionSelectionProblem(
  groups: readonly ProductOptionGroup[],
  choiceIds: readonly string[],
): OptionSelectionProblem | null {
  if (new Set(choiceIds).size !== choiceIds.length) return "optionUnknown";
  const groupOf = new Map<string, { group: ProductOptionGroup; choice: ProductOptionChoice }>();
  for (const group of groups) for (const choice of group.choices) groupOf.set(choice.id, { group, choice });
  for (const id of choiceIds) {
    const found = groupOf.get(id);
    if (!found) return "optionUnknown";
    if (!found.choice.isAvailable) return "optionUnavailable";
  }
  for (const group of groups) {
    const chosen = group.choices.filter((choice) => choiceIds.includes(choice.id)).length;
    const { min, max } = choiceBounds(group);
    if (chosen > max) return "optionTooMany";
    if (chosen < min) return group.selection === "single" || min === 1 ? "optionRequired" : "optionTooFew";
  }
  return null;
}

/**
 * Fill in the defaults a request left out: a required single-choice group with no
 * choice gets its available default. Other groups are left as asked.
 */
export function withDefaultChoices(groups: readonly ProductOptionGroup[], choiceIds: readonly string[]): string[] {
  const filled = [...choiceIds];
  for (const group of groups) {
    if (group.selection !== "single" || !group.required) continue;
    if (group.choices.some((choice) => choiceIds.includes(choice.id))) continue;
    const fallback = group.choices.find((choice) => choice.isDefault && choice.isAvailable);
    if (fallback) filled.push(fallback.id);
  }
  return filled;
}

/**
 * The chosen options as a line keeps them, in the item's order (group, then
 * choice), whatever order they were asked in. Expects a selection
 * {@link optionSelectionProblem} passed.
 */
export function snapshotOptions(
  groups: readonly ProductOptionGroup[],
  choiceIds: readonly string[],
): OrderItemOption[] {
  const wanted = new Set(choiceIds);
  return groups.flatMap((group) =>
    group.choices
      .filter((choice) => wanted.has(choice.id))
      .map((choice) => ({
        groupId: group.id,
        group: group.name,
        ...(group.nameFa ? { groupFa: group.nameFa } : {}),
        choiceId: choice.id,
        choice: choice.name,
        ...(choice.nameFa ? { choiceFa: choice.nameFa } : {}),
        priceDelta: choice.priceDelta,
      })),
  );
}

/** What the options add to one unit, in Toman. */
export function optionsDelta(options: readonly Pick<OrderItemOption, "priceDelta">[]): number {
  return options.reduce((sum, option) => sum + option.priceDelta, 0);
}

/** What one unit costs with these choices: the item's price plus what each adds. */
export function priceWithChoices(
  product: { price: number; optionGroups?: readonly ProductOptionGroup[] },
  choiceIds: readonly string[],
): number {
  return product.price + optionsDelta(snapshotOptions(product.optionGroups ?? [], choiceIds));
}

/**
 * The least an item can be ordered for: its price plus the cheapest way to answer
 * its required groups, from choices that can be had now. What a menu card shows
 * after "from" when {@link optionsChangePrice}.
 */
export function lowestPrice(product: { price: number; optionGroups?: readonly ProductOptionGroup[] }): number {
  let extra = 0;
  for (const group of product.optionGroups ?? []) {
    const { min } = choiceBounds(group);
    if (min === 0) continue;
    const deltas = group.choices
      .filter((choice) => choice.isAvailable)
      .map((choice) => choice.priceDelta)
      .sort((a, b) => a - b);
    extra += deltas.slice(0, min).reduce((sum, delta) => sum + delta, 0);
  }
  return product.price + extra;
}

/** Whether any choice the item offers adds to its price — the menu then reads "from". */
export function optionsChangePrice(product: { optionGroups?: readonly ProductOptionGroup[] }): boolean {
  return (product.optionGroups ?? []).some((group) => group.choices.some((choice) => choice.priceDelta > 0));
}

/** Whether the item has options to choose — its quick add then sends the guest to its page. */
export function hasOptions(product: { optionGroups?: readonly ProductOptionGroup[] }): boolean {
  return (product.optionGroups ?? []).length > 0;
}

/**
 * One key for an item and its choices, whatever order they were picked in — two
 * basket lines with the same key are the same line.
 */
export function choiceKey(productId: string, choiceIds: readonly string[] = []): string {
  return [productId, ...[...choiceIds].sort()].join("|");
}

/**
 * The chosen options as one line of text in the reader's language — "Large, Oat
 * milk, Extra shot" — for a ticket, a receipt, an order's line.
 */
export function optionsSummary(options: readonly OrderItemOption[] | undefined, locale: string): string {
  return (options ?? []).map((option) => localizedName(option.choice, option.choiceFa, locale)).join(", ");
}

/**
 * Tidy groups for saving: names trimmed, a blank Persian name dropped, bounds that
 * don't apply to a group's kind reset (a single-choice group takes 0–1 or exactly 1;
 * an optional one has no least), and a default kept only where it means something —
 * a required single-choice group.
 */
export function normalizeOptionGroups(groups: readonly ProductOptionGroupInput[]): ProductOptionGroupInput[] {
  return groups.map((group) => {
    const single = group.selection === "single";
    const keepsDefault = single && group.required;
    return {
      ...(group.id ? { id: group.id } : {}),
      name: group.name.trim(),
      ...(group.nameFa?.trim() ? { nameFa: group.nameFa.trim() } : {}),
      required: group.required,
      selection: group.selection,
      minChoices: single ? (group.required ? 1 : 0) : group.required ? group.minChoices : 0,
      ...(single ? { maxChoices: 1 } : group.maxChoices !== undefined ? { maxChoices: group.maxChoices } : {}),
      choices: group.choices.map((choice) => ({
        ...(choice.id ? { id: choice.id } : {}),
        name: choice.name.trim(),
        ...(choice.nameFa?.trim() ? { nameFa: choice.nameFa.trim() } : {}),
        priceDelta: choice.priceDelta,
        isAvailable: choice.isAvailable,
        isDefault: keepsDefault && choice.isDefault,
      })),
    };
  });
}

/** Why an item's groups can't be saved (a `formErrors` key), or `null`. The domain's last guard behind the form's contract. */
export function optionGroupsProblem(groups: readonly ProductOptionGroupInput[]): string | null {
  if (groups.length > MAX_OPTION_GROUPS) return "optionGroupsTooMany";
  for (const group of groups) {
    if (!group.name.trim() || group.name.length > MAX_OPTION_NAME_LENGTH) return "optionNameRequired";
    if ((group.nameFa?.length ?? 0) > MAX_OPTION_NAME_LENGTH) return "optionNameTooLong";
    if (!(OPTION_SELECTIONS as readonly string[]).includes(group.selection)) return "optionSelectionInvalid";
    if (group.choices.length === 0) return "optionChoicesRequired";
    if (group.choices.length > MAX_OPTION_CHOICES) return "optionChoicesTooMany";
    const names = new Set<string>();
    for (const choice of group.choices) {
      if (!choice.name.trim() || choice.name.length > MAX_OPTION_NAME_LENGTH) return "optionNameRequired";
      if ((choice.nameFa?.length ?? 0) > MAX_OPTION_NAME_LENGTH) return "optionNameTooLong";
      if (!Number.isSafeInteger(choice.priceDelta) || choice.priceDelta < 0) return "optionPriceInvalid";
      const key = choice.name.trim().toLowerCase();
      if (names.has(key)) return "optionChoiceDuplicate";
      names.add(key);
    }
    if (group.choices.filter((choice) => choice.isDefault).length > 1) return "optionDefaultOne";
    if (group.selection === "multiple") {
      const max = group.maxChoices ?? group.choices.length;
      if (!Number.isInteger(group.minChoices) || group.minChoices < 0) return "optionMinInvalid";
      if (!Number.isInteger(max) || max < 1 || max > group.choices.length) return "optionMaxInvalid";
      if (group.required && (group.minChoices < 1 || group.minChoices > max)) return "optionMinInvalid";
    }
  }
  return null;
}
