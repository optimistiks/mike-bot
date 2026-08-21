import type { LeaderboardSection } from "../_lib/leaderboard-shape";

import { StandingsList } from "./standings-list";

/**
 * One of the five sections: its title and its standings. Ticket 04 turns this
 * into a slide of the filmstrip and lifts the title into the pinned header, so
 * it stays a whole, self-contained section until then.
 */
export function StandingsSection({ section }: { section: LeaderboardSection }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="arcade-text-sm text-secondary">{section.title}</h2>
      <StandingsList entries={section.entries} />
    </section>
  );
}
