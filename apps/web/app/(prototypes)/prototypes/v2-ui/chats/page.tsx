import { ChatCard } from "../_components/chat-card";

const CHATS = [
  { id: "1", name: "Клуб пятничных созвонов", initials: "ПТ" },
  { id: "2", name: "Продуктовая кухня", initials: "ПК" },
  { id: "3", name: "Ночная смена", initials: "НС" },
  { id: "4", name: "Соседи по интернету", initials: "СИ" },
];

export default function ChatsPrototypePage() {
  return (
    <div className="arcade-screen gap-6 overflow-y-auto px-4 py-8">
      <h1 className="arcade-text-lg text-primary">Выбери чат</h1>
      <div className="flex flex-col gap-2">
        {CHATS.map((chat) => (
          <ChatCard
            key={chat.id}
            href="/prototypes/v2-ui/leaderboards"
            name={chat.name}
            initials={chat.initials}
          />
        ))}
      </div>
    </div>
  );
}
