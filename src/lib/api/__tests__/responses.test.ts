import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { NotFoundError } from "@/src/domain/errors/NotFoundError";
import { PaymentGatewayError } from "@/src/domain/errors/PaymentGatewayError";
import type { ILogger } from "@/src/domain/repositories/ILogger";

import { errorResponseFromException, tooManyRequestsResponse } from "../responses";

afterEach(() => {
  vi.restoreAllMocks();
});

/** A logger whose `error` calls the test can inspect. */
function fakeLogger(): ILogger & { error: ReturnType<typeof vi.fn> } {
  const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: (): ILogger => logger };
  return logger;
}

/** A raw database failure, as Prisma would throw it — table names, query shape and all. */
function prismaLikeError(): Error {
  const error = new Error("Invalid `prisma.user.findUnique()` invocation:\n\nCan't reach database server at `db:5432`");
  error.name = "PrismaClientInitializationError";
  return error;
}

describe("errorResponseFromException", () => {
  it("answers an unknown error with a generic 500 and logs the detail server-side only", async () => {
    const log = fakeLogger();
    const error = prismaLikeError();

    const response = errorResponseFromException(error, "GET /api/test failed", log);
    const raw = await response.text();

    expect(response.status).toBe(500);
    expect(JSON.parse(raw)).toEqual({
      error: { message: "Something went wrong. Please try again.", code: "INTERNAL" },
    });
    expect(raw).not.toMatch(/prisma|db:5432|findUnique|stack|at /i);
    expect(log.error).toHaveBeenCalledWith("Unhandled error in route handler", {
      error,
      context: "GET /api/test failed",
    });
  });

  it("never forwards an upstream gateway's message", async () => {
    const response = errorResponseFromException(
      new PaymentGatewayError("Zarinpal answered 500 without JSON."),
      "POST /api/orders/1/pay failed",
      fakeLogger(),
    );

    expect(response.status).toBe(502);
    expect(await response.text()).not.toMatch(/Zarinpal answered/);
  });

  it("maps known domain errors to 4xx without logging them", async () => {
    const log = fakeLogger();
    const response = errorResponseFromException(new NotFoundError("order", "o1"), "ctx", log);

    expect(response.status).toBe(404);
    expect(log.error).not.toHaveBeenCalled();
  });

  it("answers a schema rejection with 400 and per-field messages only", async () => {
    const parsed = z.object({ page: z.number() }).safeParse({ page: "x" });
    if (parsed.success) throw new Error("expected a ZodError");

    const response = errorResponseFromException(parsed.error, "ctx");
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "VALIDATION", fieldErrors: { page: expect.any(String) } },
    });
  });
});

describe("tooManyRequestsResponse", () => {
  it("is a 429 envelope with Retry-After", async () => {
    const response = tooManyRequestsResponse(42);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("42");
    expect(await response.json()).toMatchObject({ error: { code: "RATE_LIMITED" } });
  });
});
