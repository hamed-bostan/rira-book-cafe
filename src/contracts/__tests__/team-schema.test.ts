import { describe, expect, it } from "vitest";

import { teamMemberListResponseSchema, teamMemberResponseSchema, type TeamMember } from "../team-response-schema";
import { grantAdminSchema, type GrantAdminInput } from "../team-schema";

const GRANT: GrantAdminInput = { phone: " +98 912 345 6789 ", email: "", role: "staff" };

describe("grantAdminSchema", () => {
  it("trims the phone and accepts a blank or absent email", () => {
    expect(grantAdminSchema.parse(GRANT)).toEqual({ phone: "+98 912 345 6789", email: "", role: "staff" });
    expect(grantAdminSchema.parse({ phone: "09123456789", role: "admin" })).toEqual({
      phone: "09123456789",
      role: "admin",
    });
  });

  it("trims an email", () => {
    expect(grantAdminSchema.parse({ ...GRANT, email: " ops@example.com " }).email).toBe("ops@example.com");
  });

  it("accepts the usual ways of typing a number", () => {
    for (const phone of ["+989123456789", "0912 345 6789", "0912 (345) 6789", "98-912-345-6789"]) {
      expect(grantAdminSchema.safeParse({ ...GRANT, phone }).success).toBe(true);
    }
  });

  it("separates a missing phone from a malformed one", () => {
    expect(grantAdminSchema.safeParse({ ...GRANT, phone: " " }).error?.flatten().fieldErrors.phone).toContain(
      "phoneRequired",
    );
    for (const phone of ["0912", "phone 0912345", "-09123456789", "0".repeat(21)]) {
      expect(grantAdminSchema.safeParse({ ...GRANT, phone }).error?.flatten().fieldErrors.phone).toEqual([
        "phoneInvalid",
      ]);
    }
  });

  it("maps a bad email to its message key", () => {
    expect(grantAdminSchema.safeParse({ ...GRANT, email: "nope" }).error?.flatten().fieldErrors.email).toEqual([
      "emailInvalid",
    ]);
    expect(
      grantAdminSchema.safeParse({ ...GRANT, email: `${"a".repeat(250)}@example.com` }).error?.flatten().fieldErrors
        .email,
    ).toEqual(["emailTooLong"]);
  });

  it("never grants ownership or a customer role", () => {
    for (const role of ["owner", "customer"]) {
      expect(grantAdminSchema.safeParse({ ...GRANT, role }).error?.flatten().fieldErrors.role).toHaveLength(1);
    }
  });
});

describe("teamMemberResponseSchema", () => {
  const MEMBER: TeamMember = {
    id: "u1",
    name: "Hamed",
    phone: "09123456789",
    avatarUrl: null,
    role: "owner",
    isSelf: true,
    breakGlass: false,
    transferable: false,
    revokeBlocked: "self",
  };

  it("reads the rows the team endpoint returns", () => {
    const admin: TeamMember = {
      ...MEMBER,
      id: "u2",
      role: "admin",
      isSelf: false,
      transferable: true,
      revokeBlocked: null,
    };
    expect(teamMemberListResponseSchema.parse([MEMBER, admin])).toEqual([MEMBER, admin]);
  });

  it("rejects a row the API doesn't promise", () => {
    expect(teamMemberResponseSchema.safeParse({ ...MEMBER, role: "staff" }).error?.issues[0]?.path).toEqual(["role"]);
    expect(teamMemberResponseSchema.safeParse({ ...MEMBER, revokeBlocked: "admin" }).error?.issues[0]?.path).toEqual([
      "revokeBlocked",
    ]);
  });
});
