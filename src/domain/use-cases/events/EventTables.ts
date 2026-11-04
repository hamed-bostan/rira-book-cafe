import { activityValue, type ActivityActor } from "../../entities/ActivityEntry";
import { activeFloor, inFloorOrder, isFloorTable } from "../../entities/CafeTable";
import { ConflictError } from "../../errors/ConflictError";
import { NotFoundError } from "../../errors/NotFoundError";
import { ValidationError } from "../../errors/ValidationError";
import { readFloor } from "../settings/CafeTableCommands";

import type { CafeEvent, EventTableOption } from "../../entities/CafeEvent";
import type { ICafeTableRepository } from "../../repositories/ICafeTableRepository";
import type { IEventRepository } from "../../repositories/IEventRepository";

/** Held tables as one activity-log value: "7, 8", or `null` for none. */
function tablesValue(labels: readonly string[]): string | null {
  return activityValue(labels.join(", "));
}

/** The floor as the "Hold tables" picker shows it for one event: the tables in use, in floor order. */
export class ListEventTableOptions {
  constructor(
    private readonly eventRepo: IEventRepository,
    private readonly tables: Pick<ICafeTableRepository, "listAll">,
  ) {}

  async execute(eventId: string): Promise<EventTableOption[]> {
    const options = await this.eventRepo.listTableOptions(eventId, await readFloor(this.tables));
    if (!options) throw new NotFoundError("event", eventId);
    return options;
  }
}

/**
 * Staff hold tables for an event so guests can't book them while it runs — or
 * release them (an empty list). Only an event that hasn't ended can change its
 * tables, and only tables in use can be newly held (one already held stays held
 * if it's since been taken out of use); the repository refuses one a booking or
 * another event has then.
 */
export class HoldEventTables {
  constructor(
    private readonly eventRepo: IEventRepository,
    private readonly tables: Pick<ICafeTableRepository, "listAll">,
  ) {}

  async execute(eventId: string, tableLabels: string[], actor: ActivityActor, now: Date): Promise<CafeEvent> {
    const existing = await this.eventRepo.getById(eventId);
    if (!existing) throw new NotFoundError("event", eventId);

    const allTables = await this.tables.listAll();
    const floor = activeFloor(allTables);
    const unknown = tableLabels.find(
      (label) => !isFloorTable(floor, label) && !(existing.tableLabels.includes(label) && hasTable(allTables, label)),
    );
    if (unknown !== undefined) throw new ValidationError("tableLabels", `There's no table "${unknown}".`);
    if (new Date(existing.endsAt) <= now) {
      throw new ConflictError("EVENT_CLOSED", "This event is over, so its tables can't change.");
    }

    // Floor order, with every table (in use or not) so a kept hold isn't dropped.
    const labels = inFloorOrder(allTables, tableLabels);
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

function hasTable(tables: readonly { label: string }[], label: string): boolean {
  return tables.some((table) => table.label === label);
}
