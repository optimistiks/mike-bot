"use client";

import { ToggleGroup } from "@/components/ui/8bit/toggle-group";

import {
  MONTH_SHORT_NAMES,
  seasonHasData,
  type PrototypeSeason,
} from "../_lib/seasons";

import { SeasonPickerCell } from "./season-picker-cell";

/**
 * The 3×4 month grid — twelve cells, so every Season of the chosen year is one
 * tap rather than a scroll.
 */
export function SeasonMonthGrid({
  year,
  season,
  onSelect,
}: {
  year: number;
  season: PrototypeSeason;
  onSelect: (season: PrototypeSeason) => void;
}) {
  const pressed =
    season.year === year && season.month !== undefined
      ? [String(season.month)]
      : [];

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
        if (month !== undefined) onSelect({ year, month: Number(month) });
      }}
    >
      {MONTH_SHORT_NAMES.map((name, index) => (
        <SeasonPickerCell
          key={name}
          value={String(index + 1)}
          hasData={seasonHasData({ year, month: index + 1 })}
        >
          {name}
        </SeasonPickerCell>
      ))}
    </ToggleGroup>
  );
}
