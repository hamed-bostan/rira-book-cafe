import { describe, expect, it } from "vitest";

import { POST as closeShift } from "@/app/api/admin/cash-shifts/[id]/close/route";
import { GET as readShifts, POST as openShift } from "@/app/api/admin/cash-shifts/route";
import { MAX_DRAWER_AMOUNT, type CashShift, type CashShiftReport } from "@/src/domain/entities/CashShift";
import { SYSTEM_ACCOUNTS } from "@/src/domain/entities/Ledger";
import { prisma } from "@/src/infrastructure/prisma/client";

import { jsonRequest, readError, readJson, routeParams } from "./helpers/http";
import { signInAs } from "./helpers/session";

/** The largest INTEGER (int4) — the amount columns' type until they became BIGINT. */
const INT4_MAX = 2_147_483_647;

const open = (openingFloat: number): Promise<Response> =>
  openShift(jsonRequest("POST", "/api/admin/cash-shifts", { openingFloat }));

const close = (id: string, countedCash: number): Promise<Response> =>
  closeShift(jsonRequest("POST", `/api/admin/cash-shifts/${id}/close`, { countedCash }), routeParams({ id }));

describe("drawer amounts", () => {
  it.each([INT4_MAX + 1, MAX_DRAWER_AMOUNT])("open with a float of %i and read it back", async (openingFloat) => {
    signInAs("staff");

    const response = await open(openingFloat);
    expect(response.status).toBe(201);
    expect((await readJson<CashShift>(response)).openingFloat).toBe(openingFloat);

    const { current } = await readJson<{ current: CashShiftReport | null }>(await readShifts());
    expect(current?.shift.openingFloat).toBe(openingFloat);
    expect(current?.expectedCash).toBe(openingFloat);
  });

  it("answers 400, not 500, one Toman over the limit", async () => {
    signInAs("staff");

    const response = await open(MAX_DRAWER_AMOUNT + 1);
    expect(response.status).toBe(400);
    expect(await readError(response)).toMatchObject({
      code: "VALIDATION",
      fieldErrors: { openingFloat: "amountTooLarge" },
    });
  });

  it("closes with an expected cash and a difference past INTEGER, and books the shortfall", async () => {
    signInAs("staff");
    const opened = await readJson<CashShift>(await open(MAX_DRAWER_AMOUNT));

    const response = await close(opened.id, 0);
    expect(response.status).toBe(200);
    expect(await readJson<CashShift>(response)).toMatchObject({
      status: "closed",
      expectedCash: MAX_DRAWER_AMOUNT,
      countedCash: 0,
      difference: -MAX_DRAWER_AMOUNT,
    });

    const lines = await prisma.journalLine.findMany({
      where: { entry: { source: "cashShift", sourceId: opened.id } },
      orderBy: { position: "asc" },
    });
    expect(lines.map(({ accountCode, debit, credit }) => ({ accountCode, debit, credit }))).toEqual([
      { accountCode: SYSTEM_ACCOUNTS.cashOverShort, debit: BigInt(MAX_DRAWER_AMOUNT), credit: BigInt(0) },
      { accountCode: SYSTEM_ACCOUNTS.cash, debit: BigInt(0), credit: BigInt(MAX_DRAWER_AMOUNT) },
    ]);
  });
});
