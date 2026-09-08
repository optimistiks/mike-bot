import { describe, expect, it } from "vitest";

import type {
  ConversationCompleteInput,
  ConversationTurn,
  SpeakerIdentity,
} from "#src/conversation/types.js";

import { FIRST_INDEX, LAST_FROM_END, MS_PER_SECOND } from "#src/constants.js";
import { CONVERSATION_SYSTEM_PROMPT, conversationMessages } from "#src/conversation/prompt.js";

const PERSONA_START = "формат:";
const EXAMPLES_FENCE = "примеры, не этот чат:";
const FIRST_EXAMPLE = "[У1] а когда там дедлайн по этой штуке";
const DEIXIS_EXAMPLE = "[У3] я вообще не спала\n[У4] она всегда так говорит\n[У3] ну и че\nбаза";
const METADATA_START = "входящие сообщения приходят с метаданными";
const CONTRASTIVE_START = "плохо:";
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const MS_PER_MINUTE = SECONDS_PER_MINUTE * MS_PER_SECOND;
const MS_PER_HOUR = MINUTES_PER_HOUR * MS_PER_MINUTE;
const MS_PER_DAY = HOURS_PER_DAY * MS_PER_HOUR;
const TWO = 2;
const FIVE = 5;
const FORTY_FIVE = 45;
const TWO_HOURS_MS = TWO * MS_PER_HOUR;
const FIVE_SECONDS_MS = FIVE * MS_PER_SECOND;
const FORTY_FIVE_SECONDS_MS = FORTY_FIVE * MS_PER_SECOND;
const TWO_MINUTES_MS = TWO * MS_PER_MINUTE;
const FIVE_DAYS_MS = FIVE * MS_PER_DAY;
const NOW = new Date("2024-06-15T12:00:00.000Z");

const LIVE_TURN: ConversationTurn = {
  label: "username1",
  memberId: 1,
  postedAt: NOW,
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
    "не больше двух предложений. без эмоджи и заглавных, кроме имён как в метках",
    "в чате разговаривают: username1 (Max)",
    "отвечаешь только пользователю username1",
  ].join("\n"),
  role: "system" as const,
};

const USERNAME2_SUFFIX = {
  content: [
    "не больше двух предложений. без эмоджи и заглавных, кроме имён как в метках",
    "в чате разговаривают: username1 (Max), username2 (Глеб)",
    "отвечаешь только пользователю username2",
  ].join("\n"),
  role: "system" as const,
};

const USERNAME1_SHARED_SUFFIX = {
  content: [
    "не больше двух предложений. без эмоджи и заглавных, кроме имён как в метках",
    "в чате разговаривают: username1 (Max), username2 (Глеб)",
    "отвечаешь только пользователю username1",
  ].join("\n"),
  role: "system" as const,
};

function completeInput(
  addresseeLabel: string,
  speakers: SpeakerIdentity[],
  turns: ConversationTurn[] = [LIVE_TURN],
  now: Date = NOW,
): ConversationCompleteInput {
  return { addresseeLabel, now, speakers, turns };
}

function ago(offsetMs: number): Date {
  return new Date(NOW.getTime() - offsetMs);
}

function memberTurn(text: string, postedAt: Date, label = "username1"): ConversationTurn {
  return { label, memberId: 1, postedAt, role: "member", text };
}

