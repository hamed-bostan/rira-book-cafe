import { describe, expect, it } from "vitest";

import { PATCH as setReorderLevel } from "@/app/api/admin/inventory/items/[id]/route";
import { GET as getInventory } from "@/app/api/admin/inventory/route";
import { GET as lookupGuest } from "@/app/api/admin/loyalty/guests/route";
import { PATCH as bulkProducts } from "@/app/api/admin/products/bulk/route";
import type { InventorySummary } from "@/src/domain/entities/Inventory";
import type { GuestLoyaltyLookup } from "@/src/domain/entities/Loyalty";
import { prisma } from "@/src/infrastructure/prisma/client";

import { TEST_USERS } from "../fixtures/users";

import { getRequest, jsonRequest, readError, readJson, routeParams } from "./helpers/http";
import { signInAs } from "./helpers/session";

/**
 * The Menu routes no other suite drives: a stock item's low-stock level, looking a
 * guest's points up by phone, and featuring an item on the menu (the row menu's
 * action, sent as a one-item bulk change).
 */

const MILK = "seed-ing-milk";

async function reorderLevelOf(id: string): Promise<number | undefined> {
  signInAs("admin");
  const summary = await readJson<InventorySummary>(await getInventory());
  return summary.items.find((item) => item.id === id)?.reorderLevel;
}

function patchLevel(id: string, reorderLevel: string): Promise<Response> {
  return setReorderLevel(
    jsonRequest("PATCH", `/api/admin/inventory/items/${id}`, { reorderLevel }),
    routeParams({ id }),
  );
}

describe("a stock item's low-stock level", () => {
  it("is set, logged, and cleared again with a blank", async () => {
    signInAs("admin");
    expect((await patchLevel(MILK, "2500")).status).toBe(204);
    expect(await reorderLevelOf(MILK)).toBe(2500);
    expect(await prisma.activityEntry.count({ where: { entityType: "stockItem", entityId: MILK } })).toBe(1);

    signInAs("admin");
    expect((await patchLevel(MILK, "")).status).toBe(204);
    expect(await reorderLevelOf(MILK)).toBeUndefined();
  });

  it("refuses a negative level (400), an unknown item (404) and floor staff (401)", async () => {
    const seeded = await reorderLevelOf(MILK);
    signInAs("admin");
    const negative = await patchLevel(MILK, "-5");
    expect(negative.status).toBe(400);
    expect((await readError(negative)).fieldErrors).toHaveProperty("reorderLevel");
    expect((await patchLevel("no-such-item", "5")).status).toBe(404);

    // Staff see stock but don't manage it.
    signInAs("staff");
    expect((await patchLevel(MILK, "5")).status).toBe(401);
    expect(await reorderLevelOf(MILK)).toBe(seeded);
  });
});

describe("looking a guest's points up", () => {
  function lookup(phone: string): Promise<Response> {
    return lookupGuest(getRequest(`/api/admin/loyalty/guests?phone=${encodeURIComponent(phone)}`));
  }

  it("finds the guest's account however the phone is typed", async () => {
    signInAs("admin");
    for (const phone of [TEST_USERS.customer.phone, "0912 000 0004", "+98 912 000 0004"]) {
      const response = await lookup(phone);
      expect(response.status).toBe(200);
      expect(await readJson<GuestLoyaltyLookup>(response)).toMatchObject({
        userId: TEST_USERS.customer.id,
        balance: 0,
      });
    }
  });

  it("answers 404 for a phone with no account, 400 for no phone, and 401 without promotions", async () => {
    signInAs("admin");
    expect((await lookup("0912 999 8877")).status).toBe(404);
    expect((await lookup("")).status).toBe(400);

    signInAs("staff");
    expect((await lookup(TEST_USERS.customer.phone)).status).toBe(401);
  });
});

describe("featuring an item on the menu", () => {
  function bulk(ids: string[], type: string): Promise<Response> {
    return bulkProducts(jsonRequest("PATCH", "/api/admin/products/bulk", { ids, action: { type } }));
  }

  async function featured(id: string): Promise<boolean> {
    return (await prisma.product.findUniqueOrThrow({ where: { id } })).isFeatured;
  }

  it("features an item and takes it off again", async () => {
    const id = "seed-espresso";
    const before = await featured(id);
    signInAs("admin");

    expect(await readJson(await bulk([id], before ? "unfeature" : "feature"))).toEqual({ updated: 1 });
    expect(await featured(id)).toBe(!before);
    expect(await readJson(await bulk([id], before ? "feature" : "unfeature"))).toEqual({ updated: 1 });
    expect(await featured(id)).toBe(before);
  });

  it("keeps floor staff out (401)", async () => {
    signInAs("staff");

    expect((await bulk(["seed-espresso"], "feature")).status).toBe(401);
  });
});
