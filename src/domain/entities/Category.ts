export type Category = {
  id: string;
  name: string;
  slug: string;
  iconUrl: string;
  isActive: boolean;
  /** How many products currently reference this category. Derived, not stored. */
  productCount: number;
  /** How many of those are hidden from the menu (unpublished). Derived, not stored. */
  hiddenProductCount: number;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Which way a category moves on the menu: `up` shows it one place earlier,
 * `down` one place later. The dashboard's up/down buttons send these.
 */
export const CATEGORY_MOVE_DIRECTIONS = ["up", "down"] as const;
export type CategoryMoveDirection = (typeof CATEGORY_MOVE_DIRECTIONS)[number];
