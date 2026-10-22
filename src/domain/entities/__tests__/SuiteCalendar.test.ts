import { describe, expect, it } from "vitest";

import { firstFreeNight, heldClashFor, holdsSuite, type SuiteBooking } from "../SuiteBooking";

type Stay = Pick<SuiteBooking, "id" | "status" | "checkIn" | "checkOut">;

const held: Stay = { id: "s4", status: "confirmed", checkIn: "2026-10-27", checkOut: "2026-10-30" };

describe("suite calendar helpers", () => {
  it("knows which statuses hold the suite", () => {
    expect(holdsSuite({ status: "checkedIn" })).toBe(true);
    expect(holdsSuite({ status: "requested" })).toBe(false);
  });

  it("finds the held stay a request overlaps", () => {
    const request: Stay = { id: "s6", status: "requested", checkIn: "2026-10-28", checkOut: "2026-10-31" };
    expect(heldClashFor(request, [held, request])).toBe(held);
  });

  it("lets back-to-back stays and non-requests through", () => {
    const after: Stay = { id: "s7", status: "requested", checkIn: "2026-10-30", checkOut: "2026-11-01" };
    expect(heldClashFor(after, [held])).toBeUndefined();
    expect(heldClashFor({ ...after, checkIn: "2026-10-28", status: "confirmed" }, [held])).toBeUndefined();
  });

  it("starts a new stay on the first night nobody holds", () => {
    expect(firstFreeNight([held], "2026-10-27")).toBe("2026-10-30");
    expect(firstFreeNight([held], "2026-10-22")).toBe("2026-10-22");
  });
});
