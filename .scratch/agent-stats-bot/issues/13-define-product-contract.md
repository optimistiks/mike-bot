# 13: Define the agent-driven bot product contract

Type: grilling
Status: resolved

## Question

What user-facing behavior and scope define the agent-driven Mike-bot destination before technical design
decisions are explored?

## Answer

- A separate Hono app in this monorepo becomes Mike-bot's sole active Telegram runtime on Vercel. It
  continues recording the same eligible reaction Events as the current bot.
- The bot operates in Telegram groups and supergroups and exposes one command: `/stats`.
- Every `/stats` invocation uses the same one-shot agent flow. A bare command asks for the Current Season
  Leaderboard across all Members and the same five categories; text following the command is a free-form
  Stats question.
- Missing dimensions resolve broadly: all categories when “what” is absent, all Members when “who” is
  absent, Current Season when “when” is absent, and analogous inclusive defaults elsewhere.
- Arbitrary model-generated SQL is the feature. The agent may answer only scoring questions for the invoking
  Chat through read-only database tools; the technical enforcement mechanism remains a separate decision.
- Every outcome is public: either a concise rich Stats report or a concise rich explanation of why the report
  could not be obtained. A long result may span consecutive messages, but the prompt should avoid long prose.
- There is no conversational memory or follow-up protocol in this version.
- `Stats question` and `Stats report` are the accepted domain terms recorded in the root glossary.
