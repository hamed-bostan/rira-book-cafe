import { activityValue, type ActivityActor } from "../../entities/ActivityEntry";
import { inFloorOrder, isCafeTable } from "../../entities/CafeTable";
import { ConflictError } from "../../errors/ConflictError";
import { NotFoundError } from "../../errors/NotFoundError";
import { ValidationError } from "../../errors/ValidationError";

import type { CafeEvent, EventTableOption } from "../../entities/CafeEvent";
import type { IEventRepository } from "../../repositories/IEventRepository";

/** Held tables as one activity-log value: "7, 8", or `null` for none. */
function tablesValue(labels: readonly string[]): string | null {
  return activityValue(labels.join(", "));
}

/** The floor as the "Hold tables" picker shows it for one event. */
export class ListEventTableOptions {
  constructor(private readonly eventRepo: IEventRepository) {}

  async execute(eventId: string): Promise<EventTableOption[]> {
    const options = await this.eventRepo.listTableOptions(eventId);
    if (!options) throw new NotFoundError("event", eventId);
    return options;
  }
}

/**
 * Staff hold tables for an event so guests can't book them while it runs — or
 * release them (an empty list). Only an event that hasn't ended can change its
 * tables; the repository refuses one a booking or another event has then.
 */
export class HoldEventTables {
  constructor(private readonly eventRepo: IEventRepository) {}

  async execute(eventId: string, tableLabels: string[], actor: ActivityActor, now: Date): Promise<CafeEvent> {
    const unknown = tableLabels.find((label) => !isCafeTable(label));
    if (unknown !== undefined) throw new ValidationError("tableLabels", `There's no table "${unknown}".`);

    const existing = await this.eventRepo.getById(eventId);
    if (!existing) throw new NotFoundError("event", eventId);
    if (new Date(existing.endsAt) <= now) {
      throw new ConflictError("EVENT_CLOSED", "This event is over, so its tables can't change.");
    }

    const labels = inFloorOrder(tableLabels);
    if (labels.join() === existing.tableLabels.join()) return existing;

    return this.eventRepo.holdTables(eventId, labels, (saved) => ({
      actorId: actor.id,
      actorName: actor.name,
      action: "event.updated",
      entityType: "event",
      entityId: saved.id,
      entityLabel: saved.title,
      changes: [
        { field: "tableLabels", before: tablesValue(existing.tableLabels), after: tablesValue(saved.tableLabels) },
      ],
    }));
  }
}
