import type { SQL } from "drizzle-orm";

import { and, eq, sql } from "drizzle-orm";

import type { BotSession } from "#src/db/runtime.js";
import type { MarkType } from "#src/domain/mark.js";

import { marks, members, messages } from "#src/db/schema.js";

import { MOSCOW_TIME_ZONE } from "./year.js";

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
    subject.humorReceived += 1;
    actor.humorGiven += 1;
  },
  "karma.minus": (subject, actor) => {
    subject.karmaReceived -= 1;
    actor.karmaMinusGiven += 1;
  },
  "karma.plus": (subject, actor) => {
    subject.karmaReceived += 1;
    actor.karmaPlusGiven += 1;
  },
};

function emptyStandingRow(id: number): StandingRow {
  return {
    humorGiven: 0,
    humorReceived: 0,
    karmaMinusGiven: 0,
    karmaPlusGiven: 0,
    karmaReceived: 0,
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

function moscowYearContains(year: number): SQL {
  return sql`${messages.postedAt} >= make_timestamp(${year}, 1, 1, 0, 0, 0) AT TIME ZONE ${MOSCOW_TIME_ZONE} AND ${messages.postedAt} < make_timestamp(${year + 1}, 1, 1, 0, 0, 0) AT TIME ZONE ${MOSCOW_TIME_ZONE}`;
}

async function loadMarkRows(db: BotSession, chatId: number, year: number): Promise<MarkRow[]> {
  const rows = await db
    .select({ mark: marks })
    .from(marks)
    .innerJoin(
      messages,
      and(eq(marks.chatId, messages.chatId), eq(marks.messageId, messages.messageId)),
    )
    .where(and(eq(marks.chatId, chatId), moscowYearContains(year)));
  return rows.map((row) => row.mark);
}

async function loadStandingRows(
  db: BotSession,
  chatId: number,
  year: number,
): Promise<StandingRow[]> {
  const markRows = await loadMarkRows(db, chatId, year);
  if (markRows.length === 0) {
    return [];
  }
  return standingRowsFromMarks(db, markRows);
}

export { loadStandingRows, type StandingRow };
