import { describe, expect, it } from "vitest";

import type { ChatCompleteInput, ChatTurn, SpeakerIdentity } from "#src/chat/types.js";

import { chatMessages } from "#src/chat/prompt.js";

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const NOW = new Date("2024-06-15T12:00:00.000Z");

const LIVE_TURN: ChatTurn = {
  label: "username1",
  memberId: 1,
  postedAt: NOW,
  reply: null,
  role: "member",
  text: "че",
};

const USERNAME1: SpeakerIdentity = {
  firstName: "Max",
  handle: "username1",
  lastName: null,
};

const USERNAME2: SpeakerIdentity = {
  firstName: "Глеб",
  handle: "username2",
  lastName: null,
};

const USERNAME1_SUFFIX = {
  content: [
    "как в неформальной переписке онлайн. без эмоджи. имена как в метках",
    "в чате разговаривают: username1 (Max)",
    "отвечаешь только пользователю username1",
  ].join("\n"),
  role: "system" as const,
};

const USERNAME2_SUFFIX = {
  content: [
    "как в неформальной переписке онлайн. без эмоджи. имена как в метках",
    "в чате разговаривают: username1 (Max), username2 (Глеб)",
    "отвечаешь только пользователю username2",
  ].join("\n"),
  role: "system" as const,
};

const USERNAME1_SHARED_SUFFIX = {
  content: [
    "как в неформальной переписке онлайн. без эмоджи. имена как в метках",
    "в чате разговаривают: username1 (Max), username2 (Глеб)",
    "отвечаешь только пользователю username1",
  ].join("\n"),
  role: "system" as const,
};

function completeInput(
  addresseeLabel: string,
  speakers: SpeakerIdentity[],
  turns: ChatTurn[] = [LIVE_TURN],
  now: Date = NOW,
): ChatCompleteInput {
  return { addresseeLabel, memberId: 1, now, sentryConversationId: "sentry_test", speakers, turns };
}

function ago(offsetMs: number): Date {
  return new Date(NOW.getTime() - offsetMs);
}

function memberTurn(text: string, postedAt: Date, label = "username1"): ChatTurn {
  return { label, memberId: 1, postedAt, reply: null, role: "member", text };
}

function assistantTurn(
  text: string,
  postedAt: Date,
  targetLabel: string,
  quote: string | null,
): ChatTurn {
  return { postedAt, reply: { quote, targetLabel }, role: "assistant", text };
}

describe("chat prompt", () => {
  it("puts only live turns and the instruction suffix in the message array", () => {
    expect.hasAssertions();

    expect(chatMessages(completeInput("username1", [USERNAME1]))).toStrictEqual([
      { content: "[username1][0 сек. назад] че", role: "user" },
      USERNAME1_SUFFIX,
    ]);
  });

  it("ages member turns with ICU short Russian labels and labels assistant replies", () => {
    expect.hasAssertions();

    const turns: ChatTurn[] = [
      memberTurn("че", ago(2 * MS_PER_HOUR)),
      assistantTurn("хуй в оче", ago(5 * MS_PER_SECOND), "username1", "че"),
      memberTurn("ещё", ago(45 * MS_PER_SECOND)),
      memberTurn("минуты", ago(2 * MS_PER_MINUTE)),
      memberTurn("день", ago(5 * MS_PER_DAY)),
      memberTurn("сейчас", NOW),
      memberTurn("будущее", new Date(NOW.getTime() + 5 * MS_PER_SECOND)),
    ];

    expect(chatMessages(completeInput("username1", [USERNAME1], turns)).slice(0, -1)).toStrictEqual(
      [
        { content: "[username1][2 ч назад] че", role: "user" },
        {
          content: '[Ты → username1][5 сек. назад][на "че"] хуй в оче',
          role: "assistant",
        },
        { content: "[username1][45 сек. назад] ещё", role: "user" },
        { content: "[username1][2 мин. назад] минуты", role: "user" },
        { content: "[username1][5 дн. назад] день", role: "user" },
        { content: "[username1][0 сек. назад] сейчас", role: "user" },
        { content: "[username1][0 сек. назад] будущее", role: "user" },
      ],
    );
  });

  it("lists speakers in the suffix before the addressee", () => {
    expect.hasAssertions();

    const poacher: SpeakerIdentity = {
      firstName: "Сергей",
      handle: "poacher312",
      lastName: "Иванов",
    };
    const lena: SpeakerIdentity = {
      firstName: "Лена",
      handle: "Лена",
      lastName: null,
    };
    const nameless: SpeakerIdentity = {
      firstName: null,
      handle: "ghost",
      lastName: null,
    };

    expect(
      chatMessages(completeInput("poacher312", [poacher, lena, nameless])).at(-1),
    ).toStrictEqual({
      content: [
        "как в неформальной переписке онлайн. без эмоджи. имена как в метках",
        "в чате разговаривают: poacher312 (Сергей Иванов), Лена (Лена), ghost",
        "отвечаешь только пользователю poacher312",
      ].join("\n"),
      role: "system",
    });
  });

  it("shares every message before the suffix across addressees", () => {
    expect.hasAssertions();

    const speakers = [USERNAME1, USERNAME2];
    const forFirst = chatMessages(completeInput("username1", speakers));
    const forSecond = chatMessages(completeInput("username2", speakers));

    expect(forFirst.slice(0, -1)).toStrictEqual(forSecond.slice(0, -1));
    expect(forFirst.at(-1)).toStrictEqual(USERNAME1_SHARED_SUFFIX);
    expect(forSecond.at(-1)).toStrictEqual(USERNAME2_SUFFIX);
  });
});
