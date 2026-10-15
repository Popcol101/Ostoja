#!/usr/bin/env bash
# Odtwarza lokalną bazę: nakładka Supabase (tylko lokalnie) + migracje + dane testowe.
# Na projekcie Supabase używaj zamiast tego: npx supabase db reset / db push.
set -euo pipefail

DB_URL="${DATABASE_ADMIN_URL:-postgresql://postgres@127.0.0.1:54322/postgres}"
DB_NAME="${DB_NAME:-ostoja}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

admin_url="${DB_URL}"
db_url="${DB_URL%/*}/${DB_NAME}"

psql "$admin_url" -v ON_ERROR_STOP=1 -q -c "drop database if exists ${DB_NAME} with (force);" -c "create database ${DB_NAME};"

psql "$db_url" -v ON_ERROR_STOP=1 -q -f "$ROOT/supabase/local/00_supabase_shim.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  psql "$db_url" -v ON_ERROR_STOP=1 -q -f "$f"
done
if [[ "${SKIP_SEED:-0}" != "1" ]]; then
  psql "$db_url" -v ON_ERROR_STOP=1 -q -f "$ROOT/supabase/seed.sql"
fi
echo "Baza ${DB_NAME} gotowa."
