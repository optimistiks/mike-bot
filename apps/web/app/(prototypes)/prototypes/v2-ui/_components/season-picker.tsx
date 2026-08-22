"use client";

import { useState } from "react";

import type { PrototypeSeason } from "../_lib/seasons";

import { SeasonMonthGrid } from "./season-month-grid";
import { SeasonShortcuts } from "./season-shortcuts";
import { SeasonYearStrip } from "./season-year-strip";

/**
 * The drawer's contents: a year strip over a month grid over two persistent
 * cells.
 *
 * The browsed year lives here rather than in the URL, because the strip is a
 * filter on the grid rather than a destination — the Member has not chosen
 * anything until they tap a month, ВЕСЬ ГОД, or СЕЙЧАС. It starts on the Season
 * being viewed, so the drawer always opens where the Member already is.
 *
 * Nothing here navigates. The picker reports the Season that was chosen and the
 * drawer decides what that means, which keeps the choosing and the routing in
 * separate files.
 */
export function SeasonPicker({
  season,
  onSelect,
}: {
  season: PrototypeSeason;
  onSelect: (season: PrototypeSeason) => void;
}) {
  const [year, setYear] = useState(season.year);

  return (
    <div className="arcade-picker">
      <SeasonYearStrip year={year} onYearChange={setYear} />
      <SeasonMonthGrid year={year} season={season} onSelect={onSelect} />
      <SeasonShortcuts year={year} season={season} onSelect={onSelect} />
    </div>
  );
}
