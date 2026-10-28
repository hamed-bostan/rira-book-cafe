import type { Product } from "../../entities/Product";
import type { NewProduct } from "../../repositories/IProductRepository";

/**
 * The fields of a product the activity log tracks, flattened for diffing.
 *
 * A deliberate subset, not the whole entity. `rating`/`ratingCount` move on their
 * own as customers review the product — recording them here would fill an admin
 * audit log with events no admin caused. `discountPercent` is derived from the two
 * prices, so it would report every price change twice. `images` is a gallery whose
 * "before" is a list of URLs nobody can read as a value.
 *
 * What's left is what someone asks about after the fact: what did this cost, how
 * many did we have, what was it called, which category was it in.
 *
 * Shared by `UpdateProduct` (both sides of a save) and `DeleteProduct` (the state
 * a product was in when it went), so the two describe a product the same way.
 */
export function productSnapshot(product: Product | NewProduct): Record<string, unknown> {
  return {
    name: product.name,
    price: product.price,
    originalPrice: product.originalPrice,
    costPrice: product.costPrice,
    stockQuantity: product.stockQuantity,
    madeToOrder: product.madeToOrder,
    categoryId: product.categoryId,
    isFeatured: product.isFeatured,
    isPublished: product.isPublished,
    badge: product.badge,
    kind: product.kind,
    unit: product.unit,
    bookAuthor: product.book?.author,
    bookIsbn: product.book?.isbn,
    bookAvailability: product.book?.availability,
    imageUrl: product.imageUrl,
    description: product.description,
    nutrition: product.nutrition,
    origin: product.origin,
    // Joined rather than left an array: `activityValue` renders any value with
    // `String()`, which would give the same result less explicitly.
    dietary: product.dietary?.join(", "),
  };
}
