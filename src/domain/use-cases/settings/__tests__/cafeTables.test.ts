import { describe, expect, it, vi } from "vitest";

import { MAX_CAFE_TABLES, type CafeTable } from "../../../entities/CafeTable";
import { NotFoundError } from "../../../errors/NotFoundError";
import { ValidationError } from "../../../errors/ValidationError";
import {
  AddCafeTable,
  EditCafeTable,
  ListCafeTables,
  MoveCafeTable,
  RemoveCafeTable,
  normalizeTable,
  readFloor,
} from "../CafeTableCommands";

import type { NewActivityEntry } from "../../../entities/ActivityEntry";
import type { ICafeTableRepository } from "../../../repositories/ICafeTableRepository";

const ACTOR = { id: "a1", name: "Admin" };
const NOW = new Date("2026-11-04T10:00:00Z");

function table(overrides: Partial<CafeTable> = {}): CafeTable {
  return { id: "t1", label: "1", seats: 2, isActive: true, position: 0, ...overrides };
}

const FLOOR = [
  table(),
  table({ id: "t2", label: "2", seats: 4, position: 1, area: "Window" }),
  table({ id: "t3", label: "3", seats: 6, position: 2, isActive: false }),
];

/** A table store over `tables`; every write runs its audit hook and records the entry. */
function store(tables: CafeTable[] = FLOOR) {
  const entries: NewActivityEntry[] = [];
  const record = (entry: NewActivityEntry | null): void => {
    if (entry) entries.push(entry);
  };
  const repo = {
    listAll: vi.fn(async () => tables),
    getById: vi.fn(async (id: string) => tables.find((candidate) => candidate.id === id) ?? null),
    create: vi.fn<ICafeTableRepository["create"]>(async (input, audit) => {
      const saved = { ...input, id: "new", position: tables.length };
      record(audit?.(saved) ?? null);
      return saved;
    }),
    update: vi.fn<ICafeTableRepository["update"]>(async (id, input, audit) => {
      const saved = { ...tables.find((candidate) => candidate.id === id)!, ...input };
      record(audit?.(saved) ?? null);
      return saved;
    }),
    setOrder: vi.fn<ICafeTableRepository["setOrder"]>(async (_ids, audit) => {
      record(audit?.() ?? null);
    }),
    delete: vi.fn<ICafeTableRepository["delete"]>(async (id, _now, audit) => {
      record(audit?.(tables.find((candidate) => candidate.id === id)!) ?? null);
    }),
  } satisfies ICafeTableRepository;
  return { repo, entries };
}

describe("readFloor", () => {
  it("is the tables in use, in floor order", async () => {
    const { repo } = store();
    expect(await readFloor(repo)).toEqual([
      { label: "1", seats: 2 },
      { label: "2", seats: 4, area: "Window" },
    ]);
    expect(await new ListCafeTables(repo).execute()).toHaveLength(3);
  });
});

describe("normalizeTable", () => {
  it("trims the label and area, and checks the seats", () => {
    expect(normalizeTable({ label: " 9 ", seats: 4, area: " ", isActive: true })).toEqual({
      label: "9",
      seats: 4,
      area: undefined,
      isActive: true,
    });
    expect(() => normalizeTable({ label: " ", seats: 4, isActive: true })).toThrow(ValidationError);
    expect(() => normalizeTable({ label: "x".repeat(21), seats: 4, isActive: true })).toThrow(ValidationError);
    expect(() => normalizeTable({ label: "9", seats: 0, isActive: true })).toThrow(ValidationError);
    expect(() => normalizeTable({ label: "9", seats: 4, area: "x".repeat(41), isActive: true })).toThrow(
      ValidationError,
    );
  });
});

describe("AddCafeTable", () => {
  it("adds the table and logs what it is", async () => {
    const { repo, entries } = store();

    const saved = await new AddCafeTable(repo).execute({ label: "Bar", seats: 3, isActive: true }, ACTOR);

    expect(saved.label).toBe("Bar");
    expect(entries).toEqual([
      expect.objectContaining({
        action: "settings.tableAdded",
        entityType: "settings",
        entityId: "new",
        entityLabel: "Bar",
        changes: [
          { field: "label", before: null, after: "Bar" },
          { field: "seats", before: null, after: "3" },
          { field: "isActive", before: null, after: "true" },
        ],
      }),
    ]);
  });

  it("refuses a table past the floor's limit", async () => {
    const full = Array.from({ length: MAX_CAFE_TABLES }, (_, index) =>
      table({ id: `t${index}`, label: String(index), position: index }),
    );
    const { repo } = store(full);
    await expect(
      new AddCafeTable(repo).execute({ label: "one more", seats: 2, isActive: true }, ACTOR),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(repo.create).not.toHaveBeenCalled();
  });
});

describe("EditCafeTable", () => {
  it("saves what changed and logs it", async () => {
    const { repo, entries } = store();

    await new EditCafeTable(repo).execute("t2", { label: "2", seats: 6, area: "Window", isActive: false }, ACTOR);

    expect(entries[0]).toMatchObject({ action: "settings.tableChanged", entityId: "t2", entityLabel: "2" });
    expect(entries[0].changes).toEqual([
      { field: "seats", before: "4", after: "6" },
      { field: "isActive", before: "true", after: "false" },
    ]);
  });

  it("skips the write when nothing changed, and reports an unknown table", async () => {
    const { repo } = store();
    await new EditCafeTable(repo).execute("t2", { label: "2", seats: 4, area: "Window", isActive: true }, ACTOR);
    expect(repo.update).not.toHaveBeenCalled();
    await expect(
      new EditCafeTable(repo).execute("nope", { label: "2", seats: 4, isActive: true }, ACTOR),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("MoveCafeTable", () => {
  it("swaps the table with its neighbour and logs its new place", async () => {
    const { repo, entries } = store();

    await new MoveCafeTable(repo).execute("t2", "up", ACTOR);

    expect(repo.setOrder.mock.calls[0][0]).toEqual(["t2", "t1", "t3"]);
    expect(entries[0].changes).toEqual([{ field: "floorOrder", before: "2", after: "1" }]);
  });

  it("refuses to move past either end", async () => {
    const { repo } = store();
    await expect(new MoveCafeTable(repo).execute("t1", "up", ACTOR)).rejects.toBeInstanceOf(ValidationError);
    await expect(new MoveCafeTable(repo).execute("t3", "down", ACTOR)).rejects.toBeInstanceOf(ValidationError);
    await expect(new MoveCafeTable(repo).execute("nope", "down", ACTOR)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("RemoveCafeTable", () => {
  it("removes the table and logs what it was", async () => {
    const { repo, entries } = store();

    await new RemoveCafeTable(repo).execute("t2", ACTOR, NOW);

    expect(repo.delete.mock.calls[0][1]).toBe(NOW);
    expect(entries[0]).toMatchObject({ action: "settings.tableRemoved", entityLabel: "2" });
    expect(entries[0].changes).toEqual([
      { field: "label", before: "2", after: null },
      { field: "seats", before: "4", after: null },
      { field: "area", before: "Window", after: null },
      { field: "isActive", before: "true", after: null },
    ]);
  });

  it("reports an unknown table", async () => {
    const { repo } = store();
    await expect(new RemoveCafeTable(repo).execute("nope", ACTOR, NOW)).rejects.toBeInstanceOf(NotFoundError);
  });
});
