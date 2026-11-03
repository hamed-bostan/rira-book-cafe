import { describe, expect, it } from "vitest";

import { eventChangeFor, eventChangeNotification, registrationCancelledNotification } from "../guestNotifications";

import type { CafeEvent, EventRegistration } from "../../../entities/CafeEvent";

const EVENT: CafeEvent = {
  id: "e1",
  kind: "reading",
  title: "Poetry night",
  titleFa: "شب شعر",
  startsAt: "2026-10-25T15:30:00.000Z",
  endsAt: "2026-10-25T17:30:00.000Z",
  price: 0,
  isPublished: true,
  seatsTaken: 2,
  tableLabels: [],
  createdAt: "",
  updatedAt: "2026-10-20T10:00:00.000Z",
};

const REGISTRATION: EventRegistration = {
  id: "g-reg",
  eventId: "e1",
  userId: "09120000004",
  guestName: "Sara",
  guestPhone: "0912 000 0004",
  seats: 2,
  status: "registered",
  createdAt: "",
};

describe("eventChangeFor", () => {
  it("is a move when the start or the end changes while the event stays on", () => {
    expect(eventChangeFor(EVENT, { ...EVENT, startsAt: "2026-10-26T15:30:00.000Z" })).toBe("moved");
    expect(eventChangeFor(EVENT, { ...EVENT, endsAt: "2026-10-25T18:00:00.000Z" })).toBe("moved");
    // The same instant written another way isn't a move.
    expect(eventChangeFor(EVENT, { ...EVENT, startsAt: "2026-10-25T19:00:00+03:30" })).toBeNull();
  });

  it("is off when it's unpublished, even if it moved in the same save", () => {
    expect(eventChangeFor(EVENT, { ...EVENT, isPublished: false })).toBe("off");
    expect(eventChangeFor(EVENT, { ...EVENT, isPublished: false, startsAt: "2026-10-26T15:30:00.000Z" })).toBe("off");
  });

  it("is nothing for a draft that moves, a draft that's published, or the same times", () => {
    const draft = { ...EVENT, isPublished: false };
    expect(eventChangeFor(draft, { ...draft, startsAt: "2026-10-26T15:30:00.000Z" })).toBeNull();
    expect(eventChangeFor(draft, EVENT)).toBeNull();
    expect(eventChangeFor(EVENT, EVENT)).toBeNull();
  });
});

describe("event notices", () => {
  it("tells a guest the event moved, by phone, once per save", () => {
    expect(eventChangeNotification(EVENT, REGISTRATION, "moved")).toEqual({
      userId: "09120000004",
      kind: "eventMoved",
      params: { title: "Poetry night", titleFa: "شب شعر", startsAt: EVENT.startsAt },
      link: "/events/e1",
      dedupeKey: "event:e1:moved:2026-10-20T10:00:00.000Z:g-reg",
    });
    expect(eventChangeNotification({ ...EVENT, updatedAt: "later" }, REGISTRATION, "moved").dedupeKey).not.toBe(
      eventChangeNotification(EVENT, REGISTRATION, "moved").dedupeKey,
    );
  });

  it("points an event that's off at the listing, and keys a cancellation on the sign-up it ended", () => {
    expect(eventChangeNotification(EVENT, REGISTRATION, "off")).toMatchObject({ kind: "eventOff", link: "/events" });
    expect(eventChangeNotification(EVENT, REGISTRATION, "cancelled")).toMatchObject({
      kind: "eventCancelled",
      link: "/events",
      dedupeKey: "registration:g-reg:cancelled",
    });
  });

  it("falls back to the English title when the event has no Persian one", () => {
    const { titleFa: _titleFa, ...untranslated } = EVENT;
    expect(eventChangeNotification(untranslated, REGISTRATION, "off").params.titleFa).toBe("Poetry night");
  });

  it("tells a guest staff cancelled their sign-up", () => {
    expect(registrationCancelledNotification(EVENT, REGISTRATION)).toEqual({
      userId: "09120000004",
      kind: "eventRegistrationCancelled",
      params: { title: "Poetry night", titleFa: "شب شعر", startsAt: EVENT.startsAt, seats: 2 },
      link: "/events/e1",
      dedupeKey: "registration:g-reg:cancelled",
    });
  });
});
