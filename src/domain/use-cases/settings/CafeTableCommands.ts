import { activityValue, diffFields, singleChange, type ActivityActor } from "../../entities/ActivityEntry";
import {
  MAX_CAFE_TABLES,
  MAX_CAFE_TABLE_LABEL_LENGTH,
  MAX_TABLE_AREA_LENGTH,
  MAX_TABLE_SEATS,
  MIN_TABLE_SEATS,
  activeFloor,
  isTableSeats,
  type CafeTable,
  type CafeTableMoveDirection,
  type FloorTable,
} from "../../entities/CafeTable";
import { NotFoundError } from "../../errors/NotFoundError";
import { ValidationError } from "../../errors/ValidationError";

import type { ICafeTableRepository, NewCafeTable } from "../../repositories/ICafeTableRepository";

/** The tables a booking can be seated at or an event can hold now, in floor order. */
export async function readFloor(tables: Pick<ICafeTableRepository, "listAll">): Promise<FloorTable[]> {
  return activeFloor(await tables.listAll());
}

/** A table as it will be stored: label and area trimmed, every rule re-checked. */
export function normalizeTable(input: NewCafeTable): NewCafeTable {
  const label = input.label.trim();
  if (!label) throw new ValidationError("label", "Give the table a label.");
  if (label.length > MAX_CAFE_TABLE_LABEL_LENGTH) throw new ValidationError("label", "That label is too long.");
  if (!isTableSeats(input.seats)) {
    throw new ValidationError("seats", `A table seats ${MIN_TABLE_SEATS} to ${MAX_TABLE_SEATS}.`);
  }
  const area = input.area?.trim() || undefined;
  if (area && area.length > MAX_TABLE_AREA_LENGTH) throw new ValidationError("area", "That's too long.");
  return { label, seats: input.seats, area, isActive: input.isActive };
}

function tableFields(table: NewCafeTable) {
  return { label: table.label, seats: table.seats, area: table.area, isActive: table.isActive };
}

/** Every table, in use or not, in floor order — the settings list. */
export class ListCafeTables {
  constructor(private readonly tables: Pick<ICafeTableRepository, "listAll">) {}

  execute(): Promise<CafeTable[]> {
    return this.tables.listAll();
  }
}

/** Add a table at the end of the floor. */
export class AddCafeTable {
  constructor(private readonly tables: ICafeTableRepository) {}

  async execute(input: NewCafeTable, actor: ActivityActor): Promise<CafeTable> {
    const table = normalizeTable(input);
    const existing = await this.tables.listAll();
    if (existing.length >= MAX_CAFE_TABLES) {
      throw new ValidationError("label", `A floor can have up to ${MAX_CAFE_TABLES} tables.`);
    }
    return this.tables.create(table, (saved) => ({
      actorId: actor.id,
      actorName: actor.name,
      action: "settings.tableAdded",
      entityType: "settings",
      entityId: saved.id,
      entityLabel: saved.label,
      changes: diffFields({}, tableFields(saved)),
    }));
  }
}

/**
 * Change a table: its label, seats, area, or whether it's in use. Taking it out of
 * use leaves it on any booking it already has — staff move those as they see fit —
 * but no new booking or event hold can take it. A new label follows it onto its
 * bookings and event holds (the repository carries it over).
 */
export class EditCafeTable {
  constructor(private readonly tables: ICafeTableRepository) {}

  async execute(id: string, input: NewCafeTable, actor: ActivityActor): Promise<CafeTable> {
    const next = normalizeTable(input);
    const current = await this.tables.getById(id);
    if (!current) throw new NotFoundError("table", id);
    const changes = diffFields(tableFields(current), tableFields(next));
    if (changes.length === 0) return current;

    return this.tables.update(id, next, (saved) => ({
      actorId: actor.id,
      actorName: actor.name,
      action: "settings.tableChanged",
      entityType: "settings",
      entityId: saved.id,
      entityLabel: saved.label,
      changes,
    }));
  }
}

/** Move a table one place along the floor order — the order pickers list tables in. */
export class MoveCafeTable {
  constructor(private readonly tables: ICafeTableRepository) {}

  async execute(id: string, direction: CafeTableMoveDirection, actor: ActivityActor): Promise<void> {
    const all = await this.tables.listAll();
    const from = all.findIndex((table) => table.id === id);
    if (from < 0) throw new NotFoundError("table", id);
    const to = direction === "up" ? from - 1 : from + 1;
    if (to < 0 || to >= all.length) {
      throw new ValidationError("direction", `Table ${all[from].label} is already ${to < 0 ? "first" : "last"}.`);
    }

    const ids = all.map((table) => table.id);
    [ids[from], ids[to]] = [ids[to], ids[from]];
    const moved = all[from];
    await this.tables.setOrder(ids, () => ({
      actorId: actor.id,
      actorName: actor.name,
      action: "settings.tableChanged",
      entityType: "settings",
      entityId: moved.id,
      entityLabel: moved.label,
      changes: singleChange("floorOrder", from + 1, to + 1),
    }));
  }
}

/**
 * Remove a table for good. Refused while an open order is at it or a booking or
 * event still holds it ahead — taking it out of use is the way then. Past bookings
 * keep the label they were made with.
 */
export class RemoveCafeTable {
  constructor(private readonly tables: ICafeTableRepository) {}

  async execute(id: string, actor: ActivityActor, now: Date): Promise<void> {
    const current = await this.tables.getById(id);
    if (!current) throw new NotFoundError("table", id);
    await this.tables.delete(id, now, (removed) => ({
      actorId: actor.id,
      actorName: actor.name,
      action: "settings.tableRemoved",
      entityType: "settings",
      entityId: removed.id,
      entityLabel: removed.label,
      changes: Object.entries(tableFields(removed))
        .map(([field, value]) => ({ field, before: activityValue(value), after: null }))
        .filter((change) => change.before !== null),
    }));
  }
}
