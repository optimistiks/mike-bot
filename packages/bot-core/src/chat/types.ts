interface ReplyMark {
  quote: string | null;
  targetLabel: string;
  targetMessageId: number | null;
  targetPostedAt: Date | null;
}

interface MemberTurn {
  role: "member";
  label: string;
  memberId: number | null;
  messageId: number | null;
  postedAt: Date;
  reply: ReplyMark | null;
  text: string;
}

interface AssistantTurn {
  role: "assistant";
  messageId: number | null;
  postedAt: Date;
  reply: ReplyMark;
  text: string;
}

type ChatTurn = MemberTurn | AssistantTurn;

interface SpeakerIdentity {
  handle: string;
  firstName: string | null;
  lastName: string | null;
}

interface ChatCompleteInput {
  addresseeLabel: string;
  memberId: number;
  now: Date;
  sentryConversationId: string;
  speakers: SpeakerIdentity[];
  turns: ChatTurn[];
}

interface PromptMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export type { ChatCompleteInput, ChatTurn, PromptMessage, ReplyMark, SpeakerIdentity };
