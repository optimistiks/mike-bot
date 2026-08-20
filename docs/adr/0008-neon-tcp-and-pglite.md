# Use Neon TCP transactions in production and PGlite locally

Production uses Neon Postgres through a module-scoped `pg` pool attached to Vercel Fluid Compute, rather than Neon's HTTP driver. A Telegram update must claim its update ID and apply all effects in one interactive transaction; the HTTP driver does not support that transaction shape. Runtime traffic uses the pooled connection, while migrations and one-off imports use a direct connection.

Local development and tests use PGlite with the same Drizzle schema and migrations. This keeps local work credential-free at the cost of maintaining two connection adapters. Correctness remains database-backed across function invocations; a warm function may reuse its pool and webhook handler, but the application never relies on process persistence.
