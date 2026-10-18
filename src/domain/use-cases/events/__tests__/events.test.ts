import { describe, expect, it, vi } from "vitest";

import { isOpenForRegistration, seatsLeft, type CafeEvent } from "../../../entities/CafeEvent";
import { ValidationError } from "../../../errors/ValidationError";
import { CancelOwnRegistration, RegisterForEvent } from "../EventRegistrations";
import { CreateEvent, UpdateEvent } from "../SaveEvent";

import type { IEventRepository, NewCafeEvent } from "../../../repositories/IEventRepository";

const NOW = new Date("2026-10-20T10:00:00Z");
const ACTOR = { id: "a", name: "Admin" };

const INPUT: NewCafeEvent = {
  kind: "bookClub",
  title: "  The Blind Owl  ",
  startsAt: "2026-10-25T15:30:00.000Z",
  endsAt: "2026-10-25T17:30:00.000Z",
  capacity: 20,
  price: 0,
  isPublished: true,
};

function event(overrides: Partial<CafeEvent> = {}): CafeEvent {
  return { ...INPUT, id: "e1", seatsTaken: 0, createdAt: "", updatedAt: "", ...overrides };
}

describe("CreateEvent / UpdateEvent", () => {
  it("trims the title and audits the creation", async () => {
    const create = vi.fn(async (input: NewCafeEvent, audit?: (saved: CafeEvent) => unknown) => {
      const saved = event({ title: input.title });
      audit?.(saved);
      return saved;
    });
    const repo = { create } as unknown as IEventRepository;
    const saved = await new CreateEvent(repo).execute(INPUT, ACTOR);
    expect(saved.title).toBe("The Blind Owl");
  });

  it("refuses an event that ends before it starts", async () => {
    const repo = { create: vi.fn() } as unknown as IEventRepository;
    await expect(new CreateEvent(repo).execute({ ...INPUT, endsAt: INPUT.startsAt }, ACTOR)).rejects.toThrow(
      ValidationError,
    );
  });

  it("won't lower capacity below the seats already taken", async () => {
    const repo = {
      getById: vi.fn(async () => event({ seatsTaken: 12 })),
      update: vi.fn(),
    } as unknown as IEventRepository;
    await expect(new UpdateEvent(repo).execute("e1", { ...INPUT, capacity: 10 }, ACTOR)).rejects.toThrow(
      ValidationError,
    );
  });
});

describe("registrations", () => {
  it("refuses more than six seats before touching the repository", async () => {
    const register = vi.fn();
    const repo = { register } as unknown as IEventRepository;
    await expect(new RegisterForEvent(repo).execute("e1", 7, { id: "g", name: "G", phone: "0" }, NOW)).rejects.toThrow(
      ValidationError,
    );
    expect(register).not.toHaveBeenCalled();
  });

  it("hides other guests' registrations", async () => {
    const repo = {
      getRegistration: vi.fn(async () => ({
        id: "x",
        eventId: "e1",
        userId: "other",
        guestName: "",
        guestPhone: "",
        seats: 1,
        status: "registered",
        createdAt: "",
      })),
      cancelRegistration: vi.fn(),
    } as unknown as IEventRepository;
    await expect(new CancelOwnRegistration(repo).execute("x", "me")).rejects.toThrow("not found");
  });

  it("knows when an event is open", () => {
    expect(seatsLeft(event({ capacity: 20, seatsTaken: 18 }))).toBe(2);
    expect(seatsLeft(event({ capacity: undefined }))).toBeUndefined();
    expect(isOpenForRegistration(event(), NOW)).toBe(true);
    expect(isOpenForRegistration(event({ capacity: 2, seatsTaken: 2 }), NOW)).toBe(false);
    expect(isOpenForRegistration(event({ isPublished: false }), NOW)).toBe(false);
    expect(isOpenForRegistration(event(), new Date("2026-10-26T00:00:00Z"))).toBe(false);
  });
});
