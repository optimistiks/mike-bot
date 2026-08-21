import type { PrototypeChat } from "../_lib/chats";
import type { PrototypeLeaderboard } from "../_lib/leaderboard-fixture.server";

import { SeasonLinks } from "./season-links";

/**
 * Plain, unstyled standings. Ticket 03 gives entries their three-line shape and
 * ticket 04 turns the five sections into a swipeable filmstrip; this stage is
 * only about the data being real, Chat-scoped, and Season-scoped.
 */
export function LeaderboardScreen({
  chat,
  leaderboard,
}: {
  chat: PrototypeChat;
  leaderboard: PrototypeLeaderboard;
}) {
  return (
    <div className="arcade-screen gap-6 overflow-y-auto px-4 py-8">
      <h1 className="arcade-text-md text-primary">{chat.name}</h1>

      <SeasonLinks chatId={chat.id} season={leaderboard.season} />

      {leaderboard.sections.map((section) => (
        <section key={section.id} className="flex flex-col gap-2">
          <h2 className="arcade-text-sm text-secondary">{section.title}</h2>
          <ol className="flex flex-col gap-1">
            {section.entries.map((entry, index) => (
              <li key={entry.userId} className="arcade-text-xs break-words">
                {index + 1}. {entry.displayName} — {entry.score}
                {entry.isCrown ? " 👑" : ""}
                {entry.isChicken ? " 🐔" : ""}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
