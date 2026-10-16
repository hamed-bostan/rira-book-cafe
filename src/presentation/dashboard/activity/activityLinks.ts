import type { ActivityAction, ActivityEntityType } from "@/src/domain/entities/ActivityEntry";

/**
 * Where an entry's entity can be opened in the dashboard, or `null` when it can't.
 *
 * Two reasons an entry has no link, and they're different:
 *   - the entity has no detail route (a review lives in the moderation queue, a
 *     person on the team page — neither addressable by id);
 *   - the entity is *gone*. A `product.deleted` entry pointing at an edit form
 *     that 404s is worse than plain text: it invites a click that ends on an error
 *     page, and the entry is precisely the record that the thing no longer exists.
 */
export function activityEntityHref(
  entityType: ActivityEntityType,
  entityId: string,
  action: ActivityAction,
): string | null {
  if (action === "product.deleted" || action === "category.deleted") return null;

  switch (entityType) {
    case "product":
      return `/dashboard/products/${entityId}/edit`;
    case "order":
      return `/dashboard/orders/${entityId}`;
    case "category":
      return `/dashboard/categories/${entityId}/edit`;
    default:
      return null;
  }
}
