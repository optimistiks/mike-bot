import type { BotSession } from "#src/db/runtime.js";
import type { StandingsOutcome } from "#src/outcomes.js";

import { chatHasMarks } from "#src/db/store.js";

import { formatStandings } from "./format.js";
import { loadStandingRows } from "./query.js";

async function applyStandings(db: BotSession, chatId: number): Promise<StandingsOutcome> {
  if (!(await chatHasMarks(db, chatId))) {
    return { kind: "empty" };
  }

  const rows = await loadStandingRows(db, chatId);
  return { kind: "posted", text: formatStandings(rows) };
}

export { applyStandings };
