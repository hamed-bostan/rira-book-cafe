import { describe, expect, it, vi } from "vitest";

import { ConflictError } from "../../../errors/ConflictError";
import { NotFoundError } from "../../../errors/NotFoundError";
import { CancelEvent } from "../CancelEvent";
import { CancelRegistrationAsStaff } from "../EventRegistrations";
import { UpdateEvent } from "../SaveEvent";

import type { NewActivityEntry } from "../../../entities/ActivityEntry";
import type { CafeEvent, EventRegistration } from "../../../entities/CafeEvent";
import type { IEventRepository, NewCafeEvent } from "../../../repositories/IEventRepository";
import type { ICustomerNotifier } from "../../../repositories/INotificationRepository";

const NOW = new Date("2026-10-20T10:00:00Z");
const ACTOR = { id: "a1", name: "Admin" };
const SAVED_AT = "2026-10-20T10:00:01.000Z";

const INPUT: NewCafeEvent = {
  kind: "reading",
  title: "Poetry night",
  startsAt: "2026-10-25T15:30:00.000Z",
  endsAt: "2026-10-25T17:30:00.000Z",
  capacity: 20,
  price: 0,
  isPublished: true,
};

function event(overrides: Partial<CafeEvent> = {}): CafeEvent {
  return { ...INPUT, id: "e1", seatsTaken: 3, tableLabels: [], createdAt: "", updatedAt: "", ...overrides };
}

function registration(id: string, overrides: Partial<EventRegistration> = {}): EventRegistration {
  return {
    id,
    eventId: "e1",
    userId: `0912000000${id.length}`,
    guestName: `Guest ${id}`,
    guestPhone: `0912 000 000${id.length}`,
    seats: 1,
    status: "registered",
    createdAt: "",
    ...overrides,
  };
}

const SIGNED_UP = [registration("a"), registration("bb", { seats: 2 }), registration("ccc", { status: "cancelled" })];

/** An event store whose writes run the audit hook the way the real one does. */
function setup(current: CafeEvent | null) {
  const entries: (NewActivityEntry | null)[] = [];
  const repo = {
    getById: vi.fn(async () => current),
    update: vi.fn<IEventRepository["update"]>(async (id, input, audit) => {
      const saved = event({ ...current, ...input, id, updatedAt: SAVED_AT });
      if (audit) entries.push(audit(saved));
      return saved;
    }),
    listRegistrations: vi.fn(async () => SIGNED_UP),
    getRegistration: vi.fn(async (id: string) => SIGNED_UP.find((one) => one.id === id) ?? null),
    cancelRegistration: vi.fn<IEventRepository["cancelRegistration"]>(async (id, audit) => {
      const saved = { ...(SIGNED_UP.find((one) => one.id === id) as EventRegistration), status: "cancelled" as const };
      if (audit) entries.push(audit(saved));
      return saved;
    }),
    cancelEvent: vi.fn<IEventRepository["cancelEvent"]>(async (_id, audit) => {
      const result = {
        event: event({ ...current, isPublished: false, seatsTaken: 0, updatedAt: SAVED_AT }),
        cancelled: SIGNED_UP.filter((one) => one.status === "registered").map((one) => ({
          ...one,
          status: "cancelled" as const,
        })),
      };
      if (audit) entries.push(audit(result));
      return result;
    }),
  };
  const notifier = { notify: vi.fn<ICustomerNotifier["notify"]>(async () => undefined) };
  return { repo: repo as unknown as IEventRepository, mocks: repo, notifier, entries };
}

describe("UpdateEvent telling guests", () => {
  it("tells every guest still signed up that the event moved", async () => {
    const { repo, notifier } = setup(event());
    await new UpdateEvent(repo, notifier).execute(
      "e1",
      { ...INPUT, startsAt: "2026-10-26T15:30:00.000Z", endsAt: "2026-10-26T17:30:00.000Z" },
      ACTOR,
    );

    expect(notifier.notify).toHaveBeenCalledTimes(2);
    expect(notifier.notify.mock.calls.map(([notice]) => [notice.kind, notice.userId, notice.dedupeKey])).toEqual([
      ["eventMoved", "09120000001", `event:e1:moved:${SAVED_AT}:a`],
      ["eventMoved", "09120000002", `event:e1:moved:${SAVED_AT}:bb`],
    ]);
  });

  it("tells them it's off when it's unpublished", async () => {
    const { repo, notifier } = setup(event());
    await new UpdateEvent(repo, notifier).execute("e1", { ...INPUT, isPublished: false }, ACTOR);
    expect(notifier.notify.mock.calls.map(([notice]) => notice.kind)).toEqual(["eventOff", "eventOff"]);
  });

  it("tells nobody about any other edit", async () => {
    const { repo, mocks, notifier } = setup(event());
    await new UpdateEvent(repo, notifier).execute(
      "e1",
      { ...INPUT, price: 50_000, description: "Bring a poem" },
      ACTOR,
    );
    expect(notifier.notify).not.toHaveBeenCalled();
    expect(mocks.listRegistrations).not.toHaveBeenCalled();
  });
});

describe("CancelRegistrationAsStaff telling the guest", () => {
  it("tells the guest whose sign-up was cancelled", async () => {
    const { repo, notifier } = setup(event());
    await new CancelRegistrationAsStaff(repo, notifier).execute("e1", "bb", ACTOR);
    expect(notifier.notify).toHaveBeenCalledOnce();
    expect(notifier.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "eventRegistrationCancelled",
        userId: "09120000002",
        dedupeKey: "registration:bb:cancelled",
      }),
    );
  });

  it("tells nobody about a sign-up that was already cancelled", async () => {
    const { repo, notifier } = setup(event());
    await new CancelRegistrationAsStaff(repo, notifier).execute("e1", "ccc", ACTOR);
    expect(notifier.notify).not.toHaveBeenCalled();
  });
});

describe("CancelEvent", () => {
  it("cancels every sign-up, unpublishes it, logs it once and tells each guest", async () => {
    const { repo, notifier, entries } = setup(event());
    const saved = await new CancelEvent(repo, notifier).execute("e1", ACTOR, NOW);

    expect(saved).toMatchObject({ isPublished: false, seatsTaken: 0 });
    expect(entries).toEqual([
      {
        actorId: "a1",
        actorName: "Admin",
        action: "event.cancelled",
        entityType: "event",
        entityId: "e1",
        entityLabel: "Poetry night",
        changes: [
          { field: "isPublished", before: "true", after: "false" },
          { field: "registrations", before: "Guest a (1), Guest bb (2)", after: null },
        ],
      },
    ]);
    expect(notifier.notify.mock.calls.map(([notice]) => [notice.kind, notice.userId, notice.dedupeKey])).toEqual([
      ["eventCancelled", "09120000001", "registration:a:cancelled"],
      ["eventCancelled", "09120000002", "registration:bb:cancelled"],
    ]);
  });

  it("refuses an event that's over, and one that doesn't exist", async () => {
    const over = setup(event({ endsAt: "2026-10-20T09:59:00.000Z" }));
    await expect(new CancelEvent(over.repo, over.notifier).execute("e1", ACTOR, NOW)).rejects.toThrow(ConflictError);
    expect(over.mocks.cancelEvent).not.toHaveBeenCalled();

    const gone = setup(null);
    await expect(new CancelEvent(gone.repo).execute("e1", ACTOR, NOW)).rejects.toThrow(NotFoundError);
  });
});
