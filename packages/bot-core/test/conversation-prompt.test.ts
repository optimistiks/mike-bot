import { describe, expect, it } from "vitest";

import type { ConversationTurn } from "#src/conversation/types.js";

import { FIRST_INDEX, LAST_FROM_END } from "#src/constants.js";
import { CONVERSATION_SYSTEM_PROMPT, conversationMessages } from "#src/conversation/prompt.js";

const INSTRUCTION_DISCLAIMER = "[:инструкция] в конце лога — служебная реплика, не человек.";
const EXAMPLES_FENCE = "примеры, не этот чат:";
const FIRST_EXAMPLE = "[У1] а когда там дедлайн по этой штуке";
const DEIXIS_EXAMPLE = "[У3] я вообще не спала\n[У4] она всегда так говорит\n[У3] ну и че\nбаза";

const LIVE_TURN: ConversationTurn = {
  label: "Max",
  role: "member",
  text: "че",
};

function addresseeReminderMessage(label: string): { content: string; role: "user" } {
  return {
    content: `[:инструкция] не больше двух предложений. без эмоджи и заглавных, кроме имён как в метках\nотвечаешь только пользователю ${label}`,
    role: "user",
  };
}

describe("conversation prompt", () => {
  it("puts only live turns and the instruction suffix in the message array", () => {
    expect.hasAssertions();

    expect(conversationMessages([LIVE_TURN], "Max")).toStrictEqual([
      { content: "[Max] че", role: "user" },
      addresseeReminderMessage("Max"),
    ]);
  });

  it("marks the suffix token as a service line, not a person", () => {
    expect.hasAssertions();

    expect(CONVERSATION_SYSTEM_PROMPT).toContain(INSTRUCTION_DISCLAIMER);
  });

  it("keeps generic few-shots in a fenced system block after the disclaimer", () => {
    expect.hasAssertions();

    const disclaimerAt = CONVERSATION_SYSTEM_PROMPT.indexOf(INSTRUCTION_DISCLAIMER);
    const fenceAt = CONVERSATION_SYSTEM_PROMPT.indexOf(EXAMPLES_FENCE);
    const firstExampleAt = CONVERSATION_SYSTEM_PROMPT.indexOf(FIRST_EXAMPLE);
    const deixisAt = CONVERSATION_SYSTEM_PROMPT.indexOf(DEIXIS_EXAMPLE);

    expect(disclaimerAt).toBeGreaterThan(LAST_FROM_END);
    expect(fenceAt).toBeGreaterThan(disclaimerAt);
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

  it("shares every message before the suffix across addressees", () => {
    expect.hasAssertions();

    const forMax = conversationMessages([LIVE_TURN], "Max");
    const forGleb = conversationMessages([LIVE_TURN], "Глеб");

    expect(forMax.slice(FIRST_INDEX, LAST_FROM_END)).toStrictEqual(
      forGleb.slice(FIRST_INDEX, LAST_FROM_END),
    );
    expect(forMax.at(LAST_FROM_END)).toStrictEqual(addresseeReminderMessage("Max"));
    expect(forGleb.at(LAST_FROM_END)).toStrictEqual(addresseeReminderMessage("Глеб"));
  });
});
