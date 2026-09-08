interface MemberTurn {
  role: "member";
  label: string;
  memberId: number | null;
  postedAt: Date;
  text: string;
}

interface AssistantTurn {
  role: "assistant";
  postedAt: Date;
  text: string;
}

type ConversationTurn = MemberTurn | AssistantTurn;

interface SpeakerIdentity {
  handle: string;
  firstName: string | null;
  lastName: string | null;
}

interface ConversationCompleteInput {
  addresseeLabel: string;
  now: Date;
  speakers: SpeakerIdentity[];
  turns: ConversationTurn[];
}

interface ConversationModel {
  complete: (input: ConversationCompleteInput) => Promise<string>;
}

interface PromptMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export type {
  ConversationCompleteInput,
  ConversationModel,
  ConversationTurn,
  PromptMessage,
  SpeakerIdentity,
};
