import type { LeaderboardSection } from "../_lib/leaderboard-shape";

import { StandingsList } from "./standings-list";

/**
 * One slide of the filmstrip: a section's standings and nothing else.
 *
 * The title is deliberately absent — it lives in the header, where scrolling
 * cannot take it away. This is the only element on the Leaderboard that scrolls
 * vertically, which is why the scroll container is here rather than around the
 * whole screen.
 */
export function StandingsSection({ section }: { section: LeaderboardSection }) {
  return (
    <section aria-label={section.title} className="arcade-slide-scroll">
      <StandingsList entries={section.entries} />
    </section>
  );
}
