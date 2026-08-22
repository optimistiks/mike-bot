-- Run once as the existing default Neon role on the primary compute.
-- The new role has no credentials; the app reaches it only through SET ROLE.

BEGIN;

CREATE ROLE stats_agent
  NOLOGIN
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT
  NOREPLICATION
  NOBYPASSRLS;

-- Allow the existing default Neon role executing this script to drop into the
-- limited role. Membership is one-way: stats_agent cannot become CURRENT_USER.
GRANT stats_agent TO CURRENT_USER;

-- Custom settings such as app.chat_id are USERSET. set_config is callable from
-- SELECT, so remove its default PUBLIC execute grant and return it only to the
-- trusted default Neon role executing this script.
REVOKE EXECUTE
  ON FUNCTION pg_catalog.set_config(text, text, boolean)
  FROM PUBLIC;
GRANT EXECUTE
  ON FUNCTION pg_catalog.set_config(text, text, boolean)
  TO CURRENT_USER;

COMMIT;

-- Expected result: false.
SELECT rolbypassrls
FROM pg_roles
WHERE rolname = 'stats_agent';

-- Expected result while acting as stats_agent: false.
SET ROLE stats_agent;
SELECT has_function_privilege(
  current_user,
  'pg_catalog.set_config(text,text,boolean)',
  'EXECUTE'
) AS can_change_trusted_chat;
RESET ROLE;
