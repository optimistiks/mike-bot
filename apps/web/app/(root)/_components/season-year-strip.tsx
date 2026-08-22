"use client";

import { ToggleGroup } from "@/components/ui/8bit/toggle-group";

import type { Season } from "@/lib/scoring";

import { availableSeasonSet, pickableYears } from "../_lib/periods";

import { SeasonPickerCell } from "./season-picker-cell";

/**
 * The horizontal year strip that sits above the month grid.
 *
 * Choosing a year here does not navigate: it re-points the grid below, so a
 * Season two years back is still one tap away once the year is in view. That is
 * also why re-tapping the selected year is a no-op rather than a dismissal —
 * the Member has not chosen a Season yet.
 */
export function SeasonYearStrip({
  year,
  availableSeasons,
  onYearChange,
}: {
  year: number;
  availableSeasons: Season[];
  onYearChange: (year: number) => void;
}) {
  return (
    <ToggleGroup
      aria-label="Год"
      className="arcade-picker-strip"
      value={[String(year)]}
      onValueChange={(value) => {
        // Base UI reports an empty group when the pressed item is tapped again.
        // The strip has no unselected state, so that tap means nothing.
        if (value.length > 0) onYearChange(Number(value[0]));
      }}
    >
      {pickableYears(availableSeasons).map((pickable) => (
        <SeasonPickerCell
          key={pickable}
          value={String(pickable)}
          hasData={[...availableSeasonSet(availableSeasons)].some((value) =>
            value.startsWith(`${String(pickable)}-`),
          )}
        >
          {pickable}
        </SeasonPickerCell>
      ))}
    </ToggleGroup>
  );
}
