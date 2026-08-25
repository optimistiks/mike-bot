import { Api } from "grammy";
import { vi } from "vitest";

type ChatMember = Awaited<ReturnType<Api["getChatMember"]>>;

/**
 * Stand in for the one Telegram call administration is read from.
 *
 * Spying needs the prototype seen as a plain record: grammY builds its `Api`
 * methods generically, and `vi.spyOn` cannot pick a key out of that type.
 */
export function mockChatAdmins(adminIds: readonly number[]) {
  const prototype = Api.prototype as unknown as Record<
    "getChatMember",
    (chatId: number, userId: number) => Promise<ChatMember>
  >;

  return vi
    .spyOn(prototype, "getChatMember")
    .mockImplementation((_chatId, userId) =>
      Promise.resolve({
        status: adminIds.includes(userId) ? "administrator" : "member",
        user: { id: userId, is_bot: false, first_name: "Test" },
      } as ChatMember),
    );
}

/** Telegram refusing to answer at all. */
export function mockChatAdminsUnavailable() {
  const prototype = Api.prototype as unknown as Record<
    "getChatMember",
    () => Promise<ChatMember>
  >;

  return vi
    .spyOn(prototype, "getChatMember")
    .mockRejectedValue(new Error("timed out"));
}
