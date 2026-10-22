import { diffFields, type ActivityActor } from "../../entities/ActivityEntry";
import {
  EVENT_KINDS,
  MAX_EVENT_DESCRIPTION_LENGTH,
  MAX_EVENT_TITLE_LENGTH,
  type CafeEvent,
} from "../../entities/CafeEvent";
import { NotFoundError } from "../../errors/NotFoundError";
import { ValidationError } from "../../errors/ValidationError";

import type { IEventRepository, NewCafeEvent } from "../../repositories/IEventRepository";

/** The fields of an event the activity log tracks. */
function eventSnapshot(event: CafeEvent | NewCafeEvent): Record<string, unknown> {
  return {
    kind: event.kind,
    title: event.title,
    titleFa: event.titleFa,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    capacity: event.capacity,
    price: event.price,
    isPublished: event.isPublished,
    imageUrl: event.imageUrl,
    description: event.description,
    descriptionFa: event.descriptionFa,
    // Saving a new time can release held tables that clash then.
    tableLabels: "tableLabels" in event ? event.tableLabels.join(", ") : undefined,
  };
}

/** Last-resort domain guard behind the form's schema; returns the input with text trimmed. */
function validateEvent(input: NewCafeEvent): NewCafeEvent {
  const title = input.title.trim();
  if (!title) throw new ValidationError("title", "A title is required.");
  if (title.length > MAX_EVENT_TITLE_LENGTH) throw new ValidationError("title", "That title is too long.");
  if (!EVENT_KINDS.includes(input.kind)) throw new ValidationError("kind", "Choose a kind of event.");
  if ((input.description?.length ?? 0) > MAX_EVENT_DESCRIPTION_LENGTH) {
    throw new ValidationError("description", "That description is too long.");
  }
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  if (Number.isNaN(startsAt.getTime())) throw new ValidationError("startsAt", "Choose a start time.");
  if (Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
    throw new ValidationError("endsAt", "The event must end after it starts.");
  }
  if (input.capacity !== undefined && (!Number.isInteger(input.capacity) || input.capacity < 1)) {
    throw new ValidationError("capacity", "Capacity must be a whole number of 1 or more.");
  }
  if (!Number.isInteger(input.price) || input.price < 0) {
    throw new ValidationError("price", "Price must be a whole number of 0 or more.");
  }
  return { ...input, title, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() };
}

export class CreateEvent {
  constructor(private readonly eventRepo: IEventRepository) {}

  async execute(input: NewCafeEvent, actor: ActivityActor): Promise<CafeEvent> {
    return this.eventRepo.create(validateEvent(input), (created) => ({
      actorId: actor.id,
      actorName: actor.name,
      action: "event.created",
      entityType: "event",
      entityId: created.id,
      entityLabel: created.title,
      changes: diffFields({}, eventSnapshot(created)).filter((change) => change.after !== null),
    }));
  }
}

export class UpdateEvent {
  constructor(private readonly eventRepo: IEventRepository) {}

  async execute(id: string, input: NewCafeEvent, actor: ActivityActor): Promise<CafeEvent> {
    const valid = validateEvent(input);
    const existing = await this.eventRepo.getById(id);
    if (!existing) throw new NotFoundError("event", id);
    // Lowering capacity below the seats already taken would strand guests who
    // already signed up; cancel registrations first.
    if (valid.capacity !== undefined && valid.capacity < existing.seatsTaken) {
      throw new ValidationError("capacity", `${existing.seatsTaken} seats are already taken.`);
    }

    return this.eventRepo.update(id, valid, (saved) => {
      const changes = diffFields(eventSnapshot(existing), eventSnapshot(saved));
      if (changes.length === 0) return null;
      return {
        actorId: actor.id,
        actorName: actor.name,
        action: "event.updated",
        entityType: "event",
        entityId: saved.id,
        entityLabel: saved.title,
        changes,
      };
    });
  }
}

export class DeleteEvent {
  constructor(private readonly eventRepo: IEventRepository) {}

  async execute(id: string, actor: ActivityActor): Promise<void> {
    const existing = await this.eventRepo.getById(id);
    if (!existing) throw new NotFoundError("event", id);

    await this.eventRepo.delete(id, () => ({
      actorId: actor.id,
      actorName: actor.name,
      action: "event.deleted",
      entityType: "event",
      entityId: id,
      entityLabel: existing.title,
      changes: diffFields(eventSnapshot(existing), {}).filter((change) => change.before !== null),
    }));
  }
}
