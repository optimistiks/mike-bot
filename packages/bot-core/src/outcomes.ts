import type { MessageEntity } from "grammy/types";

type ScoringOutcome = { kind: "accepted"; text: string } | { kind: "ignored" };

type StandingsOutcome = { kind: "posted"; text: string } | { kind: "empty" };

interface ChatReply {
  entities?: MessageEntity[];
  kind: "reply";
  linkPreviewDisabled?: true;
  text: string;
}

type ChatOutcome = ChatReply | { kind: "silence" };

type HandlerResult =
  | ({ type: "scoring" } & ScoringOutcome)
  | ({ type: "standings" } & StandingsOutcome)
  | ({ type: "chat" } & ChatOutcome)
  | { type: "noop" };

export type { ChatOutcome, HandlerResult, ScoringOutcome, StandingsOutcome };
