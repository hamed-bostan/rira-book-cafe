import type { Page } from "@/src/domain/entities/Pagination";
import type { Product } from "@/src/domain/entities/Product";
import type { ProductTranslationInput } from "@/src/domain/repositories/IProductRepository";
import { ApiError } from "@/src/lib/api/ApiError";
import { pageResponseSchema } from "@/src/lib/api/page-response-schema";
import { serverApiGet } from "@/src/lib/api/server-client";
import { productListResponseSchema, productResponseSchema } from "@/src/presentation/product/product-response-schema";

import { productTranslationListResponseSchema } from "./product-translation-response-schema";

/** What `GET /api/admin/products` promises: a page of products plus the total behind it. */
const productPageResponseSchema = pageResponseSchema(productResponseSchema);

/**
 * Server-side product reads for the dashboard (BFF). Fetched during server render
 * so the data arrives with the page instead of after a client round-trip.
 * Mutations go through the browser `productsApi`, which then `router.refresh()`es
 * to re-run these reads.
 */
export const productsServerApi = {
  list(): Promise<Product[]> {
    // Localized: the admin list is for reading, so it follows the active locale
    // (falling back to the base name where a product has no translation yet).
    return serverApiGet("/products", productListResponseSchema);
  },

  /**
   * One page of the catalog-management list, with the filters and ordering the
   * caller's query string carries.
   *
   * `params` is forwarded verbatim so the screen never has to know the param
   * names — it hands over the URL it was rendered with and the route parses it
   * back through the same contract that built it. Flattening to an object is
   * lossless here because none of the management-list params repeat (unlike the
   * public search's `dietary`).
   */
  listPage(params: URLSearchParams): Promise<Page<Product>> {
    return serverApiGet("/admin/products", productPageResponseSchema, {
      params: Object.fromEntries(params),
    });
  },

  /**
   * Resolve several products by id — for screens holding a set of product ids that
   * need to label them (the moderation queue's rows), instead of reading the whole
   * catalog to build a lookup map.
   */
  listByIds(ids: readonly string[]): Promise<Product[]> {
    return serverApiGet("/products", productListResponseSchema, { params: { ids: ids.join(",") } });
  },

  /**
   * Resolve a product by id; `null` on 404 so callers can `notFound()`.
   *
   * Canonical: this feeds the edit form, which writes back to the base row —
   * prefilling it with translated text would overwrite that row on save.
   *
   * The admin endpoint rather than the public one, because the edit form must be
   * able to open an unpublished product — the public read answers 404 for those.
   */
  async getById(id: string): Promise<Product | null> {
    try {
      return await serverApiGet(`/admin/products/${id}`, productResponseSchema, { canonical: true });
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },

  /** The product's stored per-locale translations, to prefill the edit form. */
  getTranslations(id: string): Promise<ProductTranslationInput[]> {
    return serverApiGet(`/products/${id}/translations`, productTranslationListResponseSchema);
  },
};
