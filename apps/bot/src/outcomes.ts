export type ScoringOutcome = { kind: "accepted"; text: string } | { kind: "ignored" };

export type StandingsOutcome = { kind: "posted"; text: string } | { kind: "empty" };

export type ConversationOutcome = { kind: "reply"; text: string } | { kind: "silence" };

export type HandlerResult =
  | ({ type: "scoring" } & ScoringOutcome)
  | ({ type: "standings" } & StandingsOutcome)
  | ({ type: "conversation" } & ConversationOutcome)
  | { type: "noop" };
