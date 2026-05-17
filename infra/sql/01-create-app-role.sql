-- MendoraCI bootstrap (runs ONCE on fresh postgres data dir, via
-- docker-entrypoint-initdb.d). Creates the runtime app role that is NOT
-- superuser, so RLS policies actually fire.
--
-- The compose `POSTGRES_USER` is `mendoraci_admin` (bootstrap superuser, used
-- by api-migrate to run DDL). This script then creates `mendoraci_app` as the
-- NON-SUPER runtime role.
--
-- Anchors: RT-013 Multi-Tenant Isolation, BR-013 (security).
-- Found in CP-4: TEST-007 cross-tenant exposed that the original single-user
-- setup made `mendoraci_app` a superuser, silently bypassing all RLS policies.
--
-- Note: `psql` invoked by docker-entrypoint-initdb.d cannot read env vars
-- directly inside .sql files. Instead, the .sh wrapper picks up $POSTGRES_APP_PASSWORD
-- from the container env. We use ALTER ROLE ... PASSWORD ... below; the
-- companion 00-create-app-role.sh sets the actual password from the env var.

CREATE ROLE mendoraci_app LOGIN NOSUPERUSER NOBYPASSRLS;

GRANT CONNECT ON DATABASE mendoraci TO mendoraci_app;
GRANT USAGE ON SCHEMA public TO mendoraci_app;

-- Default privileges: anything mendoraci_admin creates from now on is reachable
-- by mendoraci_app via DML.
ALTER DEFAULT PRIVILEGES FOR ROLE mendoraci_admin IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO mendoraci_app;
ALTER DEFAULT PRIVILEGES FOR ROLE mendoraci_admin IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO mendoraci_app;
