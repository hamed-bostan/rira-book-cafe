export type Category = {
  id: string;
  name: string;
  slug: string;
  iconUrl: string;
  isActive: boolean;
  /** How many products currently reference this category. Derived, not stored. */
  productCount: number;
  createdAt: Date;
  updatedAt: Date;
}
