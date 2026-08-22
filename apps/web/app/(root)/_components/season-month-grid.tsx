"use client";

import { ToggleGroup } from "@/components/ui/8bit/toggle-group";

import type { LeaderboardPeriod } from "@/lib/leaderboard/schema";
import type { Season } from "@/lib/scoring";

import { availableSeasonSet, MONTH_SHORT_NAMES } from "../_lib/periods";

import { SeasonPickerCell } from "./season-picker-cell";

/**
 * The 3×4 month grid — twelve cells, so every Season of the chosen year is one
 * tap rather than a scroll.
 */
export function SeasonMonthGrid({
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
  const pressed =
    period.kind === "season" && period.year === year
      ? [String(period.month)]
      : [];
  const available = availableSeasonSet(availableSeasons);

  return (
    <ToggleGroup
      aria-label="Месяц"
      className="arcade-picker-grid"
      value={pressed}
      onValueChange={(value) => {
        // Base UI reports an empty group when the pressed cell is tapped again,
        // and the pressed cell is the Season already open. Tapping it is still a
        // selection — it just happens to select where the Member already is —
        // so it reports rather than bails, and the drawer closes either way.
        const month = value.length > 0 ? value[0] : pressed.at(0);
        if (month !== undefined) {
          onSelect({ kind: "season", year, month: Number(month) });
        }
      }}
    >
      {MONTH_SHORT_NAMES.map((name, index) => (
        <SeasonPickerCell
          key={name}
          value={String(index + 1)}
          hasData={available.has(`${String(year)}-${String(index + 1)}`)}
        >
          {name}
        </SeasonPickerCell>
      ))}
    </ToggleGroup>
  );
}
