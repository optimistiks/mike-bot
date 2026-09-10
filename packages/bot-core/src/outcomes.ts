type ScoringOutcome = { kind: "accepted"; text: string } | { kind: "ignored" };

type StandingsOutcome = { kind: "posted"; text: string } | { kind: "empty" };

type ChatOutcome = { kind: "reply"; text: string } | { kind: "silence" };

type HandlerResult =
  | ({ type: "scoring" } & ScoringOutcome)
  | ({ type: "standings" } & StandingsOutcome)
  | ({ type: "chat" } & ChatOutcome)
  | { type: "noop" };

export type { ChatOutcome, HandlerResult, ScoringOutcome, StandingsOutcome };
