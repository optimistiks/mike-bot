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
 * which is not inside the carousel — is what has to show it.
 */
export function SectionCarousel({
  sections,
  onSelect,
}: {
  sections: LeaderboardSection[];
  onSelect: (index: number) => void;
}) {
  const [api, setApi] = useState<CarouselApi>();

  useEffect(() => {
    if (!api) return;

    const report = () => {
      onSelect(api.selectedScrollSnap());
    };

    api.on("select", report);
    api.on("reInit", report);

    return () => {
      api.off("select", report);
      api.off("reInit", report);
    };
  }, [api, onSelect]);

  return (
    <Carousel
      className="arcade-filmstrip"
      setApi={setApi}
      opts={{ align: "start", loop: false, containScroll: "trimSnaps" }}
    >
      <CarouselContent className="ml-0 h-full">
        {sections.map((section) => (
          <CarouselItem key={section.id} className="arcade-slide pl-0">
            <StandingsSection section={section} />
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );
}
