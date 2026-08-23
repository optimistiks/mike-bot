"use client";

import { useEffect, useState } from "react";

import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
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
 * Momentum is deliberately *not* free. `dragFree` would hand the flick its raw
 * velocity, and a filmstrip this narrow then crosses every section on a flick
 * meant for one. Left off, Embla's default `skipSnaps: false` resolves any
 * throw past its threshold to exactly the neighbouring snap, which is the only
 * movement the header's cross-fade can honestly describe. Fine-pointer devices
 * also get explicit 8bitcn arrows; touch devices retain the direct swipe
 * without duplicate controls.
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
      const selectedIndex = api.selectedSnap();
      if (selectedIndex === activeIndex) return;

      hapticSelection();
      onSelect(selectedIndex);
    };
    const reportReinitialization = () => {
      onSelect(api.selectedSnap());
    };

    api.on("select", reportSelection);
    api.on("reinit", reportReinitialization);

    return () => {
      api.off("select", reportSelection);
      api.off("reinit", reportReinitialization);
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
      <CarouselPrevious
        className="arcade-carousel-arrow arcade-carousel-arrow-previous top-1/2 left-4 h-10 w-10 -translate-y-1/2 active:-translate-y-1/2 md:left-5 md:h-10 md:w-10"
        aria-label="Предыдущий раздел"
      />
      <CarouselNext
        className="arcade-carousel-arrow arcade-carousel-arrow-next top-1/2 right-4 h-10 w-10 -translate-y-1/2 active:-translate-y-1/2 md:right-5 md:h-10 md:w-10"
        aria-label="Следующий раздел"
      />
    </Carousel>
  );
}
