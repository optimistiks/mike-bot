interface MemberTurn {
  role: "member";
  label: string;
  text: string;
}

interface AssistantTurn {
  role: "assistant";
  text: string;
}

type ConversationTurn = MemberTurn | AssistantTurn;

interface ConversationCompleteInput {
  addresseeLabel: string;
  turns: ConversationTurn[];
}

interface ConversationModel {
  complete: (input: ConversationCompleteInput) => Promise<string>;
}

interface PromptMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export type { ConversationCompleteInput, ConversationModel, ConversationTurn, PromptMessage };
