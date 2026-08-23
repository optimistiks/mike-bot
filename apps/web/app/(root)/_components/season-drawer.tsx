"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { LeaderboardPeriod } from "@/lib/leaderboard/schema";
import type { Season } from "@/lib/scoring";

import { Button } from "@/components/ui/8bit/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/8bit/drawer";

import { leaderboardHref, periodLabel } from "../_lib/periods";
import { leaderboardOptions } from "../_lib/queries";
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
  period,
  availableSeasons,
}: {
  chatId: number;
  period: LeaderboardPeriod;
  /**
   * Undefined until the Seasons request lands. The trigger still shows the
   * Season the URL names — it is read from the address, not the response — but
   * refuses to open onto a picker with no years in it.
   */
  availableSeasons?: Season[];
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const { hapticSelection, interceptBack, platform } = useTelegramPlatform();

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
          <Button
            variant="outline"
            className="arcade-label w-full"
            disabled={availableSeasons === undefined}
          />
        }
      >
        {periodLabel(period)}
      </DrawerTrigger>
      <DrawerContent className="arcade-drawer" aria-label="Сезон">
        <DrawerHeader>
          <DrawerTitle className="arcade-h2">Сезон</DrawerTitle>
        </DrawerHeader>
        <div className="min-h-0 overflow-y-auto px-4 pt-2 pb-8">
          <SeasonPicker
            period={period}
            availableSeasons={availableSeasons ?? []}
            onSelect={(chosen) => {
              hapticSelection();
              setOpen(false);
              if (platform) {
                void queryClient.prefetchQuery(
                  leaderboardOptions(platform, chatId, chosen),
                );
              }
              router.replace(leaderboardHref(chatId, chosen));
            }}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
