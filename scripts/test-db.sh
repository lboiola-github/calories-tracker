#!/usr/bin/env bash
# Aplica las migraciones sobre un Postgres local descartable y corre las pruebas SQL
# (RLS, restricciones y funciones). No necesita Docker ni el CLI de Supabase.
#
# Uso:
#   npm run test:db                         # crea un cluster temporal (requiere initdb/pg_ctl)
#   TEST_DATABASE_URL=postgres://... npm run test:db   # usa una base vacía existente
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PSQL_OPTS=(-v ON_ERROR_STOP=1 -q -X)

cleanup() { :; }
trap 'cleanup' EXIT

if [[ -z "${TEST_DATABASE_URL:-}" ]]; then
  PG_BIN="${PG_BIN:-$(pg_config --bindir 2>/dev/null || ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
  TMP="$(mktemp -d)"
  PORT="${TEST_DB_PORT:-54329}"
  RUN=()
  if [[ "$(id -u)" == "0" ]]; then
    chown postgres "$TMP"
    RUN=(runuser -u postgres --)
  fi
  "${RUN[@]}" "$PG_BIN/initdb" -D "$TMP/data" -A trust -U postgres --no-sync >/dev/null
  "${RUN[@]}" "$PG_BIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/log" -w start >/dev/null
  cleanup() { "${RUN[@]}" "$PG_BIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
  TEST_DATABASE_URL="postgresql://postgres@/postgres?host=$TMP&port=$PORT"
fi

run_sql() { psql "${PSQL_OPTS[@]}" "$TEST_DATABASE_URL" -f "$1"; }

echo "→ Entorno simulado de Supabase"
run_sql "$ROOT/supabase/tests/00_supabase_shim.sql"

echo "→ Migraciones"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "   $(basename "$f")"
  run_sql "$f"
done

echo "→ Pruebas"
run_sql "$ROOT/supabase/tests/01_helpers.sql"
status=0
for f in "$ROOT"/supabase/tests/[1-9]*.test.sql; do
  if out=$(psql "${PSQL_OPTS[@]}" "$TEST_DATABASE_URL" -f "$f" 2>&1); then
    echo "   ✓ $(basename "$f")"
  else
    echo "   ✗ $(basename "$f")"; echo "$out" | sed 's/^/     /'; status=1
  fi
done
exit $status
