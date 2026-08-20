# Use Neon TCP transactions in production and PGlite locally

Production uses Neon Postgres through a module-scoped `pg` pool because claiming a Telegram update and applying its effects atomically requires an interactive transaction that Neon's HTTP driver does not support. Runtime traffic uses the pooled endpoint, migrations and one-off imports prefer the unpooled endpoint, and local development and tests use PGlite with the same schema and migrations. Maintaining two adapters costs some parity risk but keeps local work credential-free without weakening production transaction guarantees.
