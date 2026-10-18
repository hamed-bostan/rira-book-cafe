import { describe, expect, it, vi } from "vitest";

import { RequestOtp } from "../RequestOtp";
import { VerifyOtp } from "../VerifyOtp";

import type { AuthIdentity, IAuthRepository } from "../../../repositories/IAuthRepository";

const IDENTITY: AuthIdentity = { id: "09120000000", phone: "09120000000", name: "Rira Guest" };

type Fake = {
  repo: IAuthRepository;
  requestOtp: ReturnType<typeof vi.fn<IAuthRepository["requestOtp"]>>;
  verifyOtp: ReturnType<typeof vi.fn<IAuthRepository["verifyOtp"]>>;
};

function auth(): Fake {
  const requestOtp = vi.fn<IAuthRepository["requestOtp"]>(async () => true);
  const verifyOtp = vi.fn<IAuthRepository["verifyOtp"]>(async () => IDENTITY);
  return { repo: { requestOtp, verifyOtp }, requestOtp, verifyOtp };
}

describe("RequestOtp", () => {
  it("sends a code to the trimmed phone", async () => {
    const { repo, requestOtp } = auth();
    expect(await new RequestOtp(repo).execute("  09120000000 ")).toBe(true);
    expect(requestOtp).toHaveBeenCalledWith("09120000000");
  });

  it("refuses a blank phone without asking the provider", async () => {
    const { repo, requestOtp } = auth();
    expect(await new RequestOtp(repo).execute("   ")).toBe(false);
    expect(requestOtp).not.toHaveBeenCalled();
  });
});

describe("VerifyOtp", () => {
  it("verifies the trimmed phone and code", async () => {
    const { repo, verifyOtp } = auth();
    expect(await new VerifyOtp(repo).execute(" 09120000000 ", " 1234 ")).toBe(IDENTITY);
    expect(verifyOtp).toHaveBeenCalledWith("09120000000", "1234");
  });

  it.each<[string, string]>([
    ["", "1234"],
    ["09120000000", "  "],
  ])("yields no identity for phone %j and code %j", async (phone, code) => {
    const { repo, verifyOtp } = auth();
    expect(await new VerifyOtp(repo).execute(phone, code)).toBeNull();
    expect(verifyOtp).not.toHaveBeenCalled();
  });
});
