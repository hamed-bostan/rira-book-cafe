import type { IImageReferences } from "@/src/domain/repositories/IImageReferences";
import { prisma } from "@/src/infrastructure/prisma/client";
import type { PrismaDb } from "@/src/infrastructure/prisma/transaction";

/**
 * Looks for an image URL in every column that stores one: menu items, the order
 * lines that snapshot an item's picture, categories, events and profile pictures.
 * One `EXISTS` per table, stopped at the first hit.
 */
export class PrismaImageReferences implements IImageReferences {
  constructor(private readonly db: PrismaDb = prisma) {}

  async isReferenced(url: string): Promise<boolean> {
    const checks = [
      () => this.db.product.findFirst({ where: { imageUrl: url }, select: { id: true } }),
      () => this.db.orderItem.findFirst({ where: { imageUrl: url }, select: { id: true } }),
      () => this.db.category.findFirst({ where: { iconUrl: url }, select: { id: true } }),
      () => this.db.event.findFirst({ where: { imageUrl: url }, select: { id: true } }),
      () => this.db.user.findFirst({ where: { avatarUrl: url }, select: { id: true } }),
    ];
    for (const check of checks) {
      if (await check()) return true;
    }
    return false;
  }
}
