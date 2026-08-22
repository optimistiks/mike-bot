"use client";

import { useEffect, useState } from "react";

import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/8bit/carousel";

import type { LeaderboardSection } from "../_lib/leaderboard-shape";

import { StandingsSection } from "./standings-section";
import { useTelegramPlatform } from "./telegram-provider";

/**
 * The five sections as a full-bleed filmstrip, one section per screen.
 *
 * `loop: false` is the point of the gesture: swiping past either end has to
 * rubber-band and stop, so reaching Как же у них горит feels like reaching the
 * end rather than wrapping silently back to Уважаемые люди. Embla's own
 * out-of-bounds friction supplies the rubber-band; the peek onto the next slide
 * is the slide's width, in the stylesheet.
 *
 * The selected index is lifted out rather than kept here, because the header —
 * which is not inside the carousel — is what has to show it. It comes back down
 * as `activeIndex` because the slides need it too: a section replays its reveal
 * when it becomes the active one, and Embla will not tell a slide that.
 */
export function SectionCarousel({
  sections,
  activeIndex,
  onSelect,
}: {
  sections: LeaderboardSection[];
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  const [api, setApi] = useState<CarouselApi>();
  const { hapticSelection } = useTelegramPlatform();

  useEffect(() => {
    if (!api) return;

    const reportSelection = () => {
      const selectedIndex = api.selectedScrollSnap();
      if (selectedIndex === activeIndex) return;

      hapticSelection();
      onSelect(selectedIndex);
    };
    const reportReinitialization = () => {
      onSelect(api.selectedScrollSnap());
    };

    api.on("select", reportSelection);
    api.on("reInit", reportReinitialization);

    return () => {
      api.off("select", reportSelection);
      api.off("reInit", reportReinitialization);
    };
  }, [activeIndex, api, hapticSelection, onSelect]);

  return (
    <Carousel
      className="arcade-filmstrip"
      setApi={setApi}
      opts={{ align: "start", loop: false, containScroll: "trimSnaps" }}
    >
      <CarouselContent className="ml-0 h-full">
        {sections.map((section, index) => (
          <CarouselItem key={section.id} className="arcade-slide pl-0">
            <StandingsSection
              section={section}
              isActive={index === activeIndex}
            />
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );
}
