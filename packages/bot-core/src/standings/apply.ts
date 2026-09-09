import type { BotSession } from "#src/db/runtime.js";
import type { StandingsOutcome } from "#src/outcomes.js";

import { formatStandings } from "./format.js";
import { loadStandingRows } from "./query.js";

async function applyStandings(db: BotSession, chatId: number): Promise<StandingsOutcome> {
  const rows = await loadStandingRows(db, chatId);
  if (rows.length === 0) {
    return { kind: "empty" };
  }
  return { kind: "posted", text: formatStandings(rows) };
}

export { applyStandings };
