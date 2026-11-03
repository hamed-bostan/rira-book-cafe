import { describe, expect, it } from "vitest";

import { dashboardEventHref, eventCardId } from "../eventLinks";

// 18:00 on 2026-10-21 in Tehran.
const EVENT = { id: "e1", startsAt: "2026-10-21T14:30:00.000Z" };

describe("dashboardEventHref", () => {
  it("opens the event itself for someone who can manage events", () => {
    expect(dashboardEventHref(EVENT, "2026-10-21", true)).toBe("/dashboard/events/e1/edit");
    expect(dashboardEventHref(EVENT, "2026-10-30", true)).toBe("/dashboard/events/e1/edit");
  });

  it("otherwise lands on its card, under Upcoming from its own day on", () => {
    expect(dashboardEventHref(EVENT, "2026-10-21", false)).toBe(`/dashboard/events#${eventCardId("e1")}`);
    expect(dashboardEventHref(EVENT, "2026-10-14", false)).toBe("/dashboard/events#event-e1");
  });

  it("finds an event from an earlier cafe day under Past", () => {
    expect(dashboardEventHref(EVENT, "2026-10-22", false)).toBe("/dashboard/events?tab=past#event-e1");
    // 22:00 UTC on the 21st is already the 22nd in Tehran — still today's event there.
    expect(dashboardEventHref({ id: "e2", startsAt: "2026-10-21T22:00:00.000Z" }, "2026-10-22", false)).toBe(
      "/dashboard/events#event-e2",
    );
  });
});
