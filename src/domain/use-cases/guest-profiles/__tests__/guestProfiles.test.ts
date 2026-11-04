import { describe, expect, it, vi } from "vitest";

import { guestProfileCreatedEntry, guestProfileMatch } from "../../../entities/GuestProfile";
import { PLACEHOLDER_USER_NAME, type User } from "../../../entities/User";
import { ValidationError } from "../../../errors/ValidationError";
import { FindGuestProfile } from "../FindGuestProfile";
import { ResolveGuestProfile } from "../ResolveGuestProfile";

const STAFF = { id: "09120000003", name: "Test Staff" };

function profile(overrides: Partial<User> = {}): User {
  return {
    id: "09123456789",
    phone: "0912 345 6789",
    name: "Sara Ahmadi",
    email: null,
    avatarUrl: null,
    role: "customer",
    ...overrides,
  };
}

/** A user table holding `users`, looked up by id. */
function users(...rows: User[]) {
  return { getById: vi.fn(async (id: string) => rows.find((row) => row.id === id) ?? null) };
}

describe("ResolveGuestProfile", () => {
  it("finds the profile however the phone was typed, under the profile's own name", async () => {
    const repo = users(profile());
    for (const phone of ["09123456789", " +98 912 345 6789 ", "۰۹۱۲ ۳۴۵ ۶۷۸۹", "98 912 345 6789"]) {
      expect(await new ResolveGuestProfile(repo).execute({ phone, name: "Someone Else" }, STAFF)).toEqual({
        userId: "09123456789",
        name: "Sara Ahmadi",
        phone: phone.trim(),
      });
    }
  });

  it("makes a profile for a phone with none, from the name staff typed", async () => {
    const resolved = await new ResolveGuestProfile(users()).execute(
      { phone: "0935 640 1182", name: "  Omid Karimi " },
      STAFF,
    );
    expect(resolved).toEqual({
      userId: "09356401182",
      name: "Omid Karimi",
      phone: "0935 640 1182",
      newProfile: { id: "09356401182", phone: "0935 640 1182", name: "Omid Karimi", createdBy: STAFF },
    });
  });

  it("needs a name for a phone with no profile, or a profile with only the placeholder name", async () => {
    await expect(new ResolveGuestProfile(users()).execute({ phone: "09356401182" }, STAFF)).rejects.toMatchObject({
      field: "guestName",
      message: "guestNameNeeded",
    });

    const unnamed = users(profile({ name: PLACEHOLDER_USER_NAME, firstSignedInAt: "2026-11-01T10:00:00.000Z" }));
    await expect(new ResolveGuestProfile(unnamed).execute({ phone: "09123456789" }, STAFF)).rejects.toMatchObject({
      field: "guestName",
    });
    // The typed name stands in on the record; the profile stays theirs to name.
    expect(await new ResolveGuestProfile(unnamed).execute({ phone: "09123456789", name: "Sara" }, STAFF)).toEqual({
      userId: "09123456789",
      name: "Sara",
      phone: "09123456789",
    });
  });

  it("refuses a phone nobody could have and a name too long, on the record's own fields", async () => {
    const useCase = new ResolveGuestProfile(users());
    const fields = { phone: "customerPhone", name: "customerName" };
    await expect(useCase.execute({ phone: "12 34", name: "Sara" }, STAFF, fields)).rejects.toMatchObject({
      field: "customerPhone",
    });
    await expect(useCase.execute({ phone: "09356401182", name: "x".repeat(81) }, STAFF, fields)).rejects.toThrow(
      ValidationError,
    );
  });
});

describe("FindGuestProfile", () => {
  it("tells staff whose the phone is and whether they've signed in — never more", async () => {
    const repo = users(
      profile(),
      profile({ id: "09350000001", name: "Ali", firstSignedInAt: "2026-11-01T10:00:00.000Z", email: "a@x.com" }),
    );
    expect(await new FindGuestProfile(repo).execute("+98 912 345 6789")).toEqual({
      name: "Sara Ahmadi",
      signedIn: false,
    });
    expect(await new FindGuestProfile(repo).execute("09350000001")).toEqual({ name: "Ali", signedIn: true });
    expect(await new FindGuestProfile(repo).execute("09350000002")).toBeNull();
    await expect(new FindGuestProfile(repo).execute("123")).rejects.toThrow(ValidationError);
  });
});

describe("guest profiles", () => {
  it("shows a profile with only the sign-in placeholder as having no name", () => {
    expect(guestProfileMatch(profile({ name: PLACEHOLDER_USER_NAME }))).toEqual({ name: null, signedIn: false });
  });

  it("logs a profile staff made against the guest, by who made it", () => {
    expect(
      guestProfileCreatedEntry({ id: "09356401182", phone: "0935 640 1182", name: "Omid", createdBy: STAFF }),
    ).toEqual({
      actorId: STAFF.id,
      actorName: STAFF.name,
      action: "guest.profileCreated",
      entityType: "guest",
      entityId: "09356401182",
      entityLabel: "Omid",
      changes: [{ field: "name", before: null, after: "Omid" }],
    });
  });
});
