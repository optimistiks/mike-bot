-- Prototype DDL for the migration that installs the generated-SQL executor.
-- Run as the existing default Neon role after stats_agent exists.

BEGIN;

CREATE SCHEMA IF NOT EXISTS stats;
REVOKE ALL ON SCHEMA stats FROM PUBLIC;
GRANT USAGE ON SCHEMA stats TO CURRENT_USER;
GRANT CREATE ON SCHEMA stats TO stats_agent;

CREATE FUNCTION stats.execute_scoped_sql(
  generated_sql text,
  max_rows integer
)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
BEGIN
  IF max_rows < 1 OR max_rows > 1000 THEN
    RAISE EXCEPTION 'invalid row limit';
  END IF;

  RETURN QUERY EXECUTE format(
    'SELECT to_jsonb(agent_result) FROM (%s) AS agent_result LIMIT %s',
    generated_sql,
    max_rows
  );
END;
$function$;

REVOKE ALL
  ON FUNCTION stats.execute_scoped_sql(text, integer)
  FROM PUBLIC;
GRANT EXECUTE
  ON FUNCTION stats.execute_scoped_sql(text, integer)
  TO CURRENT_USER;
ALTER FUNCTION stats.execute_scoped_sql(text, integer) OWNER TO stats_agent;
REVOKE CREATE ON SCHEMA stats FROM stats_agent;

COMMIT;

SELECT
  owner.rolname AS function_owner,
  function.prosecdef AS security_definer
FROM pg_proc AS function
JOIN pg_roles AS owner ON owner.oid = function.proowner
WHERE function.oid =
  'stats.execute_scoped_sql(text,integer)'::regprocedure;
