# What happens at the edges?

Type: grilling
Status: open

## Question

Two edge cases need a decided behaviour:

1. **Mini App chat picker empty** — opener has no rows in `chat_memberships` (not in any group with the bot). What does the UI show?
2. **Reaction on uncached message** — `message_authors` has no row for that `message_id` (bot never saw the message). Skip silently, log only, or something else?
