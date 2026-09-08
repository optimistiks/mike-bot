import { describe, expect, it } from "vitest";

import type {
  ConversationCompleteInput,
  ConversationTurn,
  SpeakerIdentity,
} from "#src/conversation/types.js";

import { FIRST_INDEX, LAST_FROM_END } from "#src/constants.js";
import { CONVERSATION_SYSTEM_PROMPT, conversationMessages } from "#src/conversation/prompt.js";

const PERSONA_START = "формат:";
const EXAMPLES_FENCE = "примеры, не этот чат:";
const FIRST_EXAMPLE = "[У1] а когда там дедлайн по этой штуке";
const DEIXIS_EXAMPLE = "[У3] я вообще не спала\n[У4] она всегда так говорит\n[У3] ну и че\nбаза";

const LIVE_TURN: ConversationTurn = {
  label: "username1",
  memberId: 1,
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
): ConversationCompleteInput {
  return { addresseeLabel, speakers, turns };
}

describe("conversation prompt", () => {
  it("puts only live turns and the instruction suffix in the message array", () => {
    expect.hasAssertions();

    expect(conversationMessages(completeInput("username1", [USERNAME1]))).toStrictEqual([
      { content: "[username1] че", role: "user" },
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
    expect(CONVERSATION_SYSTEM_PROMPT).not.toContain("[Дима]");
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
