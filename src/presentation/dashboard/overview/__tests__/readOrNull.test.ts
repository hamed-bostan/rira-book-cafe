import { redirect } from "next/navigation";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/src/lib/api/ApiError";

import { readOrNull } from "../readOrNull";

describe("readOrNull", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("passes a read's data through", async () => {
    await expect(readOrNull(Promise.resolve({ total: 3 }))).resolves.toEqual({ total: 3 });
  });

  it("turns a failed read into null, and logs it", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const failure = new ApiError("Internal error", 500);

    await expect(readOrNull(Promise.reject(failure))).resolves.toBeNull();
    expect(log).toHaveBeenCalledWith(expect.any(String), failure);
  });

  it("leaves Next's own control flow alone", async () => {
    const read = Promise.resolve().then(() => redirect("/login"));

    await expect(readOrNull(read)).rejects.toMatchObject({ digest: expect.stringMatching(/^NEXT_REDIRECT/) });
  });
});
