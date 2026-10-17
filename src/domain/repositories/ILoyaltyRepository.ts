import type { LoyaltySettings, LoyaltyTransaction } from "../entities/Loyalty";

/** A manual adjustment, attributed to the staff member who made it. */
export type PointsAdjustment = {
  userId: string;
  delta: number;
  note: string;
  by: { id: string; name: string };
};

export type ILoyaltyRepository = {
  getSettings(): Promise<LoyaltySettings>;
  saveSettings(settings: LoyaltySettings): Promise<LoyaltySettings>;
  balance(userId: string): Promise<number>;
  /** A guest's movements, newest first. */
  history(userId: string, limit: number): Promise<LoyaltyTransaction[]>;
  /**
   * Add or take away points by hand. Taking more than the guest has is refused
   * (`ConflictError("NOT_ENOUGH_POINTS")`) — checked under the guest's lock, with a
   * database trigger as the backstop.
   */
  adjust(adjustment: PointsAdjustment): Promise<LoyaltyTransaction>;
};
