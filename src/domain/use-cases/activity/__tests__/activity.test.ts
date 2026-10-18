import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_ACTIVITY_LIMIT,
  MAX_ACTIVITY_LIMIT,
  activityValue,
  changedFields,
  clampActivityLimit,
  diffFields,
  singleChange,
  toActivityAction,
  toActivityEntityType,
  type ActivityEntry,
} from "../../../entities/ActivityEntry";
import { GetEntityActivity } from "../GetEntityActivity";
import { ListActivity } from "../ListActivity";
import { ListActivityActors } from "../ListActivityActors";

import type { IActivityLog } from "../../../repositories/IActivityLog";

const ENTRY: ActivityEntry = {
  id: "e1",
  actorId: "a1",
  actorName: "Admin",
  action: "product.updated",
  entityType: "product",
  entityId: "p1",
  changes: [],
  at: new Date(0),
};

type Fake = {
  log: IActivityLog;
  list: ReturnType<typeof vi.fn<IActivityLog["list"]>>;
  listForEntity: ReturnType<typeof vi.fn<IActivityLog["listForEntity"]>>;
  listActors: ReturnType<typeof vi.fn<IActivityLog["listActors"]>>;
};

function activityLog(): Fake {
  const list = vi.fn<IActivityLog["list"]>(async (_filters, page) => ({
    items: [ENTRY],
    total: 1,
    page: page.page,
    pageSize: page.pageSize,
  }));
  const listForEntity = vi.fn<IActivityLog["listForEntity"]>(async () => [ENTRY]);
  const listActors = vi.fn<IActivityLog["listActors"]>(async () => [{ id: "a1", name: "Admin" }]);
  return {
    log: { list, listForEntity, listActors, recordEvent: vi.fn(async () => {}) },
    list,
    listForEntity,
    listActors,
  };
}

const PAGE = { page: 1, pageSize: 25 };

describe("ListActivity", () => {
  it("keeps an entity id that comes with its type, trimmed", async () => {
    const { log, list } = activityLog();
    await new ListActivity(log).execute({ entityType: "order", entityId: "  o1 ", actorId: "a1" }, PAGE);
    expect(list).toHaveBeenCalledWith({ entityType: "order", entityId: "o1", actorId: "a1" }, PAGE);
  });

  it("drops an entity id without a type, and a blank one", async () => {
    const { log, list } = activityLog();
    await new ListActivity(log).execute({ entityId: "o1" }, PAGE);
    await new ListActivity(log).execute({ entityType: "order", entityId: "   " }, PAGE);
    expect(list.mock.calls.map(([filters]) => filters.entityId)).toEqual([undefined, undefined]);
  });
});

describe("GetEntityActivity", () => {
  it.each<[number | undefined, number]>([
    [undefined, DEFAULT_ACTIVITY_LIMIT],
    [5.7, 5],
    [0, 1],
    [10_000, MAX_ACTIVITY_LIMIT],
    [Number.NaN, DEFAULT_ACTIVITY_LIMIT],
  ])("clamps a limit of %s to %s", async (limit, expected) => {
    const { log, listForEntity } = activityLog();
    expect(await new GetEntityActivity(log).execute("product", "p1", limit)).toEqual([ENTRY]);
    expect(listForEntity).toHaveBeenCalledWith("product", "p1", expected);
  });
});

describe("ListActivityActors", () => {
  it("passes the viewer's visible types through", async () => {
    const { log, listActors } = activityLog();
    expect(await new ListActivityActors(log).execute(["product", "order"])).toEqual([{ id: "a1", name: "Admin" }]);
    expect(listActors).toHaveBeenCalledWith(["product", "order"]);
  });
});

describe("ActivityEntry helpers", () => {
  it("narrows stored strings, falling back to unknown", () => {
    expect(toActivityAction("order.stageChanged")).toBe("order.stageChanged");
    expect(toActivityAction("order.teleported")).toBe("unknown");
    expect(toActivityEntityType("expense")).toBe("expense");
    expect(toActivityEntityType("spaceship")).toBe("unknown");
    expect(clampActivityLimit(50)).toBe(50);
  });

  it("renders values for a diff", () => {
    expect(activityValue(undefined)).toBeNull();
    expect(activityValue("  ")).toBeNull();
    expect(activityValue(false)).toBe("false");
    expect(activityValue(new Date(0))).toBe("1970-01-01T00:00:00.000Z");
    expect(activityValue({ a: 1 })).toBe(JSON.stringify({ a: 1 }));
    expect(activityValue(12)).toBe("12");
  });

  it("diffs only the fields that moved and lists their names once", () => {
    const changes = diffFields({ name: "A", price: 1, note: "" }, { name: "B", price: 1, note: undefined });
    expect(changes).toEqual([{ field: "name", before: "A", after: "B" }]);
    expect(singleChange("role", "staff", "admin")).toEqual([{ field: "role", before: "staff", after: "admin" }]);
    expect(changedFields([...changes, ...changes, { field: "price", before: "1", after: "2" }])).toEqual([
      "name",
      "price",
    ]);
  });
});
