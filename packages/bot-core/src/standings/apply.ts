import type { Message } from "grammy/types";

import type { BotSession } from "#src/db/runtime.js";
import type { StandingsOutcome } from "#src/outcomes.js";

import { telegramDateToPostedAt } from "#src/telegram/identity.js";
import { botCommand } from "#src/telegram/text.js";

import { formatStandings } from "./format.js";
import { loadStandingRows } from "./query.js";
import { standingsYear } from "./year.js";

async function applyStandings(db: BotSession, message: Message): Promise<StandingsOutcome> {
  const command = botCommand(message);
  const year = standingsYear(command?.firstArg, telegramDateToPostedAt(message.date));
  if (year === null) {
    return { kind: "empty" };
  }
  const rows = await loadStandingRows(db, message.chat.id, year);
  if (rows.length === 0) {
    return { kind: "empty" };
  }
  return { kind: "posted", text: formatStandings(rows, year) };
}

export { applyStandings };
