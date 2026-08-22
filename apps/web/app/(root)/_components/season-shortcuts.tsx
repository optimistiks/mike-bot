"use client";

import { getCurrentSeason } from "@/lib/scoring";
import type { Season } from "@/lib/scoring";
import type { LeaderboardPeriod } from "@/lib/leaderboard/schema";

import { ToggleGroup } from "@/components/ui/8bit/toggle-group";

import { isCurrentPeriod } from "../_lib/periods";

import { SeasonPickerCell } from "./season-picker-cell";

/**
 * The two cells that are always there, whatever year the strip is pointing at.
 *
 * СЕЙЧАС is the way back to the Current Season from anywhere, so wandering six
 * Seasons deep never costs more than one tap to undo. ВЕСЬ ГОД opens the
 * month-less full-year view of whichever year the strip has selected.
 */
export function SeasonShortcuts({
  year,
  period,
  availableSeasons,
  onSelect,
}: {
  year: number;
  period: LeaderboardPeriod;
  availableSeasons: Season[];
  onSelect: (period: LeaderboardPeriod) => void;
}) {
  // At most one of the two is ever pressed: СЕЙЧАС needs a month and ВЕСЬ ГОД
  // needs none, so the Season on screen cannot be both.
  const pressed: string[] = [];
  if (isCurrentPeriod(period)) pressed.push("now");
  if (period.kind === "year" && period.year === year) pressed.push("year");
  const yearHasData = availableSeasons.some((season) => season.year === year);

  return (
    <ToggleGroup
      aria-label="Быстрый выбор"
      className="arcade-picker-shortcuts"
      value={pressed}
      onValueChange={(value) => {
        // An empty group means the pressed cell was tapped again, which selects
        // the Season already open rather than nothing at all.
        const chosen = value.length > 0 ? value[0] : pressed.at(0);
        if (chosen === "now") {
          onSelect({ kind: "season", ...getCurrentSeason() });
        }
        if (chosen === "year") onSelect({ kind: "year", year });
      }}
    >
      <SeasonPickerCell value="now" hasData>
        СЕЙЧАС
      </SeasonPickerCell>
      <SeasonPickerCell value="year" hasData={yearHasData}>
        ВЕСЬ ГОД
      </SeasonPickerCell>
    </ToggleGroup>
  );
}
