import { afterEach, describe, expect, it, vi } from "vitest";

import { PaymentGatewayError } from "@/src/domain/errors/PaymentGatewayError";

import { ZarinpalPaymentGateway } from "../ZarinpalPaymentGateway";

function reply(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function stubFetch(response: Response | Error) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit): Promise<Response> => {
    if (response instanceof Error) throw response;
    return response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function sentBody(fetchMock: ReturnType<typeof stubFetch>): Record<string, unknown> {
  const init = fetchMock.mock.calls[0][1];
  return JSON.parse(init?.body as string) as Record<string, unknown>;
}

afterEach(() => vi.unstubAllGlobals());

describe("ZarinpalPaymentGateway", () => {
  it("uses the sandbox without a merchant id", async () => {
    const fetchMock = stubFetch(reply({ data: { code: 100, authority: "A0001" }, errors: [] }));
    const gateway = new ZarinpalPaymentGateway({});
    const session = await gateway.request({ amount: 150_000, callbackUrl: "https://cafe.test/cb", description: "Order #1" });

    expect(gateway.isSandbox).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe("https://sandbox.zarinpal.com/pg/v4/payment/request.json");
    expect(session).toEqual({ authority: "A0001", redirectUrl: "https://sandbox.zarinpal.com/pg/StartPay/A0001" });
  });

  it("sends Rial (Toman × 10) to production with the merchant id", async () => {
    const fetchMock = stubFetch(reply({ data: { code: 100, authority: "A0002" }, errors: [] }));
    const gateway = new ZarinpalPaymentGateway({ merchantId: "11111111-2222-3333-4444-555555555555" });
    await gateway.request({ amount: 150_000, callbackUrl: "https://cafe.test/cb", description: "Order #1", mobile: "09120000000" });

    expect(fetchMock.mock.calls[0][0]).toBe("https://payment.zarinpal.com/pg/v4/payment/request.json");
    expect(sentBody(fetchMock)).toMatchObject({
      merchant_id: "11111111-2222-3333-4444-555555555555",
      amount: 1_500_000,
      metadata: { mobile: "09120000000" },
    });
  });

  it("throws when the gateway refuses to open a payment", async () => {
    stubFetch(reply({ data: [], errors: { code: -9, message: "Validation error" } }, 422));
    await expect(new ZarinpalPaymentGateway({}).request({ amount: 1, callbackUrl: "cb", description: "x" })).rejects.toMatchObject({
      name: "PaymentGatewayError",
      gatewayCode: "-9",
    });
  });

  it("verifies for the amount in Rial and reads 100 and 101 as success", async () => {
    const first = stubFetch(reply({ data: { code: 100, ref_id: 201, card_pan: "6037****1234" }, errors: [] }));
    const gateway = new ZarinpalPaymentGateway({});
    expect(await gateway.verify({ authority: "A0001", amount: 150_000 })).toEqual({
      ok: true,
      refId: "201",
      cardPan: "6037****1234",
      alreadyVerified: false,
    });
    expect(sentBody(first)).toMatchObject({ authority: "A0001", amount: 1_500_000 });

    stubFetch(reply({ data: { code: 101, ref_id: 201 }, errors: [] }));
    expect(await gateway.verify({ authority: "A0001", amount: 150_000 })).toMatchObject({ ok: true, alreadyVerified: true });
  });

  it("reads an error code as a definite refusal", async () => {
    stubFetch(reply({ data: [], errors: { code: -51, message: "Session is not valid" } }, 400));
    expect(await new ZarinpalPaymentGateway({}).verify({ authority: "A0001", amount: 1 })).toEqual({ ok: false, code: "-51" });
  });

  it("throws when the gateway can't be reached, so the check is retried", async () => {
    stubFetch(new TypeError("fetch failed"));
    await expect(new ZarinpalPaymentGateway({}).verify({ authority: "A0001", amount: 1 })).rejects.toThrow(PaymentGatewayError);
  });
});
