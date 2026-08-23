import { reset, seed } from "drizzle-seed";

import type { MarkType } from "@/lib/domain/mark";
import { MOSCOW_UTC_OFFSET_HOURS } from "@/lib/scoring";

import type { AppDatabase } from "./runtime";
import {
  FORBIDDEN_PERSONA_ID,
  REGISTERED_PERSONA_ID,
  SEED_PERSONAS,
  UNREGISTERED_PERSONA_ID,
} from "./seed-personas";
import {
  chats,
  displayIdentities,
  marks,
  messageAuthors,
  registrations,
  schema,
} from "./schema";

export const PRIMARY_FIXTURE_CHAT_ID = -100_456_789;
export const SECONDARY_FIXTURE_CHAT_ID = -100_987_654;
export {
  FORBIDDEN_PERSONA_ID,
  REGISTERED_PERSONA_ID,
  UNREGISTERED_PERSONA_ID,
} from "./seed-personas";

const FIXTURE_GENERATOR_SEED = 42_424;

const DISPLAY_IDENTITIES = [
  {
    chatId: PRIMARY_FIXTURE_CHAT_ID,
    userId: REGISTERED_PERSONA_ID,
    displayName: SEED_PERSONAS.registered.displayName,
  },
  { chatId: PRIMARY_FIXTURE_CHAT_ID, userId: 102, displayName: "@bob" },
  { chatId: PRIMARY_FIXTURE_CHAT_ID, userId: 103, displayName: "@carol" },
  {
    chatId: PRIMARY_FIXTURE_CHAT_ID,
    userId: UNREGISTERED_PERSONA_ID,
    displayName: SEED_PERSONAS.unregistered.displayName,
  },
  {
    chatId: SECONDARY_FIXTURE_CHAT_ID,
    userId: FORBIDDEN_PERSONA_ID,
    displayName: SEED_PERSONAS.forbidden.displayName,
  },
] as const;

const REGISTRATIONS = [
  { chatId: PRIMARY_FIXTURE_CHAT_ID, userId: REGISTERED_PERSONA_ID },
  { chatId: SECONDARY_FIXTURE_CHAT_ID, userId: FORBIDDEN_PERSONA_ID },
] as const;

const CHATS = [
  { chatId: PRIMARY_FIXTURE_CHAT_ID, title: "Клуб пятничных созвонов" },
  { chatId: SECONDARY_FIXTURE_CHAT_ID, title: "Ночная смена" },
] as const;

const FIXTURE_MARKS: readonly {
  type: MarkType;
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

async function seedDisplayIdentities(db: AppDatabase): Promise<void> {
  for (const identity of DISPLAY_IDENTITIES) {
    await seed(
      db,
      { displayIdentities },
      { seed: FIXTURE_GENERATOR_SEED },
    ).refine((generators) => ({
      displayIdentities: {
        count: 1,
        columns: {
          chatId: generators.default({ defaultValue: identity.chatId }),
          userId: generators.default({ defaultValue: identity.userId }),
          displayName: generators.default({
            defaultValue: identity.displayName,
          }),
        },
      },
    }));
  }
}

async function seedRegistrations(db: AppDatabase): Promise<void> {
  for (const registration of REGISTRATIONS) {
    await seed(db, { registrations }, { seed: FIXTURE_GENERATOR_SEED }).refine(
      (generators) => ({
        registrations: {
          count: 1,
          columns: {
            chatId: generators.default({ defaultValue: registration.chatId }),
            userId: generators.default({ defaultValue: registration.userId }),
          },
        },
      }),
    );
  }
}

async function seedMarks(db: AppDatabase, now: Date): Promise<void> {
  for (const mark of FIXTURE_MARKS) {
    const messageDate = moscowSeasonStart(now, mark.seasonOffset);

    await db.insert(marks).values({
      type: mark.type,
      chatId: PRIMARY_FIXTURE_CHAT_ID,
      actorId: mark.actorId,
      subjectId: mark.subjectId,
      messageId: mark.messageId,
      createdAt: messageDate,
      source: "reaction",
    });

    await db
      .insert(messageAuthors)
      .values({
        chatId: PRIMARY_FIXTURE_CHAT_ID,
        messageId: mark.messageId,
        authorId: mark.subjectId,
        authorIsBot: false,
        messageDate: Math.floor(messageDate.getTime() / 1000),
      })
      .onConflictDoNothing();
  }
}

export async function resetAndSeedDatabase(
  db: AppDatabase,
  now = new Date(),
): Promise<void> {
  await reset(db, schema);
  await db
    .insert(chats)
    .values(CHATS.map((chat) => ({ ...chat, metadataCheckedAt: now })));
  await seedDisplayIdentities(db);
  await seedRegistrations(db);
  await seedMarks(db, now);
}
