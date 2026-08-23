"use client";

import { ToggleGroupItem } from "@/components/ui/8bit/toggle-group";

/**
 * One tappable cell of the Season picker — a year, a month, or one of the two
 * persistent shortcuts.
 *
 * Every part of the picker taps the same way and dims the same way, so the rule
 * lives here rather than being spelled out at each of the three call sites.
 * Dimming is a warning, not a wall: a Season holding no Events stays reachable
 * by anyone who means it, which is the only way the empty state can be reached.
 */
export function SeasonPickerCell({
  value,
  hasData,
  children,
}: {
  value: string;
  hasData: boolean;
  children: React.ReactNode;
}) {
  return (
    <ToggleGroupItem
      value={value}
      className={
        hasData
          ? "arcade-picker-cell arcade-label"
          : "arcade-picker-cell arcade-picker-cell-empty arcade-label"
      }
    >
      {children}
    </ToggleGroupItem>
  );
}
