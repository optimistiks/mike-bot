-- Run once as the existing default Neon role on the primary compute.
-- The new role has no credentials; it owns the limited SQL executor function.

BEGIN;

CREATE ROLE stats_agent
  NOLOGIN
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT
  NOREPLICATION
  NOBYPASSRLS;

-- Allow the existing default Neon role to administer objects owned by the
-- limited role. Generated SQL does not use SET ROLE; it executes inside the
-- stats_agent-owned function defined by the companion SQL.
GRANT stats_agent TO CURRENT_USER;

COMMIT;

-- Expected result: false for every capability column.
SELECT
  rolcanlogin,
  rolsuper,
  rolcreatedb,
  rolcreaterole,
  rolreplication,
  rolbypassrls
FROM pg_roles
WHERE rolname = 'stats_agent';
