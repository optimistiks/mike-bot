interface ReplyMark {
  quote: string | null;
  targetLabel: string;
}

interface MemberTurn {
  role: "member";
  label: string;
  memberId: number | null;
  postedAt: Date;
  reply: ReplyMark | null;
  text: string;
}

interface AssistantTurn {
  role: "assistant";
  postedAt: Date;
  reply: ReplyMark;
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
  conversationId: string;
  memberId: number;
  now: Date;
  speakers: SpeakerIdentity[];
  turns: ConversationTurn[];
}

interface PromptMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export type {
  ConversationCompleteInput,
  ConversationTurn,
  PromptMessage,
  ReplyMark,
  SpeakerIdentity,
};
