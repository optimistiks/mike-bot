"use client";

import { Button } from "@/components/ui/8bit/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/8bit/drawer";

import type { PrototypeSeason } from "../_lib/seasons";

import { seasonLabel } from "../_lib/seasons";
import { SeasonLinks } from "./season-links";

/**
 * The header's Season chip and what it opens.
 *
 * Ticket 05 owns the picker itself — the year strip, the month grid, the
 * dimmed empty Seasons. What ticket 04 needs is only that the chip is tappable
 * and that every Season stays reachable, so this is the 8bitcn drawer with
 * ticket 02's bare Season index still inside it. The drawer is the real
 * primitive rather than a hand-rolled panel, so ticket 05 replaces the contents
 * and keeps the container.
 */
export function SeasonChip({
  chatId,
  season,
}: {
  chatId: number;
  season: PrototypeSeason;
}) {
  return (
    <Drawer>
      <DrawerTrigger
        render={
          <Button variant="outline" size="sm" className="arcade-text-xs" />
        }
      >
        {seasonLabel(season)}
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="arcade-text-md text-primary">
            Сезон
          </DrawerTitle>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-8">
          <SeasonLinks chatId={chatId} season={season} />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
