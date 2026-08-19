import { sql } from "drizzle-orm";
import { reset, seed } from "drizzle-seed";

import type { EventType } from "@/lib/domain/event";

import type { AppDatabase } from "./runtime";
import {
  chatMembers,
  chatMemberships,
  events,
  registrationMessages,
  schema,
} from "./schema";

export const PRIMARY_FIXTURE_CHAT_ID = -100_456_789;
export const SECONDARY_FIXTURE_CHAT_ID = -100_987_654;
export const REGISTERED_PERSONA_ID = 101;
export const UNREGISTERED_PERSONA_ID = 104;
export const FORBIDDEN_PERSONA_ID = 105;

const FIXTURE_GENERATOR_SEED = 42_424;
const MOSCOW_UTC_OFFSET_HOURS = 3;

const MEMBERS = [
  { chatId: PRIMARY_FIXTURE_CHAT_ID, userId: 101, displayName: "@alice" },
  { chatId: PRIMARY_FIXTURE_CHAT_ID, userId: 102, displayName: "@bob" },
  { chatId: PRIMARY_FIXTURE_CHAT_ID, userId: 103, displayName: "@carol" },
  {
    chatId: PRIMARY_FIXTURE_CHAT_ID,
    userId: UNREGISTERED_PERSONA_ID,
    displayName: "@unregistered",
  },
  {
    chatId: SECONDARY_FIXTURE_CHAT_ID,
    userId: FORBIDDEN_PERSONA_ID,
    displayName: "@forbidden",
  },
] as const;

const MEMBERSHIPS = [
  { chatId: PRIMARY_FIXTURE_CHAT_ID, userId: REGISTERED_PERSONA_ID },
  { chatId: SECONDARY_FIXTURE_CHAT_ID, userId: FORBIDDEN_PERSONA_ID },
] as const;

const FIXTURE_EVENTS: readonly {
  type: EventType;
  actorId: number;
  subjectId: number;
  messageId: number;
  seasonOffset: number;
}[] = [
  {
    type: "karma.plus",
    actorId: 101,
    subjectId: 102,
    messageId: 1_001,
    seasonOffset: 0,
  },
  {
    type: "karma.plus",
    actorId: 103,
    subjectId: 102,
    messageId: 1_002,
    seasonOffset: 0,
  },
  {
    type: "karma.minus",
    actorId: 101,
    subjectId: 103,
    messageId: 1_003,
    seasonOffset: 0,
  },
  {
    type: "humor.add",
    actorId: 102,
    subjectId: 103,
    messageId: 1_004,
    seasonOffset: 0,
  },
  {
    type: "humor.add",
    actorId: 101,
    subjectId: 102,
    messageId: 1_005,
    seasonOffset: 0,
  },
  {
    type: "karma.plus",
    actorId: 101,
    subjectId: UNREGISTERED_PERSONA_ID,
    messageId: 1_006,
    seasonOffset: 0,
  },
  {
    type: "karma.undo.plus",
    actorId: 101,
    subjectId: UNREGISTERED_PERSONA_ID,
    messageId: 1_006,
    seasonOffset: 0,
  },
  {
    type: "karma.plus",
    actorId: 101,
    subjectId: 102,
    messageId: 2_001,
    seasonOffset: -1,
  },
  {
    type: "karma.minus",
    actorId: 102,
    subjectId: 103,
    messageId: 2_002,
    seasonOffset: -1,
  },
  {
    type: "humor.add",
    actorId: 103,
    subjectId: 101,
    messageId: 2_003,
    seasonOffset: -1,
  },
];

function moscowSeasonStart(now: Date, monthOffset: number): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "numeric",
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);

  return new Date(
    Date.UTC(year, month - 1 + monthOffset, 1, -MOSCOW_UTC_OFFSET_HOURS),
  );
}

async function seedMembers(db: AppDatabase): Promise<void> {
  for (const member of MEMBERS) {
    await seed(db, { chatMembers }, { seed: FIXTURE_GENERATOR_SEED }).refine(
      (generators) => ({
        chatMembers: {
          count: 1,
          columns: {
            chatId: generators.default({ defaultValue: member.chatId }),
            userId: generators.default({ defaultValue: member.userId }),
            displayName: generators.default({
              defaultValue: member.displayName,
            }),
          },
        },
      }),
    );
  }
}

async function seedMemberships(db: AppDatabase): Promise<void> {
  for (const membership of MEMBERSHIPS) {
    await seed(
      db,
      { chatMemberships },
      { seed: FIXTURE_GENERATOR_SEED },
    ).refine((generators) => ({
      chatMemberships: {
        count: 1,
        columns: {
          chatId: generators.default({ defaultValue: membership.chatId }),
          userId: generators.default({ defaultValue: membership.userId }),
        },
      },
    }));
  }
}

async function seedEvents(db: AppDatabase, now: Date): Promise<void> {
  for (const [index, event] of FIXTURE_EVENTS.entries()) {
    await seed(db, { events }, { seed: FIXTURE_GENERATOR_SEED }).refine(
      (generators) => ({
        events: {
          count: 1,
          columns: {
            id: generators.default({ defaultValue: index + 1 }),
            type: generators.default({ defaultValue: event.type }),
            chatId: generators.default({
              defaultValue: PRIMARY_FIXTURE_CHAT_ID,
            }),
            actorId: generators.default({ defaultValue: event.actorId }),
            subjectId: generators.default({ defaultValue: event.subjectId }),
            messageId: generators.default({ defaultValue: event.messageId }),
            createdAt: generators.default({
              defaultValue: moscowSeasonStart(now, event.seasonOffset),
            }),
            legacyId: generators.default({ defaultValue: undefined }),
          },
        },
      }),
    );
  }

  await db.execute(
    sql`SELECT setval(pg_get_serial_sequence('events', 'id'), (SELECT max(id) FROM events))`,
  );
}

async function seedRegistrationMessage(
  db: AppDatabase,
  now: Date,
): Promise<void> {
  await seed(
    db,
    { registrationMessages },
    { seed: FIXTURE_GENERATOR_SEED },
  ).refine((generators) => ({
    registrationMessages: {
      count: 1,
      columns: {
        chatId: generators.default({
          defaultValue: PRIMARY_FIXTURE_CHAT_ID,
        }),
        messageId: generators.default({ defaultValue: 9_001 }),
        createdAt: generators.default({
          defaultValue: moscowSeasonStart(now, 0),
        }),
      },
    },
  }));
}

export async function resetAndSeedDatabase(
  db: AppDatabase,
  now = new Date(),
): Promise<void> {
  await reset(db, schema);
  await seedMembers(db);
  await seedMemberships(db);
  await seedEvents(db, now);
  await seedRegistrationMessage(db, now);
}
