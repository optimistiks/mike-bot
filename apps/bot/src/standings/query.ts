import { eq } from "drizzle-orm";

import type { MarkType } from "../domain/mark";
import type { BotSession } from "../db/runtime";
import { marks, members } from "../db/schema";

export interface StandingRow {
  memberId: number;
  name: string;
  karmaReceived: number;
  humorReceived: number;
  karmaPlusGiven: number;
  karmaMinusGiven: number;
  humorGiven: number;
}

export async function loadStandingRows(db: BotSession, chatId: number): Promise<StandingRow[]> {
  const markRows = await db.select().from(marks).where(eq(marks.chatId, chatId));
  if (markRows.length === 0) {
    return [];
  }

  const byMember = new Map<number, StandingRow>();

  const member = (id: number): StandingRow => {
    const existing = byMember.get(id);
    if (existing) {
      return existing;
    }
    const created: StandingRow = {
      memberId: id,
      name: "???",
      karmaReceived: 0,
      humorReceived: 0,
      karmaPlusGiven: 0,
      karmaMinusGiven: 0,
      humorGiven: 0,
    };
    byMember.set(id, created);
    return created;
  };

  for (const mark of markRows) {
    applyMark(member(mark.subjectId), member(mark.actorId), parseMarkType(mark.type));
  }

  const identities = await db.select().from(members);
  const nameById = new Map(
    identities.map((row) => [row.telegramId, row.username ?? "???"] as const),
  );

  for (const row of byMember.values()) {
    row.name = nameById.get(row.memberId) ?? "???";
  }

  return [...byMember.values()];
}

function parseMarkType(type: string): MarkType {
  if (type === "karma.plus" || type === "karma.minus" || type === "humor.add") {
    return type;
  }
  throw new Error(`unknown Mark type ${type}`);
}

function applyMark(subject: StandingRow, actor: StandingRow, type: MarkType): void {
  switch (type) {
    case "karma.plus":
      subject.karmaReceived += 1;
      actor.karmaPlusGiven += 1;
      break;
    case "karma.minus":
      subject.karmaReceived -= 1;
      actor.karmaMinusGiven += 1;
      break;
    case "humor.add":
      subject.humorReceived += 1;
      actor.humorGiven += 1;
      break;
  }
}
