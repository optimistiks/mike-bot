import { eq } from "drizzle-orm";

import type { BotSession } from "#src/db/runtime.js";
import type { MarkType } from "#src/domain/mark.js";

import { EMPTY_COUNT, SINGLE_COUNT } from "#src/constants.js";
import { marks, members } from "#src/db/schema.js";

interface StandingRow {
  memberId: number;
  name: string;
  karmaReceived: number;
  humorReceived: number;
  karmaPlusGiven: number;
  karmaMinusGiven: number;
  humorGiven: number;
}

type MarkRow = typeof marks.$inferSelect;

const APPLY_MARK: Record<MarkType, (subject: StandingRow, actor: StandingRow) => void> = {
  "humor.add": (subject, actor) => {
    subject.humorReceived += SINGLE_COUNT;
    actor.humorGiven += SINGLE_COUNT;
  },
  "karma.minus": (subject, actor) => {
    subject.karmaReceived -= SINGLE_COUNT;
    actor.karmaMinusGiven += SINGLE_COUNT;
  },
  "karma.plus": (subject, actor) => {
    subject.karmaReceived += SINGLE_COUNT;
    actor.karmaPlusGiven += SINGLE_COUNT;
  },
};

function emptyStandingRow(id: number): StandingRow {
  return {
    humorGiven: EMPTY_COUNT,
    humorReceived: EMPTY_COUNT,
    karmaMinusGiven: EMPTY_COUNT,
    karmaPlusGiven: EMPTY_COUNT,
    karmaReceived: EMPTY_COUNT,
    memberId: id,
    name: "???",
  };
}

function isMarkType(type: string): type is MarkType {
  return type === "karma.plus" || type === "karma.minus" || type === "humor.add";
}

function parseMarkType(type: string): MarkType {
  if (isMarkType(type)) {
    return type;
  }
  throw new TypeError(`unknown Mark type ${type}`);
}

function applyMark(subject: StandingRow, actor: StandingRow, type: MarkType): void {
  APPLY_MARK[type](subject, actor);
}

function memberRow(byMember: Map<number, StandingRow>, id: number): StandingRow {
  const existing = byMember.get(id);
  if (existing !== undefined) {
    return existing;
  }
  const created = emptyStandingRow(id);
  byMember.set(id, created);
  return created;
}

async function applyMemberNames(db: BotSession, byMember: Map<number, StandingRow>): Promise<void> {
  const identities = await db.select().from(members);
  const nameById = new Map(
    identities.map((row) => [row.telegramId, row.username ?? "???"] as const),
  );
  for (const row of byMember.values()) {
    row.name = nameById.get(row.memberId) ?? "???";
  }
}

function accumulateMarks(markRows: MarkRow[], byMember: Map<number, StandingRow>): void {
  for (const mark of markRows) {
    applyMark(
      memberRow(byMember, mark.subjectId),
      memberRow(byMember, mark.actorId),
      parseMarkType(mark.type),
    );
  }
}

async function standingRowsFromMarks(db: BotSession, markRows: MarkRow[]): Promise<StandingRow[]> {
  const byMember = new Map<number, StandingRow>();
  accumulateMarks(markRows, byMember);
  await applyMemberNames(db, byMember);
  return [...byMember.values()];
}

async function loadStandingRows(db: BotSession, chatId: number): Promise<StandingRow[]> {
  const markRows = await db.select().from(marks).where(eq(marks.chatId, chatId));
  if (markRows.length === EMPTY_COUNT) {
    return [];
  }
  return standingRowsFromMarks(db, markRows);
}

export { loadStandingRows, type StandingRow };
