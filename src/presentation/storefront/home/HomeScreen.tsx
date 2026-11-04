import type { CafeSettings } from "@/src/domain/entities/CafeSettings";
import type { Product } from "@/src/domain/entities/Product";

import { HomeFavorites } from "./HomeFavorites";
import { HomeHero } from "./HomeHero";
import { HomeStory } from "./HomeStory";
import { HomeVisit } from "./HomeVisit";

/** How many featured items the favourites row holds. */
const FAVORITES_COUNT = 3;

type HomeScreenProps = {
  featured: Product[];
  /** The cafe's settings, for where to find it and when it's open. */
  cafe: CafeSettings;
  /** Today on the cafe calendar. */
  today: string;
};

/**
 * The front door, edge to edge: the welcome, a few favourites from the menu, the
 * cafe's story, and where to find it.
 */
export function HomeScreen({ featured, cafe, today }: HomeScreenProps) {
  const favorites = featured.slice(0, FAVORITES_COUNT);

  return (
    <div data-full-bleed className="flex flex-col bg-landing-background">
      <HomeHero />
      {favorites.length > 0 ? <HomeFavorites items={favorites} /> : null}
      <HomeStory />
      <HomeVisit cafe={cafe} today={today} />
    </div>
  );
}
