import { PROTOTYPE_CHATS } from "../_lib/chats";
import { ChatCard } from "../_components/chat-card";

export default function ChatsPrototypePage() {
  return (
    <div className="arcade-screen gap-6 overflow-y-auto px-4 py-8">
      <h1 className="arcade-text-lg text-primary">Выбери чат</h1>
      <div className="flex flex-col gap-2">
        {PROTOTYPE_CHATS.map((chat) => (
          <ChatCard
            key={chat.id}
            href={`/prototypes/v2-ui/chats/${String(chat.id)}/leaderboards`}
            name={chat.name}
            initials={chat.initials}
          />
        ))}
      </div>
    </div>
  );
}
