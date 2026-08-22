# 06: Specify public Telegram reports

Type: prototype
Status: open
Blocked by: 02, 05, 12

## Question

Define the rich-message contract for successful Stats reports and failures in groups and supergroups. Select
the Telegram formatting mode, describe the fixed Current Season Leaderboard presentation, constrain free-form
reports to concise prose, and specify semantic chunking across consecutive public messages when necessary.

## Done when

- The answer includes representative Russian success, empty-result, unsupported-question, and tool-failure
  messages.
- Escaping and chunking preserve valid rich text and do not silently discard requested Members or categories.
- The command message is the public reply target and no ephemeral/private delivery path exists.
