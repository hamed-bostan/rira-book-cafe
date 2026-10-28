import { describe, expect, it } from "vitest";

import { POST as quoteOrder } from "@/app/api/orders/quote/route";
import type { OrderQuote } from "@/src/domain/entities/Checkout";
import { prisma } from "@/src/infrastructure/prisma/client";

import { jsonRequest, readError, readJson } from "./helpers/http";
import { signInAs } from "./helpers/session";

/** Codes saved straight to the table — older ones may carry `-` or `_`, which a new code can't. */
async function saveCodes(...codes: string[]): Promise<void> {
  await prisma.promoCode.createMany({ data: codes.map((code) => ({ code, kind: "fixed", value: 10_000 })) });
}

/** Quote one cappuccino with the code as a guest typed it. */
async function quoteWith(promoCode: string): Promise<Response> {
  signInAs("customer");
  return quoteOrder(
    jsonRequest("POST", "/api/orders/quote", { items: [{ productId: "seed-cappuccino", quantity: 1 }], promoCode }),
  );
}

/** The stored code the quote applied. */
async function appliedCode(promoCode: string): Promise<string | undefined> {
  const response = await quoteWith(promoCode);
  expect(response.status).toBe(200);
  return (await readJson<OrderQuote>(response)).promoCode;
}

describe("finding the code a guest typed at checkout", () => {
  it("ignores case, spaces, dashes and underscores", async () => {
    await saveCodes("AUTUMN15");

    for (const typed of ["autumn-15", "Autumn 15", "AUTUMN15", " autumn_15 "]) {
      expect(await appliedCode(typed)).toBe("AUTUMN15");
    }
  });

  it("still finds a code saved with a dash before codes were letters and numbers only", async () => {
    await saveCodes("SPRING-10");

    for (const typed of ["SPRING-10", "spring10", "Spring 10"]) {
      expect(await appliedCode(typed)).toBe("SPRING-10");
    }
  });

  it("prefers the code saved exactly as typed, then the plain one, when two collapse to the same letters", async () => {
    await saveCodes("AUTUMN-15", "AUTUMN15");

    expect(await appliedCode("autumn-15")).toBe("AUTUMN-15");
    expect(await appliedCode("AUTUMN15")).toBe("AUTUMN15");
    expect(await appliedCode("autumn 15")).toBe("AUTUMN15");
  });

  it("refuses rather than guess between two old codes typed as neither", async () => {
    await saveCodes("WIN-TER", "WIN_TER");

    expect(await appliedCode("win_ter")).toBe("WIN_TER");
    const response = await quoteWith("winter");
    expect(response.status).toBe(409);
    expect((await readError(response)).code).toBe("PROMO_INVALID");
  });

  it("refuses a typed code that's all separators, even against an old code that was", async () => {
    await saveCodes("---");

    const response = await quoteWith("- -");
    expect(response.status).toBe(409);
    expect((await readError(response)).code).toBe("PROMO_INVALID");
  });
});
