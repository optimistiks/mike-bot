import { generateText } from "ai";

import {
  CONVERSATION_MODEL,
  CONVERSATION_SYSTEM_PROMPT,
  trimTurnsForContext,
  type ConversationModel,
  type ConversationTurn,
} from "./types";

export const gatewayConversationModel: ConversationModel = {
  async complete(turns: ConversationTurn[]): Promise<string> {
    const history = trimTurnsForContext(turns);
    const { text } = await generateText({
      model: CONVERSATION_MODEL,
      system: CONVERSATION_SYSTEM_PROMPT,
      messages: history.map((turn) => ({
        role: turn.role === "member" ? "user" : "assistant",
        content: turn.text,
      })),
    });
    return text;
  },
};
