import { ArrowRight, MapPin } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { CAFE_LOCATION } from "@/src/lib/cafeLocation";
import { cn } from "@/src/lib/utils";
import { FadeInImage } from "@/src/presentation/components/FadeInImage";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";
import storefrontImage from "@/src/shared/images/home/storefront.png";

import { Eyebrow } from "./Eyebrow";
import { openingHoursLines } from "./openingHours";

/**
 * Where to find the cafe, beside its storefront. The address, directions and hours
 * come from the configured location and each appears only once it is filled in —
 * nothing here is guessed.
 */
export async function HomeVisit() {
  const [t, locale] = await Promise.all([getTranslations("site.home.visit"), getLocale()]);
  const { streetAddress, addressLocality, addressRegion, postalCode, latitude, longitude } = CAFE_LOCATION;

  const addressLines = [
    streetAddress,
    [addressLocality, addressRegion, postalCode].filter(Boolean).join(locale === "fa" ? "، " : ", "),
  ].filter(Boolean);
  const directionsUrl =
    latitude !== undefined && longitude !== undefined
      ? `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`
      : undefined;
  const hours = openingHoursLines(CAFE_LOCATION.openingHours, locale);

  return (
    <section id="visit" className="bg-landing-band px-5 pt-14 sm:px-8 md:pt-20 lg:px-16 lg:pt-24">
      <div className="mx-auto grid max-w-7xl items-end gap-8 md:grid-cols-2">
        <div className="flex flex-col items-start gap-4 md:pb-12">
          <Eyebrow>{t("eyebrow")}</Eyebrow>
          <h2 className="text-3xl leading-tight font-bold tracking-tighter text-landing-ink md:text-4xl lg:text-5xl rtl:leading-snug">
            {t("title")}
          </h2>
          <p className="max-w-md text-body-intro text-pretty text-landing-ink-soft">{t("body")}</p>
          {addressLines.length > 0 || hours.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-x-10 gap-y-6">
              {addressLines.length > 0 ? (
                <div className="flex items-start gap-4">
                  <Icon icon={MapPin} size="xl" className="text-landing-icon" />
                  <div className="flex flex-col items-start gap-3">
                    <address className="text-body-default text-landing-ink not-italic">
                      {addressLines.map((line) => (
                        <span key={line} className="block">
                          {line}
                        </span>
                      ))}
                    </address>
                    {directionsUrl ? (
                      <a
                        href={directionsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          "flex items-center gap-2 border-b-2 border-landing-primary pb-1 text-body-small-strong text-landing-ink hover:text-landing-primary",
                          focusRing,
                        )}
                      >
                        {t("directions")}
                        <Icon icon={ArrowRight} size="xs" className="text-landing-primary rtl:-scale-x-100" />
                      </a>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {hours.length > 0 ? (
                <dl
                  aria-label={t("hours")}
                  className="grid grid-cols-[auto_auto] content-start gap-x-6 gap-y-1 text-body-default text-landing-ink-soft lg:border-s lg:border-landing-border lg:ps-10"
                >
                  {hours.map((line) => (
                    <div key={line.days} className="contents">
                      <dt>{line.days}</dt>
                      <dd>{line.hours}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
          ) : null}
        </div>
        <FadeInImage
          src={storefrontImage}
          alt={t("imageAlt")}
          sizes="(min-width: 1280px) 600px, (min-width: 768px) 50vw, 100vw"
          className="cut-corner-lg aspect-[1536/860] h-auto w-full object-cover object-top"
        />
      </div>
    </section>
  );
}
