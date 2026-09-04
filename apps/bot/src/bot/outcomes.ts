type ScoringOutcome = { kind: "accepted"; text: string } | { kind: "ignored" };

type StandingsOutcome = { kind: "posted"; text: string } | { kind: "empty" };

type ConversationOutcome = { kind: "reply"; text: string } | { kind: "silence" };

type HandlerResult =
  | ({ type: "scoring" } & ScoringOutcome)
  | ({ type: "standings" } & StandingsOutcome)
  | ({ type: "conversation" } & ConversationOutcome)
  | { type: "noop" };

export type { ConversationOutcome, HandlerResult, ScoringOutcome, StandingsOutcome };
