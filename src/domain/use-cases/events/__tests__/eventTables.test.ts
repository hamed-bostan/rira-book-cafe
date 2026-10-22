import { describe, expect, it, vi } from "vitest";

import { type ConflictError } from "../../../errors/ConflictError";
import { NotFoundError } from "../../../errors/NotFoundError";
import { ValidationError } from "../../../errors/ValidationError";
import { HoldEventTables, ListEventTableOptions } from "../EventTables";

import type { NewActivityEntry } from "../../../entities/ActivityEntry";
import type { CafeEvent } from "../../../entities/CafeEvent";
import type { IEventRepository } from "../../../repositories/IEventRepository";

const NOW = new Date("2026-10-22T08:00:00Z");
const ACTOR = { id: "a1", name: "Admin" };

function event(overrides: Partial<CafeEvent> = {}): CafeEvent {
  return {
    id: "e1",
    kind: "workshop",
    title: "Latte art workshop",
    startsAt: "2026-10-22T13:30:00.000Z",
    endsAt: "2026-10-22T15:30:00.000Z",
    capacity: 12,
    price: 250_000,
    isPublished: true,
    seatsTaken: 10,
    tableLabels: ["7"],
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

function repoWith(current: CafeEvent | null) {
  const entries: NewActivityEntry[] = [];
  const holdTables = vi.fn<IEventRepository["holdTables"]>(async (_id, tableLabels, audit) => {
    const saved = event({ ...current, tableLabels });
    const entry = audit?.(saved);
    if (entry) entries.push(entry);
    return saved;
  });
  const repo = {
    getById: vi.fn(async (id: string) => (current?.id === id ? current : null)),
    listTableOptions: vi.fn(async (id: string) => (current?.id === id ? [{ label: "7", seats: 6, held: true }] : null)),
    holdTables,
  } as unknown as IEventRepository;
  return { repo, holdTables, entries };
}

describe("HoldEventTables", () => {
  it("saves the tables in floor order without duplicates and logs the change", async () => {
    const { repo, holdTables, entries } = repoWith(event());

    const saved = await new HoldEventTables(repo).execute("e1", ["long", "8", "7", "8"], ACTOR, NOW);

    expect(holdTables.mock.calls[0][1]).toEqual(["7", "8", "long"]);
    expect(saved.tableLabels).toEqual(["7", "8", "long"]);
    expect(entries).toEqual([
      expect.objectContaining({
        action: "event.updated",
        entityId: "e1",
        changes: [{ field: "tableLabels", before: "7", after: "7, 8, long" }],
      }),
    ]);
  });

  it("releases every table with an empty list", async () => {
    const { repo, entries } = repoWith(event());

    await new HoldEventTables(repo).execute("e1", [], ACTOR, NOW);

    expect(entries[0].changes).toEqual([{ field: "tableLabels", before: "7", after: null }]);
  });

  it("skips the write when nothing changes", async () => {
    const { repo, holdTables } = repoWith(event());

    await new HoldEventTables(repo).execute("e1", ["7"], ACTOR, NOW);

    expect(holdTables).not.toHaveBeenCalled();
  });

  it("refuses a table that isn't on the floor plan", async () => {
    const { repo, holdTables } = repoWith(event());

    await expect(new HoldEventTables(repo).execute("e1", ["Table 7"], ACTOR, NOW)).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(holdTables).not.toHaveBeenCalled();
  });

  it("refuses an event that has already ended", async () => {
    const { repo } = repoWith(event({ endsAt: "2026-10-21T15:30:00.000Z" }));

    await expect(new HoldEventTables(repo).execute("e1", ["8"], ACTOR, NOW)).rejects.toMatchObject({
      code: "EVENT_CLOSED",
    } satisfies Partial<ConflictError>);
  });

  it("reports a missing event", async () => {
    const { repo } = repoWith(null);

    await expect(new HoldEventTables(repo).execute("e1", ["8"], ACTOR, NOW)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("ListEventTableOptions", () => {
  it("returns the floor for the event, or not found", async () => {
    const { repo } = repoWith(event());

    await expect(new ListEventTableOptions(repo).execute("e1")).resolves.toEqual([
      { label: "7", seats: 6, held: true },
    ]);
    await expect(new ListEventTableOptions(repo).execute("nope")).rejects.toBeInstanceOf(NotFoundError);
  });
});
