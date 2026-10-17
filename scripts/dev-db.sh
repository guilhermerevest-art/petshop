#!/usr/bin/env bash
# Cria os papéis e bancos de desenvolvimento e teste num Postgres local.
# Uso: PGHOST=localhost PGUSER=postgres ./scripts/dev-db.sh
set -euo pipefail

psql -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'petshop_owner') THEN
    CREATE ROLE petshop_owner LOGIN PASSWORD 'petshop_owner';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'petshop_app') THEN
    CREATE ROLE petshop_app LOGIN PASSWORD 'petshop_app';
  ELSE
    ALTER ROLE petshop_app LOGIN PASSWORD 'petshop_app';
  END IF;
END $$;
SQL

for db in petshop petshop_test; do
  if ! psql -tAc "SELECT 1 FROM pg_database WHERE datname = '$db'" | grep -q 1; then
    psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE $db OWNER petshop_owner"
  fi
  psql -v ON_ERROR_STOP=1 -d "$db" -c "GRANT CONNECT ON DATABASE $db TO petshop_app"
done

echo "Bancos prontos: petshop e petshop_test (papéis petshop_owner e petshop_app)."
