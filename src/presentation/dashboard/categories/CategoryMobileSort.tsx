"use client";

import { useTranslations } from "next-intl";

import {
  ADMIN_CATEGORY_SORTS,
  DEFAULT_ADMIN_CATEGORY_DIRECTION,
  DEFAULT_ADMIN_CATEGORY_SORT,
} from "@/src/domain/entities/AdminCategoryFilters";
import { mergePageParams } from "@/src/lib/api/pagination-params";
import { useListParams } from "@/src/presentation/dashboard/list/useListParams";
import { Select } from "@/src/presentation/design-system";

/** Keeps every desktop sort available when the table becomes a mobile list. */
export function CategoryMobileSort() {
  const t = useTranslations("dashCategories");
  const { searchParams, setParams } = useListParams();
  const sort = searchParams.get("sort") ?? DEFAULT_ADMIN_CATEGORY_SORT;
  const direction = searchParams.get("dir") ?? DEFAULT_ADMIN_CATEGORY_DIRECTION;

  return (
    <Select
      aria-label={t("sortLabel")}
      className="ms-auto min-h-11 w-full min-w-0 max-w-full @[24rem]:w-auto"
      value={`${sort}:${direction}`}
      onChange={(event) => {
        const [nextSort, nextDirection] = event.target.value.split(":");
        const validSort = ADMIN_CATEGORY_SORTS.find((value) => value === nextSort);
        if (!validSort || (nextDirection !== "asc" && nextDirection !== "desc")) return;
        setParams(mergePageParams(searchParams, {
          sort: validSort,
          direction: nextDirection,
          page: 1,
        }, {
          sort: DEFAULT_ADMIN_CATEGORY_SORT,
          direction: DEFAULT_ADMIN_CATEGORY_DIRECTION,
        }));
      }}
    >
      <option value="name:asc">{t("sortNameAsc")}</option>
      <option value="name:desc">{t("sortNameDesc")}</option>
      <option value="productCount:desc">{t("sortProductsDesc")}</option>
      <option value="productCount:asc">{t("sortProductsAsc")}</option>
      <option value="updatedAt:desc">{t("sortUpdatedDesc")}</option>
      <option value="updatedAt:asc">{t("sortUpdatedAsc")}</option>
    </Select>
  );
}
