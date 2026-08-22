# 12: Decide the model output contract

Type: prototype
Status: open
Blocked by: 03, 04

## Question

Should the ToolLoopAgent produce free-form rich text, a Zod-validated Structured Output, or a smaller
structured envelope that a deterministic renderer turns into Telegram messages?

Evaluate necessity rather than feature availability. Use current AI SDK and selected-model documentation plus
static example outputs and a deterministic model double; do not call a real model. Compare:

- whether Structured Outputs compose cleanly with the required multi-step tool loop and SQL repair attempt;
- what must be deterministic for Telegram escaping, chunking, concise failures, and multi-message reports;
- whether a schema can express arbitrary Stats reports without becoming a second analytics language;
- validation/retry complexity and additional tokens versus the safety gained;
- model/provider portability if the free-tier selection changes.

Zod schemas for tool inputs are required independently of this decision. The question is only whether the
agent's final answer also benefits from Structured Outputs.

## Done when

- One final-output contract is chosen and illustrated with bare-Leaderboard, arbitrary-report, empty-result,
  and failure examples.
- The answer distinguishes documented support from demonstrated usefulness.
- The agent and Telegram-report tickets can proceed without making a real model request.

