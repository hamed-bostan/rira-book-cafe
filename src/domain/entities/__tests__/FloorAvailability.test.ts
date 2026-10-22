import { describe, expect, it } from "vitest";

import { tableChoicesFor, type FloorBooking, type FloorEvent } from "../FloorAvailability";

const SLOT = { startsAt: "2026-10-22T15:00:00.000Z", durationMinutes: 90, partySize: 4 };

function booking(overrides: Partial<FloorBooking> = {}): FloorBooking {
  return {
    id: "r1",
    reference: 7,
    status: "confirmed",
    tableLabel: "5",
    startsAt: "2026-10-22T14:00:00.000Z",
    durationMinutes: 90,
    ...overrides,
  };
}

const WORKSHOP: FloorEvent = {
  id: "e1",
  title: "Latte art workshop",
  startsAt: "2026-10-22T16:00:00.000Z",
  endsAt: "2026-10-22T18:00:00.000Z",
  tableLabels: ["7", "8"],
};

function choice(label: string, choices: ReturnType<typeof tableChoicesFor>) {
  return choices.find((c) => c.label === label);
}

describe("tableChoicesFor", () => {
  it("blocks a table another booking holds while this one would sit there", () => {
    const choices = tableChoicesFor(SLOT, [booking()], []);
    expect(choice("5", choices)?.block).toEqual({ kind: "booking", reference: 7 });
  });

  it("ignores bookings that don't hold a table, end before, or are this one", () => {
    expect(choice("5", tableChoicesFor(SLOT, [booking({ status: "requested" })], []))?.block).toBeUndefined();
    expect(
      choice("5", tableChoicesFor(SLOT, [booking({ startsAt: "2026-10-22T13:30:00.000Z" })], []))?.block,
    ).toBeUndefined();
    expect(choice("5", tableChoicesFor({ ...SLOT, reservationId: "r1" }, [booking()], []))?.block).toBeUndefined();
  });

  it("blocks tables an event holds during the booking", () => {
    const choices = tableChoicesFor(SLOT, [], [WORKSHOP]);
    expect(choice("7", choices)?.block).toEqual({ kind: "event", title: "Latte art workshop" });
    expect(choice("6", choices)?.block).toBeUndefined();
  });

  it("flags tables that seat fewer than the party", () => {
    const choices = tableChoicesFor(SLOT, [], []);
    expect(choice("1", choices)).toEqual({ label: "1", seats: 2, block: { kind: "tooSmall" } });
    expect(choice("3", choices)).toEqual({ label: "3", seats: 4 });
  });
});
