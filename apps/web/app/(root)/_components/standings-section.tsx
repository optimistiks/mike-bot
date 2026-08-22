import type { LeaderboardSection } from "../_lib/leaderboard-shape";

import { StandingsList } from "./standings-list";

/**
 * One slide of the filmstrip: a section's standings and nothing else.
 *
 * The title is deliberately absent — it lives in the header, where scrolling
 * cannot take it away. This is the only element on the Leaderboard that scrolls
 * vertically, which is why the scroll container is here rather than around the
 * whole screen.
 *
 * Whether the slide is the active one is passed straight through: the standings
 * are what replays when it becomes active, so the slide itself has no use for
 * the fact beyond handing it on.
 */
export function StandingsSection({
  section,
  isActive,
}: {
  section: LeaderboardSection;
  isActive: boolean;
}) {
  return (
    <section aria-label={section.title} className="arcade-slide-scroll">
      <StandingsList entries={section.entries} isActive={isActive} />
    </section>
  );
}
