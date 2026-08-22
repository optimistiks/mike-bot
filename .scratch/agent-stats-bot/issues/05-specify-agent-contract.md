# 05: Specify the agent and tool contract

Type: task
Status: open
Blocked by: 01, 03, 04, 12

## Question

Turn the settled product behavior and the proven database boundary into an exact agent contract: system
prompt, model configuration, Zod tool schemas, hidden trusted context, schema/business context, one-shot
step limit, SQL error-repair policy, terminal failure behavior, and the final output boundary chosen in
[Decide the model output contract](12-decide-model-output-contract.md).

The same flow must handle an empty Stats question as the Current Season five-category Leaderboard. Defaults
must be broad, responses brief, and questions outside current-Chat scoring statistics rejected with a public
explanation.

## Done when

- The answer contains implementation-ready prompt and tool contracts without application code.
- It defines one transport-independent agent flow used by bare `/stats`, free-form `/stats`, and the direct
  development Stats harness.
- The model dependency is injectable so scripted deterministic model behavior can exercise the complete
  pipeline without an AI Gateway request.
- It states exactly what the model may retry once and what ends in an explanation.
