#!/usr/bin/env bash
# Testy bazy: każdy plik działa w transakcji zakończonej ROLLBACK, więc dane testowe zostają nietknięte.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DB_URL="${DATABASE_ADMIN_URL:-postgresql://postgres@127.0.0.1:54322/postgres}"
DB_NAME="${DB_NAME:-ostoja_test}"

DB_NAME="$DB_NAME" "$ROOT/scripts/db-reset.sh" >/dev/null
db_url="${DB_URL%/*}/${DB_NAME}"

fail=0
for f in "$ROOT"/tests/db/[0-9]*.sql; do
  if out=$(psql "$db_url" -v ON_ERROR_STOP=1 -q -X -f "$f" 2>&1); then
    echo "OK    $(basename "$f")"
  else
    echo "BŁĄD  $(basename "$f")"
    echo "$out" | grep -E "ERROR|assert|FAIL" | head -5
    fail=1
  fi
done
exit $fail
