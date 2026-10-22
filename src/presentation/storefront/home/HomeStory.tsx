import { BookOpen, Leaf, UsersRound } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { FadeInImage } from "@/src/presentation/components/FadeInImage";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import readingImage from "@/src/shared/images/home/reading.png";

import { Eyebrow } from "./Eyebrow";

import type { LucideIcon } from "lucide-react";

type StoryFeature = { key: "sourced" | "community" | "reading"; icon: LucideIcon };

const STORY_FEATURES: readonly StoryFeature[] = [
  { key: "sourced", icon: Leaf },
  { key: "community", icon: UsersRound },
  { key: "reading", icon: BookOpen },
];

/** Who the cafe is: a reading guest beside the story and three things it cares about. */
export async function HomeStory() {
  const t = await getTranslations("site.home.story");

  return (
    <section id="story" className="px-5 py-14 sm:px-8 md:py-20 lg:px-16 lg:py-24">
      <div className="mx-auto grid max-w-7xl items-center gap-16 md:grid-cols-2">
        <FadeInImage
          src={readingImage}
          alt={t("imageAlt")}
          sizes="(min-width: 1280px) 600px, (min-width: 768px) 50vw, 100vw"
          className="cut-corner-lg aspect-[1484/1060] h-auto w-full rounded-sm object-cover"
        />
        <div className="flex flex-col items-start gap-4">
          <Eyebrow>{t("eyebrow")}</Eyebrow>
          <h2 className="text-3xl leading-tight font-bold tracking-tighter text-landing-ink md:text-4xl lg:text-5xl rtl:leading-snug">
            {t("title")}
          </h2>
          <p className="text-body-intro text-pretty text-landing-ink-soft">{t("body")}</p>
          <ul className="my-2 grid w-full grid-cols-3">
            {STORY_FEATURES.map(({ key, icon }) => (
              <li
                key={key}
                className="flex flex-col items-center gap-2 border-landing-border px-2 py-1 text-center not-last:border-e"
              >
                <Icon icon={icon} strokeWidth={1.5} className="size-10 text-landing-icon" />
                <span className="text-body-small text-landing-ink-muted">{t(key)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
