import type { StandingsOutcome } from "../outcomes";
import type { BotSession } from "../db/runtime";
import { chatHasMarks } from "../db/store";
import { formatStandings } from "./format";
import { loadStandingRows } from "./query";

export async function applyStandings(db: BotSession, chatId: number): Promise<StandingsOutcome> {
  if (!(await chatHasMarks(db, chatId))) {
    return { kind: "empty" };
  }

  const rows = await loadStandingRows(db, chatId);
  return { kind: "posted", text: formatStandings(rows) };
}
