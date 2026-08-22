"use client";

import { useState } from "react";

/**
 * Counts how many times `value` has changed in a way the caller cares about.
 *
 * Two things in the Mini App replay on a change they can only see by watching
 * a value go past: a section replays its reveal when it becomes the active
 * slide, and the tracking glitch replays when the URL moves between two
 * Seasons. Both want the same thing from React — a number to hang a `key` on,
 * so that "it happened again" remounts something.
 *
 * The comparison happens during render rather than in an effect. That is the
 * documented way to derive state from a changed prop, and it matters here: the
 * remount lands in the same commit as the change that caused it rather than one
 * paint later, which is the difference between a reveal that replays and a
 * reveal that visibly restarts.
 *
 * `shouldCount` receives both ends of the change, because neither caller counts
 * every change — one wants only the transitions into active, the other only the
 * navigations that stay within a Leaderboard.
 */
export function useChangeCounter<T>(
  value: T,
  shouldCount: (from: T, to: T) => boolean,
): number {
  const [seen, setSeen] = useState(value);
  const [count, setCount] = useState(0);

  if (!Object.is(seen, value)) {
    setSeen(value);
    if (shouldCount(seen, value)) {
      setCount((previous) => previous + 1);
    }
  }

  return count;
}
