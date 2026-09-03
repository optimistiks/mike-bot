import type { StandingsOutcome } from "../outcomes.js";
import type { BotSession } from "../db/runtime.js";
import { chatHasMarks } from "../db/store.js";
import { formatStandings } from "./format.js";
import { loadStandingRows } from "./query.js";

export async function applyStandings(db: BotSession, chatId: number): Promise<StandingsOutcome> {
  if (!(await chatHasMarks(db, chatId))) {
    return { kind: "empty" };
  }

  const rows = await loadStandingRows(db, chatId);
  return { kind: "posted", text: formatStandings(rows) };
}
