import { revalidateTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CATALOG_TAGS } from "../../cache-tags";
import { invalidatesCatalog } from "../invalidatesCatalog";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

beforeEach(() => {
  vi.mocked(revalidateTag).mockClear();
});

describe("invalidatesCatalog", () => {
  it("expires every tag immediately after a successful write", async () => {
    const handler = invalidatesCatalog([CATALOG_TAGS.categories, CATALOG_TAGS.products], async () =>
      Response.json({ id: "c1" }, { status: 201 }),
    );

    const response = await handler();

    expect(response.status).toBe(201);
    expect(revalidateTag).toHaveBeenCalledWith(CATALOG_TAGS.categories, { expire: 0 });
    expect(revalidateTag).toHaveBeenCalledWith(CATALOG_TAGS.products, { expire: 0 });
  });

  it("passes the handler's arguments through", async () => {
    const inner = vi.fn(async (_request: Request, _context: { id: string }) => new Response(null, { status: 204 }));
    const request = new Request("http://test/api/events/e1", { method: "DELETE" });

    await invalidatesCatalog([CATALOG_TAGS.events], inner)(request, { id: "e1" });

    expect(inner).toHaveBeenCalledWith(request, { id: "e1" });
    expect(revalidateTag).toHaveBeenCalledWith(CATALOG_TAGS.events, { expire: 0 });
  });

  it("leaves the cache alone when the write fails", async () => {
    const handler = invalidatesCatalog([CATALOG_TAGS.products], async () =>
      Response.json({ error: { message: "Invalid", code: "VALIDATION" } }, { status: 400 }),
    );

    await handler();

    expect(revalidateTag).not.toHaveBeenCalled();
  });
});
