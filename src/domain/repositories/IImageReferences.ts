/**
 * Whether anything stored still points at an image URL — the check that stands
 * between "this product stopped using its picture" and deleting the file.
 *
 * A product's picture is not the product's alone: every order line snapshots the
 * item's image when it's placed, so the receipts and order history of a sold item
 * keep showing it long after the item moved on to a new photo (or was deleted).
 * Deleting the file then would leave those pages with a broken image. So a file
 * is only reclaimed once nothing at all refers to it.
 */
export type IImageReferences = {
  /** `true` while any stored row (an item, an order line, a category, an event, a profile) uses `url`. */
  isReferenced(url: string): Promise<boolean>;
};
