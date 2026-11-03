import { describe, expect, it } from "vitest";

import { GET as getOverview } from "@/app/api/admin/analytics/overview/route";
import type { DashboardOverview } from "@/src/domain/entities/Analytics";
import { cafeDayOf, cafeDayRange, shiftCafeDay } from "@/src/domain/entities/CafeTime";
import { prisma } from "@/src/infrastructure/prisma/client";

import { readJson } from "./helpers/http";
import { signInAs } from "./helpers/session";

const HOUR_MS = 60 * 60 * 1000;

async function overview(): Promise<DashboardOverview> {
  signInAs("staff");
  const response = await getOverview();
  expect(response.status).toBe(200);
  return readJson<DashboardOverview>(response);
}

/** A published event from `startsAt` to `endsAt`. */
async function eventAt(startsAt: Date, endsAt: Date, isPublished = true): Promise<void> {
  await prisma.event.create({ data: { kind: "workshop", title: "Latte art workshop", startsAt, endsAt, isPublished } });
}

describe("the dashboard overview", () => {
  it("is for anyone with the dashboard, and carries no queue count of its own", async () => {
    expect((await getOverview()).status).toBe(401);

    // The queue card reads the order list's total; the overview doesn't count it twice.
    expect(await overview()).not.toHaveProperty("activeOrders");
  });

  it("counts this week's events, one already under way included", async () => {
    const now = Date.now();
    const weekEnd = cafeDayRange(shiftCafeDay(cafeDayOf(new Date()), 7)).from.getTime();
    const before = (await overview()).upcomingEvents;

    // Counted: under way right now, and starting in three days.
    await eventAt(new Date(now - HOUR_MS), new Date(now + HOUR_MS));
    await eventAt(new Date(now + 72 * HOUR_MS), new Date(now + 74 * HOUR_MS));
    // Not counted: already over, starting after the week, and not published.
    await eventAt(new Date(now - 3 * HOUR_MS), new Date(now - HOUR_MS));
    await eventAt(new Date(weekEnd + HOUR_MS), new Date(weekEnd + 3 * HOUR_MS));
    await eventAt(new Date(now - HOUR_MS), new Date(now + HOUR_MS), false);

    expect((await overview()).upcomingEvents).toBe(before + 2);
  });
});
