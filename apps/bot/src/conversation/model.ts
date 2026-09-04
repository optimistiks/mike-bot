import { generateText } from "ai";

import type { ConversationModel, ConversationTurn } from "./types.js";

import { CONVERSATION_MODEL, CONVERSATION_SYSTEM_PROMPT, trimTurnsForContext } from "./types.js";

const gatewayConversationModel: ConversationModel = {
  async complete(turns: ConversationTurn[]): Promise<string> {
    const history = trimTurnsForContext(turns);
    const { text } = await generateText({
      instructions: CONVERSATION_SYSTEM_PROMPT,
      maxRetries: 0,
      messages: history.map((turn) => ({
        content: turn.text,
        role: turn.role === "member" ? "user" : "assistant",
      })),
      model: CONVERSATION_MODEL,
      reasoning: "high",
      temperature: 0.9,
    });
    return text;
  },
};

export { gatewayConversationModel };
