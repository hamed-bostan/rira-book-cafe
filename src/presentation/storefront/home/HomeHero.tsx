import { getTranslations } from "next-intl/server";

import { FadeInImage } from "@/src/presentation/components/FadeInImage";
import heroImage from "@/src/shared/images/home/hero.png";

import { CutCornerLink } from "./CutCornerLink";
import { Eyebrow } from "./Eyebrow";

/**
 * The opening statement beside the cafe illustration. The illustration runs to the
 * page's inline-end edge and fades in from the copy's side.
 */
export async function HomeHero() {
  const t = await getTranslations("site.home");

  return (
    <section className="overflow-hidden">
      <div className="mx-auto grid max-w-7xl items-center gap-6 ps-5 sm:grid-cols-2 sm:ps-8 lg:ps-16">
        <div className="flex max-w-lg flex-col items-start gap-6 pe-5 pt-12 sm:pe-8 sm:pb-12 lg:pe-16">
          <Eyebrow>{t("eyebrow")}</Eyebrow>
          <h1 className="text-4xl leading-none font-bold tracking-tighter text-balance text-landing-ink sm:text-5xl lg:text-6xl xl:text-7xl rtl:leading-tight">
            {t("title")}
          </h1>
          <p className="max-w-md text-body-intro text-pretty text-landing-ink-soft">{t("tagline")}</p>
          <div className="mt-2">
            <CutCornerLink href="/menu" size="large">
              {t("viewMenu")}
            </CutCornerLink>
          </div>
        </div>
        <div className="flex min-w-0 items-center self-stretch">
          <FadeInImage
            src={heroImage}
            alt={t("heroImageAlt")}
            sizes="(min-width: 1280px) 640px, (min-width: 640px) 50vw, 100vw"
            preload
            className="cut-corner-lg h-auto w-full [mask-image:linear-gradient(to_right,transparent_0,black_15%)] rtl:[mask-image:linear-gradient(to_left,transparent_0,black_15%)]"
          />
        </div>
      </div>
    </section>
  );
}
