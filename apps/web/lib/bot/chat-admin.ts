import { Api } from "grammy";

import { isChatAdminStatus } from "@/lib/mini-app/membership-status";

import { telegramTimeout } from "./telegram-timeout";

/**
 * Whether Telegram says this Member administers this Chat.
 *
 * Asked live, every time. Administration is the gate on changing what a Chat
 * scores by, it is asked only when someone opens or saves the settings screen,
 * and a cache would answer the security question from stale data — so there is
 * nothing here to cache and nothing to invalidate.
 *
 * A Chat Telegram will not answer for is not administered by anyone as far as
 * this is concerned: refusing the save is the safe direction, and the call is
 * bounded so an unreachable Telegram cannot hold the request open.
 */
export async function isChatAdmin(
  chatId: number,
  userId: number,
  botToken: string,
): Promise<boolean> {
  try {
    const member = await new Api(botToken).getChatMember(
      chatId,
      userId,
      telegramTimeout(),
    );

    return isChatAdminStatus(member.status);
  } catch (error) {
    console.error("failed to read Chat administration", error);

    return false;
  }
}
