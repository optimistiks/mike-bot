import { describe, expect, it } from "vitest";

import type { ChatCompleteInput, ChatTurn, SpeakerIdentity } from "#src/chat/types.js";

import { CHAT_SYSTEM_PROMPT, chatMessages } from "#src/chat/prompt.js";

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const NOW = new Date("2024-06-15T12:00:00.000Z");

const LIVE_TURN: ChatTurn = {
  label: "username1",
  memberId: 1,
  messageId: 1,
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
    "пиши как люди пишут в неформальной переписке онлайн. но без эмоджи. имена как в метках",
    "в чате разговаривают: username1 (Max)",
    "отвечаешь только пользователю username1",
  ].join("\n"),
  role: "system" as const,
};

const USERNAME2_SUFFIX = {
  content: [
    "пиши как люди пишут в неформальной переписке онлайн. но без эмоджи. имена как в метках",
    "в чате разговаривают: username1 (Max), username2 (Глеб)",
    "отвечаешь только пользователю username2",
  ].join("\n"),
  role: "system" as const,
};

const USERNAME1_SHARED_SUFFIX = {
  content: [
    "пиши как люди пишут в неформальной переписке онлайн. но без эмоджи. имена как в метках",
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
  return { label, memberId: 1, messageId: 1, postedAt, reply: null, role: "member", text };
}

function assistantTurn(
  text: string,
  postedAt: Date,
  targetLabel: string,
  quote: string | null,
): ChatTurn {
  return {
    messageId: 2,
    postedAt,
    reply: {
      quote,
      targetLabel,
      targetMessageId: 1,
      targetPostedAt: postedAt,
    },
    role: "assistant",
    text,
  };
}

describe("chat prompt", () => {
  it("puts only live turns and the instruction suffix in the message array", () => {
    expect.hasAssertions();

    expect(chatMessages(completeInput("username1", [USERNAME1]))).toStrictEqual([
      { content: "[username1][0 сек. назад]: че", role: "user" },
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
        { content: "[username1][2 ч назад]: че", role: "user" },
        {
          content: "[Ты][5 сек. назад] в ответ username1: хуй в оче",
          role: "assistant",
        },
        { content: "[username1][45 сек. назад]: ещё", role: "user" },
        { content: "[username1][2 мин. назад]: минуты", role: "user" },
        { content: "[username1][5 дн. назад]: день", role: "user" },
        { content: "[username1][0 сек. назад]: сейчас", role: "user" },
        { content: "[username1][0 сек. назад]: будущее", role: "user" },
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
        "пиши как люди пишут в неформальной переписке онлайн. но без эмоджи. имена как в метках",
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

  it("quotes an out-of-window reply with an absolute Moscow date", () => {
    expect.hasAssertions();

    const parentAt = new Date("2023-06-03T12:00:00.000Z");
    const turns: ChatTurn[] = [
      memberTurn("че", NOW),
      {
        messageId: 9,
        postedAt: NOW,
        reply: {
          quote: "напомни потом",
          targetLabel: "username2",
          targetMessageId: 500,
          targetPostedAt: parentAt,
        },
        role: "assistant",
        text: "позже",
      },
    ];

    expect(chatMessages(completeInput("username1", [USERNAME1], turns)).slice(0, -1)).toStrictEqual(
      [
        { content: "[username1][0 сек. назад]: че", role: "user" },
        {
          content:
            "[Ты][0 сек. назад] в ответ username2 от 3 июня в 15:00:\n> напомни потом\n\nпозже",
          role: "assistant",
        },
      ],
    );
  });

  it("describes the log format and new examples in the system prompt", () => {
    expect.hasAssertions();

    expect({
      absoluteExample: CHAT_SYSTEM_PROMPT.includes("от 3 июня в 15:00:"),
      arrow: CHAT_SYSTEM_PROMPT.includes("→"),
      format: CHAT_SYSTEM_PROMPT.includes(
        "реплика начинается с [говорящий], потом [время], потом в ответ имя если это ответ, потом текст",
      ),
      multilineExample: CHAT_SYSTEM_PROMPT.includes("икея и не думай"),
      name: CHAT_SYSTEM_PROMPT.includes(
        "тебя зовут Майк Литорис. ты в групповом чате где сидят только друзья которые давно друг друга знают",
      ),
      quoteTag: CHAT_SYSTEM_PROMPT.includes('[на "'),
      ty: CHAT_SYSTEM_PROMPT.includes('"Ты" это не имя'),
    }).toStrictEqual({
      absoluteExample: true,
      arrow: false,
      format: true,
      multilineExample: true,
      name: true,
      quoteTag: false,
      ty: true,
    });
  });
});
