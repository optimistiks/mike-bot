"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/8bit/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/8bit/drawer";

import type { PrototypeSeason } from "../_lib/seasons";

import { leaderboardHref, seasonLabel } from "../_lib/seasons";
import { SeasonPicker } from "./season-picker";
import { useTelegramPlatform } from "./telegram-provider";

/**
 * The header's Season chip and the drawer it opens.
 *
 * Changing Season is discoverable from the thing it changes, so the trigger is
 * the Season itself rather than a separate control. Everything physical about
 * the drawer — drag to dismiss, the resistance before it gives, the flick that
 * dismisses on velocity rather than distance — belongs to Base UI's Drawer, and
 * none of it is hand-rolled here.
 *
 * The Season is **replaced** rather than pushed: back therefore always means
 * "return to the Chat list" instead of walking backwards through every Season
 * the Member looked at. Undoing a Season change is served by reopening this.
 */
export function SeasonDrawer({
  chatId,
  season,
}: {
  chatId: number;
  season: PrototypeSeason;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { hapticSelection, interceptBack } = useTelegramPlatform();

  useEffect(() => {
    if (!open) return;

    return interceptBack(() => {
      setOpen(false);
    });
  }, [interceptBack, open]);

  return (
    <Drawer open={open} onOpenChange={setOpen} showSwipeHandle>
      <DrawerTrigger
        render={
          <Button variant="outline" size="sm" className="arcade-text-xs" />
        }
      >
        {seasonLabel(season)}
      </DrawerTrigger>
      <DrawerContent className="arcade-drawer" aria-label="Сезон">
        <DrawerHeader>
          <DrawerTitle className="arcade-text-md text-primary">
            Сезон
          </DrawerTitle>
        </DrawerHeader>
        <div className="min-h-0 overflow-y-auto px-4 pt-2 pb-8">
          <SeasonPicker
            season={season}
            onSelect={(chosen) => {
              hapticSelection();
              setOpen(false);
              router.replace(leaderboardHref(chatId, chosen));
            }}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
