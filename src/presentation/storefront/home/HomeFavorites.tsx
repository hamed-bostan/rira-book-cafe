import { getTranslations } from "next-intl/server";

import type { Product } from "@/src/domain/entities/Product";

import { CutCornerLink } from "./CutCornerLink";
import { Eyebrow } from "./Eyebrow";
import { FavoriteItem } from "./FavoriteItem";

type HomeFavoritesProps = {
  /** The featured items to show, already trimmed to the row. */
  items: Product[];
};

/** A short row of featured menu items on the blue band, with a way into the full menu. */
export async function HomeFavorites({ items }: HomeFavoritesProps) {
  const t = await getTranslations("site.home.favorites");

  return (
    <section className="bg-landing-band px-5 py-14 sm:px-8 md:py-20 lg:px-16 lg:py-24">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 text-center">
        <Eyebrow>{t("eyebrow")}</Eyebrow>
        <h2 className="text-3xl leading-tight font-bold tracking-tighter text-balance text-landing-ink md:text-4xl lg:text-5xl rtl:leading-snug">
          {t("title")}
        </h2>
        <p className="text-body-intro text-pretty text-landing-ink-soft">{t("body")}</p>
        <div className="mt-8 grid w-full sm:auto-cols-fr sm:grid-flow-col">
          {items.map((item) => (
            <FavoriteItem key={item.id} item={item} />
          ))}
        </div>
        <div className="mt-6">
          <CutCornerLink href="/menu" variant="outline">
            {t("cta")}
          </CutCornerLink>
        </div>
      </div>
    </section>
  );
}
