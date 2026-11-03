import { describe, expect, it } from "vitest";

import type { Notification } from "@/src/domain/entities/Notification";

import { notificationValues } from "../notificationValues";

const reminder: Notification = {
  id: "n1",
  userId: "09120000004",
  kind: "eventTomorrow",
  params: { title: "Book club", titleFa: "باشگاه کتاب", startsAt: "2026-11-05T13:30:00.000Z", seats: 2 },
  createdAt: "2026-11-04T14:30:00.000Z",
};

describe("notificationValues", () => {
  it("uses a param's Persian copy under fa, and the base copy otherwise", () => {
    expect(notificationValues(reminder, "fa").title).toBe("باشگاه کتاب");
    expect(notificationValues(reminder, "en").title).toBe("Book club");
  });

  it("keeps the base copy when there's no Persian one", () => {
    const plain = { ...reminder, params: { title: "Book club", startsAt: "2026-11-05T13:30:00.000Z", seats: 2 } };
    expect(notificationValues(plain, "fa").title).toBe("Book club");
  });

  it("shows a hold's deadline as its day on the cafe's calendar", () => {
    const told = {
      ...reminder,
      kind: "holdCollectBy" as const,
      params: { title: "The Blind Owl", dueAt: "2026-11-06T20:29:59.999Z" },
    };
    expect(notificationValues(told, "en").dueAt).toBe("Friday - November 6, 2026");
  });
});
