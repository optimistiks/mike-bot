import type { PrototypeChat } from "../_lib/chats";
import type { PrototypeLeaderboard } from "../_lib/leaderboard-fixture.server";

import { SeasonLinks } from "./season-links";
import { StandingsSection } from "./standings-section";

/**
 * The five sections, still stacked vertically. Ticket 04 turns them into a
 * full-bleed swipeable filmstrip under a pinned header; this stage is about the
 * standings entry's shape.
 */
export function LeaderboardScreen({
  chat,
  leaderboard,
}: {
  chat: PrototypeChat;
  leaderboard: PrototypeLeaderboard;
}) {
  return (
    <div className="arcade-screen gap-8 overflow-y-auto px-4 py-8">
      <h1 className="arcade-text-md text-primary">{chat.name}</h1>

      <SeasonLinks chatId={chat.id} season={leaderboard.season} />

      {leaderboard.sections.map((section) => (
        <StandingsSection key={section.id} section={section} />
      ))}
    </div>
  );
}
