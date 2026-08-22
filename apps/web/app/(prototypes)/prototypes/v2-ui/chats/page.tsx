import { getCurrentSeason } from "@/lib/scoring";

import { PROTOTYPE_CHATS } from "../_lib/chats";
import { leaderboardHref } from "../_lib/seasons";
import { ChatCard } from "../_components/chat-card";

export default function ChatsPrototypePage() {
  // Straight at the Current Season's own URL rather than at the Season-less
  // route that redirects to it. The redirect is still there for anyone who
  // types the short URL, but routing a tap through it costs the morph: the
  // destination has to render in the same commit as the navigation for React to
  // pair the Chat card with the header, and a redirect breaks that.
  const currentSeason = getCurrentSeason();

  return (
    <div className="arcade-screen gap-6 overflow-y-auto px-4 py-8">
      <h1 className="arcade-text-lg text-primary">Выбери чат</h1>
      <div className="flex flex-col gap-2">
        {PROTOTYPE_CHATS.map((chat) => (
          <ChatCard
            key={chat.id}
            chatId={chat.id}
            href={leaderboardHref(chat.id, currentSeason)}
            name={chat.name}
            initials={chat.initials}
          />
        ))}
      </div>
    </div>
  );
}