describe("conversation prompt", () => {
  it("puts only live turns and the instruction suffix in the message array", () => {
    expect.hasAssertions();

    expect(conversationMessages(completeInput("username1", [USERNAME1]))).toStrictEqual([
      { content: "[username1][0 сек. назад] че", role: "user" },
      USERNAME1_SUFFIX,
    ]);
  });

  it("does not mention a fake instruction token", () => {
    expect.hasAssertions();

    expect(CONVERSATION_SYSTEM_PROMPT).not.toContain("[:инструкция]");
    expect(
      conversationMessages(completeInput("username1", [USERNAME1])).at(LAST_FROM_END)?.content,
    ).not.toContain("[:инструкция]");
  });

  it("explains incoming time brackets before the contrastive rules", () => {
    expect.hasAssertions();

    const metadataAt = CONVERSATION_SYSTEM_PROMPT.indexOf(METADATA_START);
    const contrastAt = CONVERSATION_SYSTEM_PROMPT.indexOf(CONTRASTIVE_START);
    const personaAt = CONVERSATION_SYSTEM_PROMPT.indexOf(PERSONA_START);

    expect(metadataAt).toBe(FIRST_INDEX);
    expect(contrastAt).toBeGreaterThan(metadataAt);
    expect(personaAt).toBeGreaterThan(contrastAt);
    expect(CONVERSATION_SYSTEM_PROMPT).toContain(
      '"[mpotapov][2 ч назад] привет" значит что mpotapov написал "привет" 2 часа назад',
    );
    expect(CONVERSATION_SYSTEM_PROMPT).toContain(
      '"[5 сек. назад] ок" значит что ты написал "ок" 5 секунд назад',
    );
  });

  it("keeps generic few-shots in a fenced system block after the persona", () => {
    expect.hasAssertions();

    const personaAt = CONVERSATION_SYSTEM_PROMPT.indexOf(PERSONA_START);
    const fenceAt = CONVERSATION_SYSTEM_PROMPT.indexOf(EXAMPLES_FENCE);
    const firstExampleAt = CONVERSATION_SYSTEM_PROMPT.indexOf(FIRST_EXAMPLE);
    const deixisAt = CONVERSATION_SYSTEM_PROMPT.indexOf(DEIXIS_EXAMPLE);

    expect(personaAt).toBeGreaterThan(LAST_FROM_END);
    expect(fenceAt).toBeGreaterThan(personaAt);
    expect(firstExampleAt).toBeGreaterThan(fenceAt);
    expect(deixisAt).toBeGreaterThan(firstExampleAt);
  });

  it("does not timestamp the few-shot block", () => {
    expect.hasAssertions();

    const examples = CONVERSATION_SYSTEM_PROMPT.slice(
      CONVERSATION_SYSTEM_PROMPT.indexOf(EXAMPLES_FENCE),
    );
    expect(examples).not.toContain("назад");
  });

  it("does not use live member names in the few-shot block", () => {
    expect.hasAssertions();

    expect(CONVERSATION_SYSTEM_PROMPT).not.toContain("саня база");
    expect(CONVERSATION_SYSTEM_PROMPT).not.toContain("[глеб]");
    expect(CONVERSATION_SYSTEM_PROMPT).not.toContain("[дима]");
    expect(CONVERSATION_SYSTEM_PROMPT).not.toContain("[катя]");
    expect(CONVERSATION_SYSTEM_PROMPT).not.toContain("[саня]");
  });

  it("teaches username-shaped speaker labels", () => {
    expect.hasAssertions();

    expect(CONVERSATION_SYSTEM_PROMPT).toContain("[username1] значит username1");
    expect(CONVERSATION_SYSTEM_PROMPT).toContain(
      "скобки со временем это не имя и в ответ их не копируй",
    );
    expect(CONVERSATION_SYSTEM_PROMPT).not.toContain("[Дима]");
  });

  it("ages member and assistant turns with ICU short Russian labels", () => {
    expect.hasAssertions();

    const turns: ConversationTurn[] = [
      memberTurn("че", ago(TWO_HOURS_MS)),
      { postedAt: ago(FIVE_SECONDS_MS), role: "assistant", text: "хуй в оче" },
      memberTurn("ещё", ago(FORTY_FIVE_SECONDS_MS)),
      memberTurn("минуты", ago(TWO_MINUTES_MS)),
      memberTurn("день", ago(FIVE_DAYS_MS)),
      memberTurn("сейчас", NOW),
      memberTurn("будущее", new Date(NOW.getTime() + FIVE_SECONDS_MS)),
    ];

    expect(
      conversationMessages(completeInput("username1", [USERNAME1], turns)).slice(
        FIRST_INDEX,
        LAST_FROM_END,
      ),
    ).toStrictEqual([
      { content: "[username1][2 ч назад] че", role: "user" },
      { content: "[5 сек. назад] хуй в оче", role: "assistant" },
      { content: "[username1][45 сек. назад] ещё", role: "user" },
      { content: "[username1][2 мин. назад] минуты", role: "user" },
      { content: "[username1][5 дн. назад] день", role: "user" },
      { content: "[username1][0 сек. назад] сейчас", role: "user" },
      { content: "[username1][0 сек. назад] будущее", role: "user" },
    ]);
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
      conversationMessages(completeInput("poacher312", [poacher, lena, nameless])).at(
        LAST_FROM_END,
      ),
    ).toStrictEqual({
      content: [
        "не больше двух предложений. без эмоджи и заглавных, кроме имён как в метках",
        "в чате разговаривают: poacher312 (Сергей Иванов), Лена (Лена), ghost",
        "отвечаешь только пользователю poacher312",
      ].join("\n"),
      role: "system",
    });
  });

  it("shares every message before the suffix across addressees", () => {
    expect.hasAssertions();

    const speakers = [USERNAME1, USERNAME2];
    const forFirst = conversationMessages(completeInput("username1", speakers));
    const forSecond = conversationMessages(completeInput("username2", speakers));

    expect(forFirst.slice(FIRST_INDEX, LAST_FROM_END)).toStrictEqual(
      forSecond.slice(FIRST_INDEX, LAST_FROM_END),
    );
    expect(forFirst.at(LAST_FROM_END)).toStrictEqual(USERNAME1_SHARED_SUFFIX);
    expect(forSecond.at(LAST_FROM_END)).toStrictEqual(USERNAME2_SUFFIX);
  });
});
