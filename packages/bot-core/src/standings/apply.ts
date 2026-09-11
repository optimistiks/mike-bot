import type { Message } from "grammy/types";

import type { BotDatabase, BotSession } from "#src/db/runtime.js";
import type { StandingsOutcome } from "#src/outcomes.js";

import { commandReplyMark, persistStandingsAssistantTurn } from "#src/chat/apply.js";
import { telegramDateToPostedAt } from "#src/telegram/identity.js";
import { botCommand } from "#src/telegram/text.js";

import { formatStandings, formatStandingsLine } from "./format.js";
import { loadStandingRows } from "./query.js";
import { standingsYear } from "./year.js";

interface PostedStandings {
  html: string;
  line: string;
}

async function postedStandings(db: BotSession, message: Message): Promise<PostedStandings | null> {
  const command = botCommand(message);
  const year = standingsYear(command?.firstArg, telegramDateToPostedAt(message.date));
  if (year === null) {
    return null;
  }
  const rows = await loadStandingRows(db, message.chat.id, year);
  if (rows.length === 0) {
    return null;
  }
  return { html: formatStandings(rows, year), line: formatStandingsLine(rows, year) };
}

async function applyStandings(db: BotSession, message: Message): Promise<StandingsOutcome> {
  const posted = await postedStandings(db, message);
  if (posted === null) {
    return { kind: "empty" };
  }
  return { kind: "posted", text: posted.html };
}

async function persistPostedStandings(
  db: BotDatabase,
  message: Message,
  sent: { date: number; message_id: number },
): Promise<void> {
  const posted = await postedStandings(db, message);
  if (posted === null) {
    return;
  }
  await persistStandingsAssistantTurn(db, {
    chatId: message.chat.id,
    messageId: sent.message_id,
    postedAt: telegramDateToPostedAt(sent.date),
    reply: commandReplyMark(message),
    text: posted.line,
  });
}

export { applyStandings, persistPostedStandings };
