import { describe, expect, it } from "vitest";

import { kitchenWaitMessage } from "../kitchenWait";

describe("kitchenWaitMessage", () => {
  it("reads as just now under a minute", () => {
    expect(kitchenWaitMessage(0, "en")).toEqual({ key: "justNow" });
  });

  it("counts minutes under an hour", () => {
    expect(kitchenWaitMessage(1, "en")).toEqual({ key: "minutes", values: { minutes: "1" } });
    expect(kitchenWaitMessage(59, "en")).toEqual({ key: "minutes", values: { minutes: "59" } });
  });

  it("splits an hour or more into hours and minutes", () => {
    expect(kitchenWaitMessage(65, "en")).toEqual({ key: "hours", values: { hours: "1", minutes: "5" } });
    expect(kitchenWaitMessage(120, "en")).toEqual({ key: "hours", values: { hours: "2", minutes: "0" } });
  });

  it("uses Persian digits under fa", () => {
    expect(kitchenWaitMessage(12, "fa")).toEqual({ key: "minutes", values: { minutes: "۱۲" } });
  });
});
