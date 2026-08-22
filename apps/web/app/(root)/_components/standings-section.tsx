import type { LeaderboardSection } from "../_lib/leaderboard-shape";

import { SectionEmpty } from "./section-empty";
import { StandingsList } from "./standings-list";

/**
 * One slide of the filmstrip: a section's standings and nothing else.
 *
 * The title is deliberately absent — it lives in the header, where scrolling
 * cannot take it away. This is the only element on the Leaderboard that scrolls
 * vertically, which is why the scroll container is here rather than around the
 * whole screen.
 *
 * A section with no entries still gets its slide, so the filmstrip keeps all
 * five snaps and swiping never lands on a blank screen. It swaps the scroll
 * container for a full-height box instead: there is nothing to scroll, and the
 * empty state has to sit in the middle of the slide rather than at the top.
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
  if (section.entries.length === 0) {
    return (
      <section aria-label={section.title} className="arcade-slide-empty">
        <SectionEmpty section={section} />
      </section>
    );
  }

  return (
    <section aria-label={section.title} className="arcade-slide-scroll">
      <StandingsList entries={section.entries} isActive={isActive} />
    </section>
  );
}
