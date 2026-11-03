import { describe, expect, it, vi } from "vitest";

import { ConflictError } from "../../../errors/ConflictError";
import { NotFoundError } from "../../../errors/NotFoundError";
import { ValidationError } from "../../../errors/ValidationError";
import { MessageGuest, type GuestMessageSources } from "../MessageGuest";

import type { BookWaitlistEntry } from "../../../entities/BookWaitlist";
import type { CafeEvent, EventRegistration } from "../../../entities/CafeEvent";
import type { NewNotification, Notification } from "../../../entities/Notification";
import type { Order } from "../../../entities/Order";
import type { Reservation } from "../../../entities/Reservation";
import type { AuditHook } from "../../../repositories/AuditHook";

const NOW = "2026-10-20T10:00:00.000Z";
const STAFF = { id: "s1", name: "Ali" };

const RESERVATION: Reservation = {
  id: "r1",
  reference: 12,
  guestName: "Sara",
  guestPhone: "0912 123 4567",
  partySize: 2,
  startsAt: "2026-10-21T15:00:00Z",
  durationMinutes: 90,
  status: "requested",
  createdAt: NOW,
  updatedAt: NOW,
};

const EVENT = {
  id: "e1",
  title: "Poetry night",
  titleFa: "شب شعر",
  isPublished: true,
} as CafeEvent;

const REGISTRATION = {
  id: "reg1",
  eventId: "e1",
  userId: "09120000004",
  guestName: "Neda",
  guestPhone: "09120000004",
} as EventRegistration;

const HOLD = {
  id: "w1",
  bookTitle: "Savushun",
  guestName: "Ali Moradi",
  guestPhone: "09121110004",
} as BookWaitlistEntry;

function setup(overrides: Partial<GuestMessageSources> = {}) {
  const sources: GuestMessageSources = {
    reservations: { getById: vi.fn(async (id: string) => (id === "r1" ? RESERVATION : null)) },
    suiteBookings: { getById: vi.fn(async () => null) },
    events: {
      getById: vi.fn(async () => EVENT),
      getRegistration: vi.fn(async (id: string) => (id === "reg1" ? REGISTRATION : null)),
    },
    bookLoans: { getById: vi.fn(async () => null) },
    bookHolds: { getById: vi.fn(async () => HOLD) },
    orders: {
      getById: vi.fn(async () => ({ id: "o1", orderNumber: 42, customerName: "Walk-in", customerPhone: "" }) as Order),
    },
    ...overrides,
  };
  const create = vi.fn(async (input: NewNotification, audit?: AuditHook<Notification>) => {
    const notification: Notification = { ...input, id: "n1", createdAt: NOW };
    return { notification, entry: audit?.(notification) ?? null };
  });
  const repo = {
    create: vi.fn(async (input: NewNotification, audit?: AuditHook<Notification>) => {
      return (await create(input, audit)).notification;
    }),
  };
  return { useCase: new MessageGuest(sources, repo), repo, create };
}

describe("MessageGuest", () => {
  it("sends the words to a phone booking's guest by their normalized phone, and logs who wrote what to whom", async () => {
    const { useCase, create } = setup();

    const sent = await useCase.execute(
      {
        phone: "+98 912 123 4567",
        text: "  We've kept the window table for you.  ",
        about: { kind: "reservation", id: "r1" },
      },
      STAFF,
    );

    expect(sent).toMatchObject({
      userId: "09121234567",
      kind: "staffMessage",
      params: { about: "reservation", reference: 12, text: "We've kept the window table for you." },
    });
    // A booking made by phone isn't on an account page, so there's nothing to link to.
    expect(sent.link).toBeUndefined();
    const { entry } = await create.mock.results[0].value;
    expect(entry).toEqual({
      actorId: "s1",
      actorName: "Ali",
      action: "reservation.guestMessaged",
      entityType: "reservation",
      entityId: "r1",
      entityLabel: "R-12",
      changes: [
        { field: "guest", before: null, after: "Sara (0912 123 4567)" },
        { field: "message", before: null, after: "We've kept the window table for you." },
      ],
    });
  });

  it("names an event by both its titles and links to its page", async () => {
    const { useCase } = setup();

    const sent = await useCase.execute(
      { phone: "09120000004", text: "Doors open at 7.", about: { kind: "eventRegistration", id: "reg1" } },
      STAFF,
    );

    expect(sent).toMatchObject({
      userId: "09120000004",
      params: { about: "eventRegistration", subject: "Poetry night", subjectFa: "شب شعر" },
      link: "/events/e1",
    });
  });

  it("logs a message about a hold against the hold", async () => {
    const { useCase, create } = setup();

    await useCase.execute({ phone: "09121110004", text: "It's back!", about: { kind: "bookHold", id: "w1" } }, STAFF);

    const { entry } = await create.mock.results[0].value;
    expect(entry).toMatchObject({
      action: "bookLoan.guestMessaged",
      entityType: "bookLoan",
      entityId: "w1",
      entityLabel: "Ali Moradi (Savushun)",
    });
  });

  it("refuses an empty or overlong message", async () => {
    const { useCase, repo } = setup();
    const about = { kind: "reservation", id: "r1" } as const;

    await expect(useCase.execute({ phone: "09121234567", text: "   ", about }, STAFF)).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(useCase.execute({ phone: "09121234567", text: "x".repeat(501), about }, STAFF)).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("refuses what doesn't exist, a phone that isn't the record's, and a record with no phone", async () => {
    const { useCase, repo } = setup();

    await expect(
      useCase.execute({ phone: "09121234567", text: "Hi", about: { kind: "reservation", id: "gone" } }, STAFF),
    ).rejects.toBeInstanceOf(NotFoundError);
    const changed = useCase.execute(
      { phone: "09350000000", text: "Hi", about: { kind: "reservation", id: "r1" } },
      STAFF,
    );
    await expect(changed).rejects.toBeInstanceOf(ConflictError);
    await expect(changed).rejects.toMatchObject({ code: "GUEST_CHANGED" });
    await expect(
      useCase.execute({ phone: "09121234567", text: "Hi", about: { kind: "order", id: "o1" } }, STAFF),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(repo.create).not.toHaveBeenCalled();
  });
});
