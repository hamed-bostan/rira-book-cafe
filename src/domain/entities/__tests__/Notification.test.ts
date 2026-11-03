import { describe, expect, it } from "vitest";

import { guestRecipient } from "../Notification";

describe("guestRecipient", () => {
  it("is the guest's account when the record has one", () => {
    expect(guestRecipient({ userId: "09120000004", phone: "0935 000 0000" })).toBe("09120000004");
  });

  it("is the normalized phone otherwise — the id that guest gets when they sign in", () => {
    expect(guestRecipient({ phone: "+98 912 123 4567" })).toBe("09121234567");
    expect(guestRecipient({ phone: "۰۹۱۲-۱۲۳-۴۵۶۷" })).toBe("09121234567");
  });

  it("is nobody without a usable number", () => {
    expect(guestRecipient({ phone: "" })).toBeNull();
    expect(guestRecipient({})).toBeNull();
    expect(guestRecipient({ phone: "12" })).toBeNull();
  });
});
