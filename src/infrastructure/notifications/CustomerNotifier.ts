import type { NewNotification } from "@/src/domain/entities/Notification";
import type { ICustomerNotifier, INotificationRepository } from "@/src/domain/repositories/INotificationRepository";

/**
 * Delivers guest notifications to their account inbox. Best-effort by contract
 * (see {@link ICustomerNotifier}): the change that triggered it has already
 * committed, so a failure here is logged and swallowed rather than turning a
 * successful request into an error.
 */
export class CustomerNotifier implements ICustomerNotifier {
  constructor(private readonly notifications: INotificationRepository) {}

  async notify(input: NewNotification): Promise<void> {
    try {
      await this.notifications.create(input);
    } catch (error) {
      console.error(`Couldn't deliver the ${input.kind} notification to ${input.userId}:`, error);
    }
  }
}
